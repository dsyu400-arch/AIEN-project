import { getCard } from './cards.ts'
import { DRAW_PER_TURN, ENERGY_PER_TURN, HAND_LIMIT } from './constants.ts'
import { applyAttackHits, applyHpLoss, modifyAttackDamage, modifyBlockGain } from './damage.ts'
import { currentIntent } from './enemies.ts'
import { appendEvents, statusChangeDrafts } from './events.ts'
import type { CombatEventDraft } from './events.ts'
import { shuffle } from './rng.ts'
import { applyStatusStacks, consumePoison, diffStatusChanges, tickCombatant } from './status.ts'
import type {
  ActionResult,
  ActorRef,
  CardDefinition,
  CardInstance,
  Combatant,
  Effect,
  Enemy,
  RunState,
  StatusApplication,
  StatusInstance,
} from './types.ts'

function reject(state: RunState, reason: string): ActionResult {
  return { ok: false, state, reason }
}

function ok(state: RunState): ActionResult {
  return { ok: true, state }
}

function drawOne(state: RunState): RunState {
  let current = state
  if (current.drawPile.length === 0) {
    if (current.discardPile.length === 0) return current
    const shuffled = shuffle(current.discardPile, current.rngState)
    current = {
      ...current,
      rngState: shuffled.rngState,
      drawPile: shuffled.items,
      discardPile: [],
    }
  }

  const card = current.drawPile[0]
  if (!card) return current
  const drawPile = current.drawPile.slice(1)
  if (current.hand.length >= HAND_LIMIT) {
    return {
      ...current,
      drawPile,
      discardPile: [...current.discardPile, card],
    }
  }
  return {
    ...current,
    drawPile,
    hand: [...current.hand, card],
  }
}

export function drawCards(state: RunState, count: number): RunState {
  let current = state
  for (let drawn = 0; drawn < count; drawn += 1) {
    const next = drawOne(current)
    if (next === current) break
    current = next
  }
  return current
}

export function startPlayerTurn(state: RunState): RunState {
  const cleared = { ...state.player, block: 0 }
  const poisonDrafts = poisonDraftsFor(cleared, { side: 'player' })
  let player = poisonDrafts.combatant
  const drafts = poisonDrafts.drafts
  if (player.hp <= 0) return appendEvents({ ...state, player }, drafts)
  player = { ...player, energy: ENERGY_PER_TURN }
  const ticked = tickCombatant(player, 'playerTurnStart')
  drafts.push(...changeDrafts(player.statuses, ticked.statuses, { side: 'player' }))
  const ready = appendEvents(
    {
      ...state,
      turn: state.turn + 1,
      player: ticked,
    },
    drafts,
  )
  return drawCards(ready, DRAW_PER_TURN)
}

export function startBattle(state: RunState, enemy: Enemy): RunState {
  const dealt = shuffle(
    state.deck.map((card) => ({ ...card })),
    state.rngState,
  )
  const opening: RunState = {
    ...state,
    phase: 'playerTurn',
    rngState: dealt.rngState,
    enemy,
    drawPile: dealt.items,
    hand: [],
    discardPile: [],
    exhaustPile: [],
    rewardOptions: [],
    turn: 0,
    log: [],
    events: [],
    player: {
      ...state.player,
      block: 0,
      energy: 0,
    },
  }
  return startPlayerTurn(opening)
}

