import { describe, expect, it } from 'vitest'
import { CARD_DEFINITIONS, CARD_IDS, createStarterDeck } from './cards.ts'
import { ENERGY_PER_TURN } from './constants.ts'
import type { CardId } from './types.ts'

const expected: Record<CardId, { name: string; cost: number; text: string }> = {
  emberSlash: { name: '余烬斩', cost: 1, text: '造成 6 点伤害' },
  towerSmash: { name: '裂塔重击', cost: 2, text: '造成 13 点伤害' },
  ashFlurry: { name: '灰烬连斩', cost: 1, text: '造成 4 点伤害两次' },
  heartBurn: { name: '焚心一击', cost: 1, text: '造成 9 点伤害，对自己造成 2 点伤害' },
  emberSpear: { name: '烬矛突刺', cost: 0, text: '造成 3 点伤害' },
  ashShield: { name: '灰盾', cost: 1, text: '获得 5 点护甲' },
  towerWall: { name: '塔壁', cost: 2, text: '获得 11 点护甲' },
  emberArmor: { name: '烬甲', cost: 1, text: '获得 4 点护甲，抽 1 张牌' },
  gatherAsh: { name: '拾烬', cost: 1, text: '抽 2 张牌' },
  emberInsight: { name: '余火洞察', cost: 0, text: '抽 1 张牌' },
  returnFlame: { name: '回焰', cost: 0, text: '获得 1 点能量，消耗' },
  gatherFlame: { name: '聚焰', cost: 1, text: '获得 2 点能量' },
  drawBow: { name: '拉弓', cost: 2, text: '下一张攻击牌的基础命中率变为 100%' },
  emberArrow: { name: '烬矢', cost: 1, text: '造成 10 点伤害' },
  ruinArrow: { name: '破灭重矢', cost: 2, text: '造成 22 点伤害' },
  chainArrow: { name: '连珠烬箭', cost: 1, text: '造成 4 点伤害三次' },
  calibrate: { name: '校准', cost: 0, text: '最终命中率增加 20 个百分点' },
  riftMark: { name: '裂隙标记', cost: 1, text: '2 回合破绽' },
  scatteredShot: { name: '散矢', cost: 1, text: '造成 5 点伤害' },
  sureEdge: { name: '定锋', cost: 0, text: '必定命中' },
  tripleShot: { name: '三矢', cost: 1, text: '造成 3 点伤害三次' },
}

