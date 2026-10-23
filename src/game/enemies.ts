import type { Enemy, Intent } from './types.ts'

export interface Encounter {
  id: string
  name: string
  maxHp: number
  boss: boolean
  /** 开局闪避层数。每层使受到的攻击命中率降低 1 个百分点，0 表示没有闪避状态。 */
  evasion: number
  pattern: readonly Intent[]
}

const ashGuardPattern: readonly Intent[] = [
  { kind: 'attack', damage: 8, times: 1, block: 0, label: '攻击 8' },
  { kind: 'block', damage: 0, times: 0, block: 6, label: '获得 6 点护甲' },
  { kind: 'attack', damage: 11, times: 1, block: 0, label: '攻击 11' },
]

const emberWolfPattern: readonly Intent[] = [
  { kind: 'attack', damage: 7, times: 2, block: 0, label: '攻击 7×2' },
  { kind: 'attack', damage: 12, times: 1, block: 0, label: '攻击 12' },
  { kind: 'block', damage: 0, times: 0, block: 10, label: '获得 10 点护甲' },
]

const towerLordPattern: readonly Intent[] = [
  { kind: 'attack', damage: 10, times: 1, block: 0, label: '攻击 10' },
  { kind: 'attackBlock', damage: 6, times: 1, block: 12, label: '攻击 6，获得 12 点护甲' },
  { kind: 'attack', damage: 18, times: 1, block: 0, label: '攻击 18' },
]

export const ENCOUNTERS: readonly Encounter[] = [
  { id: 'ashGuard', name: '灰卫', maxHp: 36, boss: false, evasion: 0, pattern: ashGuardPattern },
  { id: 'emberWolf', name: '烬狼', maxHp: 48, boss: false, evasion: 10, pattern: emberWolfPattern },
  { id: 'towerLord', name: '塔主·残焰', maxHp: 70, boss: true, evasion: 15, pattern: towerLordPattern },
]

export function createEnemy(battleIndex: number): Enemy {
  const encounter = ENCOUNTERS[battleIndex]
  if (!encounter) {
    throw new Error(`未知战斗：${battleIndex}`)
  }
  return {
    id: encounter.id,
    name: encounter.name,
    boss: encounter.boss,
    hp: encounter.maxHp,
    maxHp: encounter.maxHp,
    block: 0,
    statuses: encounter.evasion > 0 ? [{ id: 'evasion', amount: encounter.evasion, deferred: 0 }] : [],
    pattern: encounter.pattern.map((intent) => ({ ...intent })),
    patternIndex: 0,
  }
}

export function currentIntent(enemy: Enemy): Intent {
  const index = enemy.patternIndex % enemy.pattern.length
  return enemy.pattern[index] as Intent
}