function applyEffect(state: RunState, effect: Effect, name: string): RunState {
  switch (effect.type) {
    case 'damage': {
      if (!state.enemy) return state
      const target: ActorRef = { side: 'enemy', id: state.enemy.id }
      const source: ActorRef = { side: 'player' }
      let enemy = state.enemy
      const hits: Array<{ amount: number; blocked: number; hpLoss: number; hitIndex: number }> = []
      for (let hitIndex = 0; hitIndex < effect.times; hitIndex += 1) {
        const amount = modifyAttackDamage(effect.amount, state.player, enemy)
        const result = applyAttackHits(enemy, amount, 1)
        enemy = result.combatant
        const hit = result.hits[0]
        if (hit) hits.push({ ...hit, hitIndex })
      }
      return appendEvents({ ...state, enemy }, [
        { type: 'damageEffect', name, amount: hits[0]?.amount ?? effect.amount, times: effect.times, target },
        ...hits.map((hit) => ({
          type: 'damageDealt' as const,
          source,
          target,
          damageType: 'attack' as const,
          amount: hit.amount,
          blocked: hit.blocked,
          hpLoss: hit.hpLoss,
          hitIndex: hit.hitIndex,
        })),
      ])
    }
    case 'block': {
      const gained = modifyBlockGain(effect.amount, state.player)
      return appendEvents(
        { ...state, player: { ...state.player, block: state.player.block + gained } },
        [{ type: 'blockGained', name, target: { side: 'player' }, amount: gained, logged: true }],
      )
    }
    case 'draw':
      return drawCards(state, effect.count)
    case 'gainEnergy':
      return appendEvents(
        { ...state, player: { ...state.player, energy: state.player.energy + effect.amount } },
        [{ type: 'energyGained', name, amount: effect.amount }],
      )
    case 'selfDamage': {
      const result = applyHpLoss(state.player, effect.amount)
      return appendEvents({ ...state, player: result.combatant }, [
        { type: 'selfDamage', name, amount: effect.amount, hpLoss: result.hpLoss },
      ])
    }
    case 'exhaust':
      return state
    case 'applyStatus':
      return applyStatusEffect(state, effect)
    default: {
      const unreachable: never = effect
      throw new Error(`未知效果：${String(unreachable)}`)
    }
  }
}

function applyStatusEffect(
  state: RunState,
  effect: Extract<Effect, { type: 'applyStatus' }>,
): RunState {
  if (effect.target === 'enemy') {
    if (!state.enemy) return state
    const statuses = applyStatusStacks(state.enemy.statuses, effect.status, effect.amount, 'playerPhase')
    const result = getAppliedAmount(statuses, effect.status)
    return appendEvents(
      { ...state, enemy: { ...state.enemy, statuses } },
      [{ type: 'statusApplied', target: { side: 'enemy', id: state.enemy.id }, status: effect.status, amount: effect.amount, result }],
    )
  }
  const statuses = applyStatusStacks(state.player.statuses, effect.status, effect.amount, 'playerPhase')
  const result = getAppliedAmount(statuses, effect.status)
  return appendEvents(
    { ...state, player: { ...state.player, statuses } },
    [{ type: 'statusApplied', target: { side: 'player' }, status: effect.status, amount: effect.amount, result }],
  )
}

function getAppliedAmount(statuses: readonly StatusInstance[], id: StatusInstance['id']): number {
  return statuses.find((status) => status.id === id)?.amount ?? 0
}

function changeDrafts(
  before: readonly StatusInstance[],
  after: readonly StatusInstance[],
  target: ActorRef,
): CombatEventDraft[] {
  return statusChangeDrafts(diffStatusChanges(before, after), target)
}

function resolveCard(state: RunState, card: CardInstance, definition: CardDefinition): RunState {
  const hand = state.hand.filter((item) => item.instanceId !== card.instanceId)
  let current: RunState = appendEvents(
    {
      ...state,
      hand,
      player: { ...state.player, energy: state.player.energy - definition.cost },
    },
    [{ type: 'cardPlayed', name: definition.name, instanceId: card.instanceId, definitionId: definition.id, cost: definition.cost }],
  )
  let exhaust = false
  for (const effect of definition.effects) {
    current = applyEffect(current, effect, definition.name)
    if (effect.type === 'exhaust') exhaust = true
  }
  if (exhaust) {
    return { ...current, exhaustPile: [...current.exhaustPile, card] }
  }
  return { ...current, discardPile: [...current.discardPile, card] }
}

export function playCard(state: RunState, instanceId: string): ActionResult {
  if (state.phase !== 'playerTurn' || state.enemy === null) {
    return reject(state, '当前不能出牌')
  }
  const card = state.hand.find((item) => item.instanceId === instanceId)
  if (!card) return reject(state, '手牌中没有这张牌')
  const definition = getCard(card.definitionId)
  if (state.player.energy < definition.cost) return reject(state, '能量不足')
  return ok(resolveCard(state, card, definition))
}

function poisonDraftsFor<T extends Combatant>(
  combatant: T,
  target: ActorRef,
): { combatant: T; drafts: CombatEventDraft[] } {
  const consumed = consumePoison(combatant.statuses)
  if (!consumed) return { combatant, drafts: [] }
  const hurt = applyHpLoss({ ...combatant, statuses: consumed.statuses }, consumed.damage)
  return {
    combatant: hurt.combatant,
    drafts: [
      { type: 'poisonTick', target, amount: consumed.damage, hpLoss: hurt.hpLoss },
      ...changeDrafts(combatant.statuses, hurt.combatant.statuses, target),
    ],
  }
}

