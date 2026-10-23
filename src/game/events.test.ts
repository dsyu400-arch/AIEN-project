import { describe, expect, it } from 'vitest'
import { EVENT_BUFFER_LIMIT } from './constants.ts'
import { appendEvents, formatEventLog } from './events.ts'
import type { CombatEventDraft } from './events.ts'
import { createRun } from './run.ts'
import type { CombatEvent } from './types.ts'

function played(index: number): CombatEventDraft {
  return {
    type: 'cardPlayed',
    name: `牌${index}`,
    instanceId: `card-${index}`,
    definitionId: 'emberSlash',
    cost: 1,
  }
}

describe('战斗事件', () => {
  it('沿用现有战斗记录句子', () => {
    const lines = [
      formatEventLog({ id: 1, type: 'cardPlayed', name: '余烬斩', instanceId: 'slash', definitionId: 'emberSlash', cost: 1 }),
      formatEventLog({ id: 2, type: 'damageEffect', name: '余烬斩', amount: 6, times: 1, target: { side: 'enemy', id: 'ashGuard' } }),
      formatEventLog({ id: 3, type: 'blockGained', name: '灰盾', target: { side: 'player' }, amount: 5, logged: true }),
      formatEventLog({ id: 4, type: 'energyGained', name: '聚焰', amount: 2 }),
      formatEventLog({ id: 5, type: 'selfDamage', name: '焚心一击', amount: 2, hpLoss: 2 }),
      formatEventLog({ id: 6, type: 'intentResolved', name: '灰卫', label: '攻击 8' }),
      formatEventLog({ id: 7, type: 'healed', amount: 8 }),
      formatEventLog({ id: 8, type: 'defeated', target: { side: 'player' } }),
      formatEventLog({ id: 9, type: 'victory' }),
    ]
    expect(lines).toEqual([
      '打出余烬斩',
      '余烬斩造成 6 点伤害，共 1 次',
      '灰盾获得 5 点护甲',
      '聚焰获得 2 点能量',
      '焚心一击对自己造成 2 点伤害',
      '灰卫：攻击 8',
      '回复 8 点生命',
      '你倒下了',
      '你登上了塔顶',
    ])
  })

  it('伤害明细和敌人获得护甲不额外写入战斗记录', () => {
    const silent: CombatEvent[] = [
      {
        id: 1,
        type: 'damageDealt',
        source: { side: 'player' },
        target: { side: 'enemy', id: 'ashGuard' },
        damageType: 'attack',
        amount: 6,
        blocked: 6,
        hpLoss: 0,
        hitIndex: 0,
      },
      { id: 2, type: 'blockGained', name: '灰卫', target: { side: 'enemy', id: 'ashGuard' }, amount: 6, logged: false },
      { id: 3, type: 'statusExpired', target: { side: 'player' }, status: 'vulnerable' },
    ]
    expect(silent.map((event) => formatEventLog(event))).toEqual([null, null, null])
  })

  it('事件编号递增，缓冲区只丢掉最旧的事件', () => {
    const filled = appendEvents(createRun(1), Array.from({ length: EVENT_BUFFER_LIMIT + 6 }, (_, index) => played(index)))
    expect(filled.events).toHaveLength(EVENT_BUFFER_LIMIT)
    expect(filled.events[0]?.id).toBe(7)
    expect(filled.events.at(-1)?.id).toBe(EVENT_BUFFER_LIMIT + 6)
    expect(filled.eventSeq).toBe(EVENT_BUFFER_LIMIT + 7)

    const extended = appendEvents(filled, [played(999)])
    expect(extended.events).toHaveLength(EVENT_BUFFER_LIMIT)
    expect(extended.events[0]?.id).toBe(8)
    expect(extended.events.at(-1)?.id).toBe(EVENT_BUFFER_LIMIT + 7)
    expect(extended.events.map((event) => event.id)).toEqual(
      Array.from({ length: EVENT_BUFFER_LIMIT }, (_, index) => index + 8),
    )
  })

  it('没有新事件时保持原状态', () => {
    const state = createRun(1)
    expect(appendEvents(state, [])).toBe(state)
  })
})
