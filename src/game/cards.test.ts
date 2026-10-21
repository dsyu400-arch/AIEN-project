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
}

describe('卡牌定义', () => {
  it('包含 12 张不重复的原创卡牌', () => {
    expect(CARD_IDS).toHaveLength(12)
    expect(new Set(CARD_IDS).size).toBe(12)
    for (const id of CARD_IDS) {
      expect(CARD_DEFINITIONS[id].id).toBe(id)
      expect(CARD_DEFINITIONS[id].name).toBe(expected[id].name)
      expect(CARD_DEFINITIONS[id].cost).toBe(expected[id].cost)
      expect(CARD_DEFINITIONS[id].description).toContain(expected[id].text)
      expect(CARD_DEFINITIONS[id].cost).toBeLessThanOrEqual(ENERGY_PER_TURN)
    }
  })

  it('初始牌组是余烬斩×4、灰盾×4、烬矛突刺×1、回焰×1', () => {
    const deck = createStarterDeck()
    const counts = new Map<CardId, number>()
    for (const card of deck) counts.set(card.definitionId, (counts.get(card.definitionId) ?? 0) + 1)
    expect(deck).toHaveLength(10)
    expect(counts.get('emberSlash')).toBe(4)
    expect(counts.get('ashShield')).toBe(4)
    expect(counts.get('emberSpear')).toBe(1)
    expect(counts.get('returnFlame')).toBe(1)
    expect(new Set(deck.map((card) => card.instanceId)).size).toBe(10)
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
