import { getCard } from './cards.ts'
import { DRAW_PER_TURN, ENERGY_PER_TURN, HAND_LIMIT } from './constants.ts'
import { currentIntent } from './enemies.ts'
import { shuffle } from './rng.ts'
import type {
  ActionResult,
  CardDefinition,
  CardInstance,
  Combatant,
  Effect,
  Enemy,
  RunState,
} from './types.ts'

function reject(state: RunState, reason: string): ActionResult {
  return { ok: false, state, reason }
}

function ok(state: RunState): ActionResult {
  return { ok: true, state }
}

function hitMany<T extends Combatant>(combatant: T, amount: number, times: number): T {
  let current = combatant
  for (let hit = 0; hit < times; hit += 1) {
    const absorbed = Math.min(current.block, amount)
    current = {
      ...current,
      block: current.block - absorbed,
      hp: Math.max(0, current.hp - (amount - absorbed)),
    }
  }
  return current
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
  const ready: RunState = {
    ...state,
    turn: state.turn + 1,
    player: {
      ...state.player,
      block: 0,
      energy: ENERGY_PER_TURN,
    },
  }
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
      return {
        ...state,
        enemy: hitMany(state.enemy, effect.amount, effect.times),
        log: [...state.log, `${name}造成 ${effect.amount} 点伤害，共 ${effect.times} 次`],
      }
    }
    case 'block':
      return {
        ...state,
        player: { ...state.player, block: state.player.block + effect.amount },
        log: [...state.log, `${name}获得 ${effect.amount} 点护甲`],
      }
    case 'draw':
      return drawCards(state, effect.count)
    case 'gainEnergy':
      return {
        ...state,
        player: { ...state.player, energy: state.player.energy + effect.amount },
        log: [...state.log, `${name}获得 ${effect.amount} 点能量`],
      }
    case 'selfDamage':
      return {
        ...state,
        player: {
          ...state.player,
          hp: Math.max(0, state.player.hp - effect.amount),
        },
        log: [...state.log, `${name}对自己造成 ${effect.amount} 点伤害`],
      }
    case 'exhaust':
      return state
    default: {
      const unreachable: never = effect
      throw new Error(`未知效果：${String(unreachable)}`)
    }
  }
}

function resolveCard(state: RunState, card: CardInstance, definition: CardDefinition): RunState {
  const hand = state.hand.filter((item) => item.instanceId !== card.instanceId)
  let current: RunState = {
    ...state,
    hand,
    player: { ...state.player, energy: state.player.energy - definition.cost },
    log: [...state.log, `打出${definition.name}`],
  }
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

function resolveEnemyAction(state: RunState): RunState {
  const enemy = state.enemy
  if (!enemy) return state
  const intent = currentIntent(enemy)
  let nextEnemy: Enemy = { ...enemy, block: 0 }
  const player = intent.times > 0 ? hitMany(state.player, intent.damage, intent.times) : state.player
  if (intent.block > 0) {
    nextEnemy = { ...nextEnemy, block: intent.block }
  }
  nextEnemy = {
    ...nextEnemy,
    patternIndex: (enemy.patternIndex + 1) % enemy.pattern.length,
  }
  return {
    ...state,
    player,
    enemy: nextEnemy,
    log: [...state.log, `${enemy.name}：${intent.label}`],
  }
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
