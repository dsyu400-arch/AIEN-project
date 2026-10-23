export const GAME_TITLE = '遗烬之塔'

export {
  BATTLE_COUNT,
  DRAW_PER_TURN,
  ENERGY_PER_TURN,
  EVENT_BUFFER_LIMIT,
  HAND_LIMIT,
  PLAYER_MAX_HP,
  VICTORY_HEAL,
} from './constants.ts'
export { CARD_DEFINITIONS, CARD_IDS, createStarterDeck, getCard } from './cards.ts'
export { ENCOUNTERS, createEnemy, currentIntent } from './enemies.ts'
export { shuffle } from './rng.ts'
export { describeStatus, STATUS_DEFINITIONS } from './status.ts'
export { applyAction, createRun } from './run.ts'

export type {
  ActionResult,
  ActorRef,
  CardDefinition,
  CardId,
  CardInstance,
  CombatEvent,
  DamageType,
  Effect,
  Enemy,
  GameAction,
  Intent,
  Phase,
  Player,
  RunState,
  StatusApplyWindow,
  StatusId,
  StatusInstance,
  StatusTickMoment,
} from './types.ts'
