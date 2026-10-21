import { CARD_IDS, createStarterDeck } from './cards.ts'
import { endTurn, playCard, startBattle, startPlayerTurn } from './combat.ts'
import { ENERGY_PER_TURN, PLAYER_MAX_HP, VICTORY_HEAL } from './constants.ts'
import { createEnemy } from './enemies.ts'
import { shuffle } from './rng.ts'
import type { ActionResult, CardId, GameAction, RunState } from './types.ts'

function reject(state: RunState, reason: string): ActionResult {
  return { ok: false, state, reason }
}

function ok(state: RunState): ActionResult {
  return { ok: true, state }
}

export function createRun(seed: number): RunState {
  const normalized = seed >>> 0
  return {
    phase: 'menu',
    seed: normalized,
    rngState: normalized,
    battleIndex: 0,
    player: {
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      block: 0,
      energy: ENERGY_PER_TURN,
      maxEnergy: ENERGY_PER_TURN,
    },
    enemy: null,
    deck: createStarterDeck(),
    drawPile: [],
    hand: [],
    discardPile: [],
    exhaustPile: [],
    rewardOptions: [],
    turn: 0,
    log: [],
  }
}

function markDefeat(state: RunState): RunState {
  return {
    ...state,
    phase: 'defeat',
    player: { ...state.player, hp: 0 },
    log: [...state.log, '你倒下了'],
  }
}

function finishBattle(state: RunState): RunState {
  if (state.enemy?.boss) {
    return {
      ...state,
      phase: 'victory',
      rewardOptions: [],
      log: [...state.log, '你登上了塔顶'],
    }
  }

  const healedHp = Math.min(state.player.maxHp, state.player.hp + VICTORY_HEAL)
  const rewards = shuffle([...CARD_IDS], state.rngState)
  return {
    ...state,
    phase: 'reward',
    rngState: rewards.rngState,
    rewardOptions: rewards.items.slice(0, 3),
    player: {
      ...state.player,
      hp: healedHp,
      block: 0,
      energy: 0,
    },
    enemy: null,
    drawPile: [],
    hand: [],
    discardPile: [],
    exhaustPile: [],
    log: [...state.log, `回复 ${healedHp - state.player.hp} 点生命`],
  }
}

function settleCard(state: RunState): RunState {
  if (state.player.hp <= 0) return markDefeat(state)
  if (state.enemy && state.enemy.hp <= 0) return finishBattle(state)
  return state
}

function settleTurn(state: RunState): RunState {
  if (state.player.hp <= 0) return markDefeat(state)
  return startPlayerTurn(state)
}

function startRun(state: RunState): ActionResult {
  if (state.phase !== 'menu') return reject(state, '当前不能开始游戏')
  return ok(startBattle(state, createEnemy(state.battleIndex)))
}

function chooseReward(state: RunState, definitionId: CardId): ActionResult {
  if (state.phase !== 'reward') return reject(state, '当前不能领取奖励')
  if (!state.rewardOptions.includes(definitionId)) return reject(state, '这张牌不在奖励中')
  const added: RunState = {
    ...state,
    deck: [
      ...state.deck,
      { instanceId: `${definitionId}-${state.deck.length + 1}`, definitionId },
    ],
    rewardOptions: [],
    battleIndex: state.battleIndex + 1,
  }
  return ok(startBattle(added, createEnemy(added.battleIndex)))
}

export function applyAction(state: RunState, action: GameAction): ActionResult {
  switch (action.type) {
    case 'startRun':
      return startRun(state)
    case 'playCard': {
      const result = playCard(state, action.instanceId)
      if (!result.ok) return result
      return ok(settleCard(result.state))
    }
    case 'endTurn': {
      const result = endTurn(state)
      if (!result.ok) return result
      return ok(settleTurn(result.state))
    }
    case 'chooseReward':
      return chooseReward(state, action.definitionId)
    case 'restart':
      return ok(createRun(state.seed))
    default: {
      const unreachable: never = action
      return reject(state, `未知操作：${String(unreachable)}`)
    }
  }
}
