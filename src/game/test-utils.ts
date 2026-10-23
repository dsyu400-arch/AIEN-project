import { applyAction, createRun } from './run.ts'
import type { CardId, CardInstance, RunState, StatusInstance } from './types.ts'

export function must(result: { ok: true; state: RunState } | { ok: false; reason: string }): RunState {
  if (!result.ok) throw new Error(result.reason)
  return result.state
}

export function begin(seed = 1): RunState {
  return must(applyAction(createRun(seed), { type: 'startRun' }))
}

export function card(definitionId: CardId, instanceId?: string): CardInstance {
  return { instanceId: instanceId ?? definitionId, definitionId }
}

export function prepare(
  state: RunState,
  patch: {
    hand?: CardInstance[]
    drawPile?: CardInstance[]
    discardPile?: CardInstance[]
    exhaustPile?: CardInstance[]
    energy?: number
    playerHp?: number
    playerBlock?: number
    playerStatuses?: readonly StatusInstance[]
    enemyHp?: number
    enemyBlock?: number
    enemyStatuses?: readonly StatusInstance[]
    patternIndex?: number
    hitRngState?: number
    nextAttackAccuracy?: number | null
  },
): RunState {
  return {
    ...state,
    hitRngState: patch.hitRngState ?? state.hitRngState,
    hand: patch.hand ?? state.hand,
    drawPile: patch.drawPile ?? state.drawPile,
    discardPile: patch.discardPile ?? state.discardPile,
    exhaustPile: patch.exhaustPile ?? state.exhaustPile,
    player: {
      ...state.player,
      energy: patch.energy ?? state.player.energy,
      hp: patch.playerHp ?? state.player.hp,
      block: patch.playerBlock ?? state.player.block,
      statuses: patch.playerStatuses ?? state.player.statuses,
      nextAttackAccuracy:
        patch.nextAttackAccuracy === undefined ? state.player.nextAttackAccuracy : patch.nextAttackAccuracy,
    },
    enemy: state.enemy
      ? {
          ...state.enemy,
          hp: patch.enemyHp ?? state.enemy.hp,
          block: patch.enemyBlock ?? state.enemy.block,
          statuses: patch.enemyStatuses ?? state.enemy.statuses,
          patternIndex: patch.patternIndex ?? state.enemy.patternIndex,
        }
      : null,
  }
}

export function play(state: RunState, instanceId: string): RunState {
  return must(applyAction(state, { type: 'playCard', instanceId }))
}

export function pileIds(state: RunState): string[] {
  return [...state.drawPile, ...state.hand, ...state.discardPile, ...state.exhaustPile]
    .map((item) => item.instanceId)
    .sort()
}

export function freezeRun(state: RunState): RunState {
  Object.freeze(state)
  Object.freeze(state.player)
  Object.freeze(state.player.statuses)
  for (const status of state.player.statuses) Object.freeze(status)
  Object.freeze(state.events)
  for (const event of state.events) Object.freeze(event)
  Object.freeze(state.deck)
  Object.freeze(state.drawPile)
  Object.freeze(state.hand)
  Object.freeze(state.discardPile)
  Object.freeze(state.exhaustPile)
  Object.freeze(state.rewardOptions)
  Object.freeze(state.log)
  for (const item of [
    ...state.deck,
    ...state.drawPile,
    ...state.hand,
    ...state.discardPile,
    ...state.exhaustPile,
  ]) {
    Object.freeze(item)
  }
  if (state.enemy) {
    Object.freeze(state.enemy)
    Object.freeze(state.enemy.statuses)
    for (const status of state.enemy.statuses) Object.freeze(status)
    Object.freeze(state.enemy.pattern)
    for (const intent of state.enemy.pattern) Object.freeze(intent)
  }
  return state
}
