import { attackHitChance, judgeHit } from './accuracy.ts'
import type { HitChance } from './accuracy.ts'
import { getCard } from './cards.ts'
import { DRAW_PER_TURN, ENERGY_PER_TURN, HAND_LIMIT } from './constants.ts'
import { applyAttackHits, applyHpLoss, modifyAttackDamage, modifyBlockGain } from './damage.ts'
import { currentIntent } from './enemies.ts'
import { appendEvents, statusChangeDrafts } from './events.ts'
import type { CombatEventDraft } from './events.ts'
import { shuffle } from './rng.ts'
import { applyStatusStacks, consumeAim, consumePoison, diffStatusChanges, tickCombatant } from './status.ts'
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
  TriggerEffect,
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

function profileFor(attacker: Combatant, defender: Combatant, baseAccuracy: number | undefined, nextAttackAccuracy: number | null, cannotMiss: boolean): HitChance {
  return attackHitChance({ baseAccuracy, nextAttackAccuracy, cannotMiss, attacker, defender })
}

function rollHit(state: RunState, profile: HitChance): { state: RunState; hit: boolean } {
  const judged = judgeHit(state.hitRngState, profile.chance, profile.cannotMiss)
  return { state: { ...state, hitRngState: judged.hitRngState }, hit: judged.hit }
}

function applyEffect(state: RunState, effect: Effect, name: string, attack: HitChance | null): RunState {
  switch (effect.type) {
    case 'damage': {
      if (!state.enemy) return state
      const target: ActorRef = { side: 'enemy', id: state.enemy.id }
      const source: ActorRef = { side: 'player' }
      const profile = attack ?? profileFor(state.player, state.enemy, undefined, state.player.nextAttackAccuracy, false)
      const announced = modifyAttackDamage(effect.amount, state.player, state.enemy)
      let current = appendEvents(state, [
        { type: 'damageEffect', name, amount: announced, times: effect.times, target },
      ])
      for (let hitIndex = 0; hitIndex < effect.times; hitIndex += 1) {
        if (!current.enemy) break
        const rolled = rollHit(current, profile)
        current = rolled.state
        if (!current.enemy) break
        if (!rolled.hit) {
          current = appendEvents(current, [
            { type: 'attackMissed', source, target, hitIndex, chance: profile.chance },
          ])
          current = applyTriggers(current, effect.onMiss, name)
          continue
        }
        const amount = modifyAttackDamage(effect.amount, current.player, current.enemy)
        const result = applyAttackHits(current.enemy, amount, 1)
        const hit = result.hits[0]
        current = { ...current, enemy: result.combatant }
        if (hit) {
          current = appendEvents(current, [
            {
              type: 'damageDealt',
              source,
              target,
              damageType: 'attack',
              amount: hit.amount,
              blocked: hit.blocked,
              hpLoss: hit.hpLoss,
              hitIndex,
              chance: profile.chance,
            },
          ])
        }
        current = applyTriggers(current, effect.onHit, name)
      }
      return current
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
    case 'setNextAttackAccuracy':
      return appendEvents(
        { ...state, player: { ...state.player, nextAttackAccuracy: effect.accuracy } },
        [{ type: 'accuracyArmed', accuracy: effect.accuracy }],
      )
    default: {
      const unreachable: never = effect
      throw new Error(`未知效果：${String(unreachable)}`)
    }
  }
}

function applyTriggers(state: RunState, effects: readonly TriggerEffect[] | undefined, name: string): RunState {
  if (!effects || effects.length === 0) return state
  let current = state
  for (const effect of effects) current = applyEffect(current, effect, name, null)
  return current
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
  let attack: HitChance | null = null
  const dealsDamage = definition.effects.some((effect) => effect.type === 'damage')
  if (dealsDamage && current.enemy) {
    attack = profileFor(
      current.player,
      current.enemy,
      definition.accuracy,
      current.player.nextAttackAccuracy,
      definition.cannotMiss === true,
    )
    const before = current.player.statuses
    const statuses = consumeAim(before)
    current = appendEvents(
      {
        ...current,
        player: { ...current.player, statuses, nextAttackAccuracy: null },
      },
      changeDrafts(before, statuses, { side: 'player' }),
    )
  }
  let exhaust = false
  for (const effect of definition.effects) {
    current = applyEffect(current, effect, definition.name, attack)
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
  let hitRngState = state.hitRngState
  if (intent.times > 0) {
    const source: ActorRef = { side: 'enemy', id: enemy.id }
    const target: ActorRef = { side: 'player' }
    const profile = profileFor(nextEnemy, player, intent.accuracy, null, intent.cannotMiss === true)
    for (let hitIndex = 0; hitIndex < intent.times; hitIndex += 1) {
      const judged = judgeHit(hitRngState, profile.chance, profile.cannotMiss)
      hitRngState = judged.hitRngState
      if (!judged.hit) {
        drafts.push({ type: 'attackMissed', source, target, hitIndex, chance: profile.chance })
        continue
      }
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
        chance: profile.chance,
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
  return appendEvents({ ...state, player, enemy: nextEnemy, hitRngState }, drafts)
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
