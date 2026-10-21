export type Phase = 'menu' | 'playerTurn' | 'reward' | 'victory' | 'defeat'

export type CardId =
  | 'emberSlash'
  | 'towerSmash'
  | 'ashFlurry'
  | 'heartBurn'
  | 'emberSpear'
  | 'ashShield'
  | 'towerWall'
  | 'emberArmor'
  | 'gatherAsh'
  | 'emberInsight'
  | 'returnFlame'
  | 'gatherFlame'

export type CardType = 'attack' | 'skill'

export type Effect =
  | { type: 'damage'; amount: number; times: number }
  | { type: 'block'; amount: number }
  | { type: 'draw'; count: number }
  | { type: 'gainEnergy'; amount: number }
  | { type: 'selfDamage'; amount: number }
  | { type: 'exhaust' }

export interface CardDefinition {
  id: CardId
  name: string
  cost: number
  cardType: CardType
  description: string
  effects: readonly Effect[]
}

export interface CardInstance {
  instanceId: string
  definitionId: CardId
}

export interface Combatant {
  hp: number
  maxHp: number
  block: number
}

export interface Player extends Combatant {
  energy: number
  maxEnergy: number
}

export type IntentKind = 'attack' | 'block' | 'attackBlock'

export interface Intent {
  kind: IntentKind
  damage: number
  times: number
  block: number
  label: string
}

export interface Enemy extends Combatant {
  id: string
  name: string
  boss: boolean
  pattern: readonly Intent[]
  patternIndex: number
}

export interface RunState {
  phase: Phase
  seed: number
  rngState: number
  battleIndex: number
  player: Player
  enemy: Enemy | null
  deck: CardInstance[]
  drawPile: CardInstance[]
  hand: CardInstance[]
  discardPile: CardInstance[]
  exhaustPile: CardInstance[]
  rewardOptions: CardId[]
  turn: number
  log: string[]
}

export type GameAction =
  | { type: 'startRun' }
  | { type: 'playCard'; instanceId: string }
  | { type: 'endTurn' }
  | { type: 'chooseReward'; definitionId: CardId }
  | { type: 'restart' }

export type ActionResult =
  | { ok: true; state: RunState }
  | { ok: false; state: RunState; reason: string }
