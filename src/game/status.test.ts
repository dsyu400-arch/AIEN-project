import { describe, expect, it } from 'vitest'
import { applyStatusStacks, consumeAim, consumePoison, describeStatus, getStatus, tickStatuses } from './status.ts'
import type { StatusId, StatusInstance } from './types.ts'

function amountOf(statuses: readonly StatusInstance[], id: StatusId): number | undefined {
  return getStatus(statuses, id)?.amount
}

describe('状态时序', () => {
  it('敌人阶段刚施加的虚弱会跳过紧接着的那一次衰减，且不会因此多留一轮', () => {
    let statuses = applyStatusStacks([], 'weak', 2, 'enemyPhase')
    expect(getStatus(statuses, 'weak')).toEqual({ id: 'weak', amount: 2, deferred: 2 })

    statuses = tickStatuses(statuses, 'enemyTurnStart')
    statuses = tickStatuses(statuses, 'playerTurnStart')
    expect(amountOf(statuses, 'weak')).toBe(2)

    statuses = tickStatuses(statuses, 'afterEnemyActions')
    expect(getStatus(statuses, 'weak')).toEqual({ id: 'weak', amount: 2, deferred: 0 })

    statuses = tickStatuses(statuses, 'afterEnemyActions')
    expect(amountOf(statuses, 'weak')).toBe(1)
    statuses = tickStatuses(statuses, 'afterEnemyActions')
    expect(getStatus(statuses, 'weak')).toBeUndefined()
  })

  it('易伤 1 若在玩家阶段获得，敌人行动后就消失，不会再留到下一次玩家攻击', () => {
    let statuses = applyStatusStacks([], 'vulnerable', 1, 'playerPhase')
    expect(getStatus(statuses, 'vulnerable')).toEqual({ id: 'vulnerable', amount: 1, deferred: 0 })
    statuses = tickStatuses(statuses, 'enemyTurnStart')
    expect(amountOf(statuses, 'vulnerable')).toBe(1)
    statuses = tickStatuses(statuses, 'afterEnemyActions')
    expect(getStatus(statuses, 'vulnerable')).toBeUndefined()
  })

  it('玩家阶段获得的易伤 2 会在两次敌人行动后消失', () => {
    let statuses = applyStatusStacks([], 'vulnerable', 2, 'playerPhase')
    statuses = tickStatuses(statuses, 'afterEnemyActions')
    expect(amountOf(statuses, 'vulnerable')).toBe(1)
    statuses = tickStatuses(statuses, 'afterEnemyActions')
    expect(getStatus(statuses, 'vulnerable')).toBeUndefined()
  })

  it('新施加的层数不会让原来的层数一起跳过衰减', () => {
    let statuses = applyStatusStacks([], 'frail', 3, 'playerPhase')
    statuses = applyStatusStacks(statuses, 'frail', 1, 'enemyPhase')
    expect(getStatus(statuses, 'frail')).toEqual({ id: 'frail', amount: 4, deferred: 1 })
    statuses = tickStatuses(statuses, 'afterEnemyActions')
    expect(getStatus(statuses, 'frail')).toEqual({ id: 'frail', amount: 3, deferred: 0 })
  })

  it('同一次敌人阶段里的两次施加都会跳过本次衰减', () => {
    let statuses = applyStatusStacks([], 'weak', 1, 'enemyPhase')
    statuses = applyStatusStacks(statuses, 'weak', 1, 'enemyPhase')
    statuses = tickStatuses(statuses, 'afterEnemyActions')
    expect(getStatus(statuses, 'weak')).toEqual({ id: 'weak', amount: 2, deferred: 0 })
  })

  it('回合开始不会减少虚弱、易伤或脆弱', () => {
    const ids = ['weak', 'vulnerable', 'frail'] as const
    for (const id of ids) {
      const statuses = applyStatusStacks([], id, 2, 'playerPhase')
      expect(amountOf(tickStatuses(statuses, 'playerTurnStart'), id)).toBe(2)
      expect(amountOf(tickStatuses(statuses, 'enemyTurnStart'), id)).toBe(2)
    }
  })

  it('回合末不会减少中毒、力量、瞄准或闪避', () => {
    const ids = ['poison', 'strength', 'aim', 'evasion'] as const
    for (const id of ids) {
      let statuses = applyStatusStacks([], id, 3, 'enemyPhase')
      statuses = tickStatuses(statuses, 'enemyTurnStart')
      statuses = tickStatuses(statuses, 'afterEnemyActions')
      statuses = tickStatuses(statuses, 'playerTurnStart')
      expect(getStatus(statuses, id)).toEqual({ id, amount: 3, deferred: 0 })
    }
  })

  it('破绽按回合衰减，重复施加只增加回合', () => {
    let statuses = applyStatusStacks([], 'expose', 1, 'playerPhase')
    expect(getStatus(statuses, 'expose')).toEqual({ id: 'expose', amount: 1, deferred: 0 })
    statuses = tickStatuses(statuses, 'afterEnemyActions')
    expect(getStatus(statuses, 'expose')).toBeUndefined()

    statuses = applyStatusStacks([], 'expose', 1, 'playerPhase')
    statuses = applyStatusStacks(statuses, 'expose', 1, 'playerPhase')
    expect(amountOf(statuses, 'expose')).toBe(2)
    statuses = tickStatuses(statuses, 'afterEnemyActions')
    expect(amountOf(statuses, 'expose')).toBe(1)
  })

  it('负力量可以保留，降到 0 时移除', () => {
    let statuses = applyStatusStacks([], 'strength', -2, 'playerPhase')
    expect(getStatus(statuses, 'strength')).toEqual({ id: 'strength', amount: -2, deferred: 0 })
    statuses = applyStatusStacks(statuses, 'strength', 1, 'playerPhase')
    expect(amountOf(statuses, 'strength')).toBe(-1)
    statuses = applyStatusStacks(statuses, 'strength', 1, 'playerPhase')
    expect(getStatus(statuses, 'strength')).toBeUndefined()
    expect(tickStatuses(applyStatusStacks([], 'strength', -3, 'enemyPhase'), 'afterEnemyActions')).toEqual([
      { id: 'strength', amount: -3, deferred: 0 },
    ])
  })

  it('中毒先按当前层数结算，再减 1，降到 0 时移除', () => {
    const first = consumePoison([{ id: 'poison', amount: 4, deferred: 0 }])
    expect(first).toEqual({ damage: 4, statuses: [{ id: 'poison', amount: 3, deferred: 0 }] })
    const last = consumePoison([{ id: 'poison', amount: 1, deferred: 0 }])
    expect(last).toEqual({ damage: 1, statuses: [] })
    expect(consumePoison([])).toBeNull()
  })

  it('瞄准按次数显示，打出攻击牌才减少；破绽按回合显示', () => {
    expect(describeStatus({ id: 'aim', amount: 2, deferred: 0 }).amountLabel).toBe('2 次')
    expect(describeStatus({ id: 'expose', amount: 2, deferred: 0 }).amountLabel).toBe('2 回合')
    expect(describeStatus({ id: 'evasion', amount: 10, deferred: 0 }).amountLabel).toBe('10 层')
    expect(consumeAim([{ id: 'aim', amount: 2, deferred: 0 }])).toEqual([{ id: 'aim', amount: 1, deferred: 0 }])
    expect(consumeAim([{ id: 'aim', amount: 1, deferred: 0 }])).toEqual([])
    expect(consumeAim([])).toEqual([])
  })

  it('没有需要衰减的状态时返回原数组', () => {
    const statuses = applyStatusStacks([], 'strength', 1, 'playerPhase')
    expect(tickStatuses(statuses, 'afterEnemyActions')).toBe(statuses)
    expect(tickStatuses([], 'afterEnemyActions')).toEqual([])
    expect(applyStatusStacks(statuses, 'strength', 0, 'playerPhase')).toBe(statuses)
  })
})
