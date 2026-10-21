import { describe, expect, it } from 'vitest'
import { ENCOUNTERS, currentIntent } from './enemies.ts'
import { begin } from './test-utils.ts'

describe('敌人数据', () => {
  it('三场敌人的生命和行动循环与计划一致', () => {
    expect(ENCOUNTERS.map((encounter) => [encounter.name, encounter.maxHp, encounter.boss])).toEqual([
      ['灰卫', 36, false],
      ['烬狼', 48, false],
      ['塔主·残焰', 70, true],
    ])
    expect(ENCOUNTERS[0]?.pattern.map((intent) => intent.label)).toEqual(['攻击 8', '获得 6 点护甲', '攻击 11'])
    expect(ENCOUNTERS[1]?.pattern.map((intent) => intent.label)).toEqual(['攻击 7×2', '攻击 12', '获得 10 点护甲'])
    expect(ENCOUNTERS[2]?.pattern.map((intent) => intent.label)).toEqual([
      '攻击 10',
      '攻击 6，获得 12 点护甲',
      '攻击 18',
    ])
  })

  it('开局展示灰卫的第一个意图', () => {
    const state = begin()
    expect(state.enemy && currentIntent(state.enemy).label).toBe('攻击 8')
  })
})
