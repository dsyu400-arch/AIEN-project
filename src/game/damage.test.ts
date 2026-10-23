import { describe, expect, it } from 'vitest'
import { applyAttackHits, applyHpLoss, modifyAttackDamage, modifyBlockGain } from './damage.ts'
import { consumePoison } from './status.ts'
import type { Combatant, StatusInstance } from './types.ts'

function fighter(block: number, hp = 20, statuses: readonly StatusInstance[] = []): Combatant {
  return { hp, maxHp: 40, block, statuses }
}

function stacks(id: StatusInstance['id'], amount: number): StatusInstance {
  return { id, amount, deferred: 0 }
}

describe('状态修正', () => {
  const foe = fighter(0, 30)

  it('按力量、虚弱、易伤的顺序修正，并且只在最后向下取整', () => {
    expect(modifyAttackDamage(5, fighter(0, 20, [stacks('strength', 2)]), foe)).toBe(7)
    expect(modifyAttackDamage(5, fighter(0, 20, [stacks('weak', 1)]), foe)).toBe(3)
    expect(modifyAttackDamage(5, fighter(0, 20, [stacks('weak', 2)]), fighter(0, 30, [stacks('vulnerable', 1)]))).toBe(5)
    expect(modifyAttackDamage(4, fighter(0, 20, [stacks('strength', 3)]), foe)).toBe(7)
    expect(modifyAttackDamage(1, fighter(0, 20, [stacks('weak', 1)]), foe)).toBe(0)
    expect(modifyAttackDamage(3, fighter(0, 20, [stacks('strength', -5)]), foe)).toBe(0)
  })

  it('卡牌格挡先加敏捷，再按脆弱取整', () => {
    expect(modifyBlockGain(5, fighter(0, 20, [stacks('dexterity', 2), stacks('frail', 1)]))).toBe(5)
    expect(modifyBlockGain(5, fighter(0, 20, [stacks('dexterity', 2)]))).toBe(7)
    expect(modifyBlockGain(5, fighter(0, 20, [stacks('dexterity', -8)]))).toBe(0)
  })
})

describe('伤害结算', () => {
  it('多段攻击逐段打穿护甲，而不是先把伤害加总', () => {
    const result = applyAttackHits(fighter(5), 4, 2)
    expect(result.hits).toEqual([
      { amount: 4, blocked: 4, hpLoss: 0 },
      { amount: 4, blocked: 1, hpLoss: 3 },
    ])
    expect(result.combatant.block).toBe(0)
    expect(result.combatant.hp).toBe(17)
  })

  it('不会修改原来的战斗单位', () => {
    const original = fighter(5)
    applyAttackHits(original, 4, 2)
    expect(original.hp).toBe(20)
    expect(original.block).toBe(5)
  })

  it('生命损失不消耗护甲，并且生命不低于 0', () => {
    const blocked = applyHpLoss(fighter(9, 4), 2)
    expect(blocked.hpLoss).toBe(2)
    expect(blocked.combatant.hp).toBe(2)
    expect(blocked.combatant.block).toBe(9)
    const lethal = applyHpLoss(blocked.combatant, 5)
    expect(lethal.hpLoss).toBe(2)
    expect(lethal.combatant.hp).toBe(0)
  })

  it('中毒扣血不消耗护甲', () => {
    const poisoned = fighter(9, 20, [stacks('poison', 4)])
    const consumed = consumePoison(poisoned.statuses)
    expect(consumed?.damage).toBe(4)
    const hurt = applyHpLoss({ ...poisoned, statuses: consumed?.statuses ?? [] }, consumed?.damage ?? 0)
    expect(hurt.combatant.hp).toBe(16)
    expect(hurt.combatant.block).toBe(9)
    expect(hurt.combatant.statuses).toEqual([stacks('poison', 3)])
  })

  it('没有造成生命损失时返回原来的对象', () => {
    const original = fighter(0, 0)
    expect(applyHpLoss(original, 3).combatant).toBe(original)
  })
})
