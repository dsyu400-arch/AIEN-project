import type { CardDefinition, CardId, CardInstance } from './types.ts'

export const CARD_IDS = [
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

export const CARD_DEFINITIONS: Record<CardId, CardDefinition> = {
  emberSlash: {
    id: 'emberSlash',
    name: '余烬斩',
    cost: 1,
    cardType: 'attack',
    description: '造成 6 点伤害。',
    effects: [{ type: 'damage', amount: 6, times: 1 }],
  },
  towerSmash: {
    id: 'towerSmash',
    name: '裂塔重击',
    cost: 2,
    cardType: 'attack',
    description: '造成 13 点伤害。',
    effects: [{ type: 'damage', amount: 13, times: 1 }],
  },
  ashFlurry: {
    id: 'ashFlurry',
    name: '灰烬连斩',
    cost: 1,
    cardType: 'attack',
    description: '造成 4 点伤害两次。',
    effects: [{ type: 'damage', amount: 4, times: 2 }],
  },
  heartBurn: {
    id: 'heartBurn',
    name: '焚心一击',
    cost: 1,
    cardType: 'attack',
    description: '造成 9 点伤害，对自己造成 2 点伤害。',
    effects: [
      { type: 'damage', amount: 9, times: 1 },
      { type: 'selfDamage', amount: 2 },
    ],
  },
  emberSpear: {
    id: 'emberSpear',
    name: '烬矛突刺',
    cost: 0,
    cardType: 'attack',
    description: '造成 3 点伤害。',
    effects: [{ type: 'damage', amount: 3, times: 1 }],
  },
  ashShield: {
    id: 'ashShield',
    name: '灰盾',
    cost: 1,
    cardType: 'skill',
    description: '获得 5 点护甲。',
    effects: [{ type: 'block', amount: 5 }],
  },
  towerWall: {
    id: 'towerWall',
    name: '塔壁',
    cost: 2,
    cardType: 'skill',
    description: '获得 11 点护甲。',
    effects: [{ type: 'block', amount: 11 }],
  },
  emberArmor: {
    id: 'emberArmor',
    name: '烬甲',
    cost: 1,
    cardType: 'skill',
    description: '获得 4 点护甲，抽 1 张牌。',
    effects: [
      { type: 'block', amount: 4 },
      { type: 'draw', count: 1 },
    ],
  },
  gatherAsh: {
    id: 'gatherAsh',
    name: '拾烬',
    cost: 1,
    cardType: 'skill',
    description: '抽 2 张牌。',
    effects: [{ type: 'draw', count: 2 }],
  },
  emberInsight: {
    id: 'emberInsight',
    name: '余火洞察',
    cost: 0,
    cardType: 'skill',
    description: '抽 1 张牌。',
    effects: [{ type: 'draw', count: 1 }],
  },
  returnFlame: {
    id: 'returnFlame',
    name: '回焰',
    cost: 0,
    cardType: 'skill',
    description: '获得 1 点能量，消耗。',
    effects: [{ type: 'gainEnergy', amount: 1 }, { type: 'exhaust' }],
  },
  gatherFlame: {
    id: 'gatherFlame',
    name: '聚焰',
    cost: 1,
    cardType: 'skill',
    description: '获得 2 点能量。',
    effects: [{ type: 'gainEnergy', amount: 2 }],
  },
  drawBow: {
    id: 'drawBow',
    name: '拉弓',
    cost: 2,
    cardType: 'skill',
    description: '下一张攻击牌的基础命中率变为 100%。获得 1 层力量。',
    effects: [
      { type: 'setNextAttackAccuracy', accuracy: 100 },
      { type: 'applyStatus', status: 'strength', amount: 1, target: 'self' },
    ],
  },
  scatteredShot: {
    id: 'scatteredShot',
    name: '散矢',
    cost: 1,
    cardType: 'attack',
    accuracy: 60,
    description: '造成 5 点伤害。命中时施加 1 层易伤，失手时获得 3 点护甲。',
    effects: [
      {
        type: 'damage',
        amount: 5,
        times: 1,
        onHit: [{ type: 'applyStatus', status: 'vulnerable', amount: 1, target: 'enemy' }],
        onMiss: [{ type: 'block', amount: 3 }],
      },
    ],
  },
  sureEdge: {
    id: 'sureEdge',
    name: '定锋',
    cost: 0,
    cardType: 'attack',
    cannotMiss: true,
    description: '必定命中。造成 4 点伤害。',
    effects: [{ type: 'damage', amount: 4, times: 1 }],
  },
  tripleShot: {
    id: 'tripleShot',
    name: '三矢',
    cost: 1,
    cardType: 'attack',
    accuracy: 50,
    description: '造成 3 点伤害三次。每一段单独判定命中。',
    effects: [{ type: 'damage', amount: 3, times: 3 }],
  },
}

const STARTER_IDS = [
  'emberSlash',
  'emberSlash',
  'emberSlash',
  'emberSlash',
  'ashShield',
  'ashShield',
  'ashShield',
  'ashShield',
  'emberSpear',
  'returnFlame',
] as const satisfies readonly CardId[]

export function createStarterDeck(): CardInstance[] {
  return STARTER_IDS.map((definitionId, index) => ({
    instanceId: `${definitionId}-${index + 1}`,
    definitionId,
  }))
}

export function getCard(id: CardId): CardDefinition {
  return CARD_DEFINITIONS[id]
}