describe('卡牌定义', () => {
  it('包含 18 张不重复的原创卡牌', () => {
    expect(CARD_IDS).toHaveLength(18)
    expect(new Set(CARD_IDS).size).toBe(18)
    for (const id of CARD_IDS) {
      expect(CARD_DEFINITIONS[id].id).toBe(id)
      expect(CARD_DEFINITIONS[id].name).toBe(expected[id].name)
      expect(CARD_DEFINITIONS[id].cost).toBe(expected[id].cost)
      expect(CARD_DEFINITIONS[id].description).toContain(expected[id].text)
      expect(CARD_DEFINITIONS[id].cost).toBeLessThanOrEqual(ENERGY_PER_TURN)
    }
  })

  it('初始牌组是余烬斩×3、灰盾×3、烬矛突刺×1、回焰×1、拉弓×1、烬矢×1', () => {
    const deck = createStarterDeck()
    const counts = new Map<CardId, number>()
    for (const card of deck) counts.set(card.definitionId, (counts.get(card.definitionId) ?? 0) + 1)
    expect(deck).toHaveLength(10)
    expect(counts.get('emberSlash')).toBe(3)
    expect(counts.get('ashShield')).toBe(3)
    expect(counts.get('emberSpear')).toBe(1)
    expect(counts.get('returnFlame')).toBe(1)
    expect(counts.get('drawBow')).toBe(1)
    expect(counts.get('emberArrow')).toBe(1)
    expect(new Set(deck.map((card) => card.instanceId)).size).toBe(10)
  })

  it('原有 12 张牌仍没有状态效果，基础命中率保持 100%', () => {
    const original = [
      'emberSlash',
      'towerSmash',
      'ashFlurry',
      'heartBurn',
      'emberSpear',
      'ashShield',
      'towerWall',
      'emberArmor',
      'gatherAsh',
      'emberInsight',
      'returnFlame',
      'gatherFlame',
    ] as const satisfies readonly CardId[]
    expect(original).toHaveLength(12)
    for (const id of original) {
      expect(CARD_IDS).toContain(id)
      expect(CARD_DEFINITIONS[id].effects.some((effect) => effect.type === 'applyStatus')).toBe(false)
      expect(CARD_DEFINITIONS[id].accuracy ?? 100).toBe(100)
      expect(CARD_DEFINITIONS[id].cannotMiss ?? false).toBe(false)
    }
  })

  it('六张新牌进入正式卡池，散矢、定锋和三矢仍只作规则夹具', () => {
    const pool: readonly string[] = CARD_IDS
    expect(pool).toContain('drawBow')
    expect(pool).toContain('emberArrow')
    expect(pool).toContain('ruinArrow')
    expect(pool).toContain('chainArrow')
    expect(pool).toContain('calibrate')
    expect(pool).toContain('riftMark')
    expect(pool).not.toContain('scatteredShot')
    expect(pool).not.toContain('sureEdge')
    expect(pool).not.toContain('tripleShot')
    expect(Object.keys(CARD_DEFINITIONS).sort()).toEqual([...pool, 'scatteredShot', 'sureEdge', 'tripleShot'].sort())
    expect(CARD_DEFINITIONS.drawBow.cardType).toBe('skill')
    expect(CARD_DEFINITIONS.drawBow.effects).toEqual([
      { type: 'setNextAttackAccuracy', accuracy: 100 },
      { type: 'applyStatus', status: 'strength', amount: 1, target: 'self' },
    ])
    expect(CARD_DEFINITIONS.emberArrow.accuracy).toBe(75)
    expect(CARD_DEFINITIONS.emberArrow.effects).toEqual([{ type: 'damage', amount: 10, times: 1 }])
    expect(CARD_DEFINITIONS.ruinArrow.accuracy).toBe(60)
    expect(CARD_DEFINITIONS.ruinArrow.effects).toEqual([{ type: 'damage', amount: 22, times: 1 }])
    expect(CARD_DEFINITIONS.chainArrow.accuracy).toBe(80)
    expect(CARD_DEFINITIONS.chainArrow.effects).toEqual([{ type: 'damage', amount: 4, times: 3 }])
    expect(CARD_DEFINITIONS.calibrate.effects).toEqual([
      { type: 'applyStatus', status: 'aim', amount: 1, target: 'self' },
      { type: 'exhaust' },
    ])
    expect(CARD_DEFINITIONS.riftMark.effects).toEqual([
      { type: 'applyStatus', status: 'expose', amount: 2, target: 'enemy' },
      { type: 'draw', count: 1 },
    ])
    expect(CARD_DEFINITIONS.scatteredShot.accuracy).toBe(60)
    expect(CARD_DEFINITIONS.sureEdge.cannotMiss).toBe(true)
    expect(CARD_DEFINITIONS.tripleShot.effects).toEqual([{ type: 'damage', amount: 3, times: 3 }])
  })

  it('灰烬连斩是两次 4 点伤害，回焰会消耗', () => {
    expect(CARD_DEFINITIONS.ashFlurry.effects).toEqual([{ type: 'damage', amount: 4, times: 2 }])
    expect(CARD_DEFINITIONS.heartBurn.effects).toEqual([
      { type: 'damage', amount: 9, times: 1 },
      { type: 'selfDamage', amount: 2 },
    ])
    expect(CARD_DEFINITIONS.returnFlame.effects).toEqual([
      { type: 'gainEnergy', amount: 1 },
      { type: 'exhaust' },
    ])
  })
})
