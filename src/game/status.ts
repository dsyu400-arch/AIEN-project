import type {
  Combatant,
  StatusApplyWindow,
  StatusId,
  StatusInstance,
  StatusTickMoment,
} from './types.ts'

export type StatusTiming = 'combat' | 'endOfRound' | 'ownerTurnStart' | 'untilAttack' | 'reserved'

export interface StatusDefinition {
  name: string
  polarity: 'buff' | 'debuff'
  timing: StatusTiming
}

export const STATUS_DEFINITIONS = {
  strength: { name: '力量', polarity: 'buff', timing: 'combat' },
  dexterity: { name: '敏捷', polarity: 'buff', timing: 'combat' },
  weak: { name: '虚弱', polarity: 'debuff', timing: 'endOfRound' },
  vulnerable: { name: '易伤', polarity: 'debuff', timing: 'endOfRound' },
  frail: { name: '脆弱', polarity: 'debuff', timing: 'endOfRound' },
  poison: { name: '中毒', polarity: 'debuff', timing: 'ownerTurnStart' },
  aim: { name: '瞄准', polarity: 'buff', timing: 'untilAttack' },
  expose: { name: '破绽', polarity: 'debuff', timing: 'reserved' },
  evasion: { name: '闪避', polarity: 'buff', timing: 'combat' },
} as const satisfies Record<StatusId, StatusDefinition>

export interface StatusChange {
  status: StatusId
  kind: 'ticked' | 'expired'
  amount: number
}

export interface StatusView {
  name: string
  polarity: 'buff' | 'debuff'
  amountLabel: string
  detail: string
}

const STATUS_DETAILS: Record<StatusId, string> = {
  strength: '每层使每段攻击伤害 +1，可以为负数。',
  dexterity: '每层使卡牌获得的格挡 +1，可以为负数。',
  weak: '攻击伤害降低 25%。数字是剩余回合。',
  vulnerable: '受到的攻击伤害增加 50%。数字是剩余回合。',
  frail: '卡牌获得的格挡降低 25%。数字是剩余回合。',
  poison: '回合开始时失去等同层数的生命，然后层数减 1。无视护甲。',
  aim: '当前版本不会改变战斗数值。',
  expose: '当前版本不会改变战斗数值。',
  evasion: '当前版本不会改变战斗数值。',
}

export function describeStatus(status: StatusInstance): StatusView {
  const definition = STATUS_DEFINITIONS[status.id]
  const unit = definition.timing === 'endOfRound' ? '回合' : '层'
  return {
    name: definition.name,
    polarity: definition.polarity,
    amountLabel: `${status.amount} ${unit}`,
    detail: STATUS_DETAILS[status.id],
  }
}

/** 中毒在回合开始单独结算：先造成无视护甲的生命损失，再把层数减 1。这里只改层数。 */
export function consumePoison(
  statuses: readonly StatusInstance[],
): { statuses: readonly StatusInstance[]; damage: number } | null {
  const poison = getStatus(statuses, 'poison')
  if (!poison || poison.amount <= 0) return null
  const nextAmount = poison.amount - 1
  const next = nextAmount <= 0
    ? statuses.filter((status) => status.id !== 'poison')
    : statuses.map((status) => (status.id === 'poison' ? { id: 'poison' as const, amount: nextAmount, deferred: 0 } : status))
  return { statuses: next, damage: poison.amount }
}

export function getStatus(statuses: readonly StatusInstance[], id: StatusId): StatusInstance | undefined {
  return statuses.find((status) => status.id === id)
}

/**
 * 回合末衰减型状态若在敌人阶段获得，新增层数记入 deferred。
 * 下一次 afterEnemyActions 只减少 deferred 之外的层数，然后把 deferred 转成正常层数。
 */
export function applyStatusStacks(
  statuses: readonly StatusInstance[],
  id: StatusId,
  amount: number,
  window: StatusApplyWindow,
): readonly StatusInstance[] {
  if (amount === 0) return statuses
  const timing = STATUS_DEFINITIONS[id].timing
  const deferAdded = amount > 0 && timing === 'endOfRound' && window === 'enemyPhase' ? amount : 0
  const index = statuses.findIndex((status) => status.id === id)
  if (index < 0) {
    if (amount < 0 && timing !== 'combat') return statuses
    return [...statuses, { id, amount, deferred: deferAdded }]
  }
  const current = statuses[index]
  if (!current) return statuses
  const nextAmount = current.amount + amount
  if (nextAmount === 0 || (nextAmount < 0 && timing !== 'combat')) {
    return statuses.filter((status) => status.id !== id)
  }
  const nextDeferred =
    timing === 'endOfRound' ? Math.min(Math.max(0, current.deferred + deferAdded), nextAmount) : 0
  const next: StatusInstance = { id, amount: nextAmount, deferred: nextDeferred }
  return statuses.map((status, itemIndex) => (itemIndex === index ? next : status))
}

/** 只有虚弱、易伤、脆弱在敌人行动之后衰减。中毒在回合开始单独减层。 */
export function tickStatuses(
  statuses: readonly StatusInstance[],
  moment: StatusTickMoment,
): readonly StatusInstance[] {
  if (moment !== 'afterEnemyActions' || statuses.length === 0) return statuses
  let changed = false
  const next: StatusInstance[] = []
  for (const status of statuses) {
    if (STATUS_DEFINITIONS[status.id].timing !== 'endOfRound') {
      next.push(status)
      continue
    }
    changed = true
    const updated = decayRoundStatus(status)
    if (updated) next.push(updated)
  }
  return changed ? next : statuses
}

export function tickCombatant<T extends Combatant>(combatant: T, moment: StatusTickMoment): T {
  const statuses = tickStatuses(combatant.statuses, moment)
  if (statuses === combatant.statuses) return combatant
  return { ...combatant, statuses }
}

export function diffStatusChanges(
  before: readonly StatusInstance[],
  after: readonly StatusInstance[],
): StatusChange[] {
  const changes: StatusChange[] = []
  for (const status of before) {
    const next = after.find((item) => item.id === status.id)
    if (!next) {
      changes.push({ status: status.id, kind: 'expired', amount: 0 })
      continue
    }
    if (next.amount !== status.amount || next.deferred !== status.deferred) {
      changes.push({ status: status.id, kind: 'ticked', amount: next.amount })
    }
  }
  return changes
}

function decayRoundStatus(status: StatusInstance): StatusInstance | null {
  const active = status.amount - status.deferred
  const nextActive = active > 0 ? active - 1 : 0
  const amount = nextActive + status.deferred
  if (amount <= 0) return null
  return { id: status.id, amount, deferred: 0 }
}
