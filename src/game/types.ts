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

export type CardType = 'attack' | 'skill' | 'power' | 'status' | 'curse'

export type DamageType = 'attack' | 'hpLoss'

/** 阶段 A 只保留数据模型和时序，不让这些状态改变伤害或格挡。 */
export type StatusId =
  | 'strength'
  | 'dexterity'
  | 'weak'
  | 'vulnerable'
  | 'frail'
  | 'poison'
  | 'aim'
  | 'expose'
  | 'evasion'

/**
 * amount 是可见层数。
 * deferred 是其中要跳过下一次回合末衰减的层数，用来区分“刚在敌人阶段施加”的部分，避免整叠状态一起被跳过或一起被减掉。
 */
export interface StatusInstance {
  id: StatusId
  amount: number
  deferred: number
}

export type StatusApplyWindow = 'playerPhase' | 'enemyPhase'

/** 衰减只发生在 afterEnemyActions。另外两个时点留给阶段 B 的中毒，阶段 A 不在那里减层。 */
export type StatusTickMoment = 'enemyTurnStart' | 'afterEnemyActions' | 'playerTurnStart'

export type ActorRef = { side: 'player' } | { side: 'enemy'; id: string }

export type Effect =
  | { type: 'damage'; amount: number; times: number }
  | { type: 'block'; amount: number }
  | { type: 'draw'; count: number }
  | { type: 'gainEnergy'; amount: number }
  | { type: 'selfDamage'; amount: number }
  | { type: 'exhaust' }
  | { type: 'applyStatus'; status: StatusId; amount: number; target: 'self' | 'enemy' }

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
  statuses: readonly StatusInstance[]
}

export interface Player extends Combatant {
  energy: number
  maxEnergy: number
}

export type IntentKind = 'attack' | 'block' | 'attackBlock'

export interface StatusApplication {
  status: StatusId
  amount: number
  target: 'player' | 'self'
}

export interface Intent {
  kind: IntentKind
  damage: number
  times: number
  block: number
  label: string
  apply?: readonly StatusApplication[]
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
  /** 下一次战斗事件使用的编号。只增不减，缓冲区挤掉旧事件后也不会复用。 */
  eventSeq: number
  /** 有容量上限的最近事件。不是全局事件总线。 */
  events: CombatEvent[]
  log: string[]
}

export type CombatEvent =
  | { id: number; type: 'cardPlayed'; name: string; instanceId: string; definitionId: CardId; cost: number }
  | { id: number; type: 'damageEffect'; name: string; amount: number; times: number; target: ActorRef }
  | {
      id: number
      type: 'damageDealt'
      source: ActorRef
      target: ActorRef
      damageType: DamageType
      amount: number
      blocked: number
      hpLoss: number
      hitIndex: number
    }
  | { id: number; type: 'blockGained'; name: string; target: ActorRef; amount: number; logged: boolean }
  | { id: number; type: 'energyGained'; name: string; amount: number }
  | { id: number; type: 'selfDamage'; name: string; amount: number; hpLoss: number }
  | { id: number; type: 'poisonTick'; target: ActorRef; amount: number; hpLoss: number }
  | { id: number; type: 'statusApplied'; target: ActorRef; status: StatusId; amount: number; result: number }
  | { id: number; type: 'statusTicked'; target: ActorRef; status: StatusId; amount: number }
  | { id: number; type: 'statusExpired'; target: ActorRef; status: StatusId }
  | { id: number; type: 'intentResolved'; name: string; label: string }
  | { id: number; type: 'healed'; amount: number }
  | { id: number; type: 'defeated'; target: ActorRef }
  | { id: number; type: 'victory' }

export type GameAction =
  | { type: 'startRun' }
  | { type: 'playCard'; instanceId: string }
  | { type: 'endTurn' }
  | { type: 'chooseReward'; definitionId: CardId }
  | { type: 'restart' }

export type ActionResult =
  | { ok: true; state: RunState }
  | { ok: false; state: RunState; reason: string }