function grantApplications(
  player: RunState['player'],
  enemy: Enemy,
  applications: readonly StatusApplication[],
  window: 'playerPhase' | 'enemyPhase',
): { player: RunState['player']; enemy: Enemy; drafts: CombatEventDraft[] } {
  let nextPlayer = player
  let nextEnemy = enemy
  const drafts: CombatEventDraft[] = []
  for (const application of applications) {
    if (application.target === 'player') {
      const statuses = applyStatusStacks(nextPlayer.statuses, application.status, application.amount, window)
      drafts.push({
        type: 'statusApplied',
        target: { side: 'player' },
        status: application.status,
        amount: application.amount,
        result: statuses.find((status) => status.id === application.status)?.amount ?? 0,
      })
      nextPlayer = { ...nextPlayer, statuses }
    } else {
      const statuses = applyStatusStacks(nextEnemy.statuses, application.status, application.amount, window)
      drafts.push({
        type: 'statusApplied',
        target: { side: 'enemy', id: enemy.id },
        status: application.status,
        amount: application.amount,
        result: statuses.find((status) => status.id === application.status)?.amount ?? 0,
      })
      nextEnemy = { ...nextEnemy, statuses }
    }
  }
  return { player: nextPlayer, enemy: nextEnemy, drafts }
}

function resolveEnemyAction(state: RunState): RunState {
  const enemy = state.enemy
  if (!enemy) return state
  const intent = currentIntent(enemy)
  let nextEnemy: Enemy = { ...enemy, block: 0 }
  const opening = poisonDraftsFor(nextEnemy, { side: 'enemy', id: enemy.id })
  nextEnemy = opening.combatant
  const drafts: CombatEventDraft[] = [...opening.drafts]
  if (nextEnemy.hp <= 0) return appendEvents({ ...state, enemy: nextEnemy }, drafts)
  nextEnemy = tickCombatant(nextEnemy, 'enemyTurnStart')
  let player = state.player
  if (intent.times > 0) {
    const source: ActorRef = { side: 'enemy', id: enemy.id }
    const target: ActorRef = { side: 'player' }
    for (let hitIndex = 0; hitIndex < intent.times; hitIndex += 1) {
      const amount = modifyAttackDamage(intent.damage, nextEnemy, player)
      const result = applyAttackHits(player, amount, 1)
      player = result.combatant
      const hit = result.hits[0]
      if (!hit) continue
      drafts.push({
        type: 'damageDealt',
        source,
        target,
        damageType: 'attack',
        amount: hit.amount,
        blocked: hit.blocked,
        hpLoss: hit.hpLoss,
        hitIndex,
      })
    }
  }
  if (intent.block > 0) {
    nextEnemy = { ...nextEnemy, block: intent.block }
    drafts.push({
      type: 'blockGained',
      name: enemy.name,
      target: { side: 'enemy', id: enemy.id },
      amount: intent.block,
      logged: false,
    })
  }
  const applied = grantApplications(player, nextEnemy, intent.apply ?? [], 'enemyPhase')
  player = applied.player
  nextEnemy = applied.enemy
  drafts.push(...applied.drafts)
  nextEnemy = {
    ...nextEnemy,
    patternIndex: (enemy.patternIndex + 1) % enemy.pattern.length,
  }
  const playerBeforeTick = player
  const enemyBeforeTick = nextEnemy
  player = tickCombatant(player, 'afterEnemyActions')
  nextEnemy = tickCombatant(nextEnemy, 'afterEnemyActions')
  drafts.push(...changeDrafts(playerBeforeTick.statuses, player.statuses, { side: 'player' }))
  drafts.push(...changeDrafts(enemyBeforeTick.statuses, nextEnemy.statuses, { side: 'enemy', id: enemy.id }))
  drafts.push({ type: 'intentResolved', name: enemy.name, label: intent.label })
  return appendEvents({ ...state, player, enemy: nextEnemy }, drafts)
}

/** 弃置手牌并让敌人行动。不开启下一回合，也不改胜负阶段。 */
export function endTurn(state: RunState): ActionResult {
  if (state.phase !== 'playerTurn' || state.enemy === null) {
    return reject(state, '当前不能结束回合')
  }
  const discarded: RunState = {
    ...state,
    hand: [],
    discardPile: [...state.discardPile, ...state.hand],
  }
  return ok(resolveEnemyAction(discarded))
}
