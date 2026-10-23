import { getStatus } from './status.ts'
import type { Combatant } from './types.ts'

export interface AttackHit {
  amount: number
  blocked: number
  hpLoss: number
}

export interface AttackHitResult<T extends Combatant> {
  combatant: T
  hits: AttackHit[]
}

/**
 * 基础伤害 + 力量，再乘虚弱和易伤，最后向下取整一次。
 * 负数归零。调用方必须对每一段单独调用。
 */
export function modifyAttackDamage(base: number, attacker: Combatant, defender: Combatant): number {
  let value = base + (getStatus(attacker.statuses, 'strength')?.amount ?? 0)
  if ((getStatus(attacker.statuses, 'weak')?.amount ?? 0) > 0) value *= 0.75
  if ((getStatus(defender.statuses, 'vulnerable')?.amount ?? 0) > 0) value *= 1.5
  if (value < 0) value = 0
  return Math.floor(value)
}

/** 只用于卡牌获得的格挡：基础 + 敏捷，脆弱再乘 0.75，最后向下取整一次。 */
export function modifyBlockGain(base: number, actor: Combatant): number {
  let value = base + (getStatus(actor.statuses, 'dexterity')?.amount ?? 0)
  if ((getStatus(actor.statuses, 'frail')?.amount ?? 0) > 0) value *= 0.75
  if (value < 0) value = 0
  return Math.floor(value)
}

/** 每一段单独扣护甲再扣生命。传入的 amount 应已是修正后的整数。 */
export function applyAttackHits<T extends Combatant>(
  combatant: T,
  amount: number,
  times: number,
): AttackHitResult<T> {
  let current = combatant
  const hits: AttackHit[] = []
  for (let hit = 0; hit < times; hit += 1) {
    const blocked = Math.min(current.block, amount)
    const hpLoss = amount - blocked
    current = {
      ...current,
      block: current.block - blocked,
      hp: Math.max(0, current.hp - hpLoss),
    }
    hits.push({ amount, blocked, hpLoss })
  }
  return { combatant: current, hits }
}

/** 直接扣生命，不看护甲。焚心一击的自伤走这里。 */
export function applyHpLoss<T extends Combatant>(combatant: T, amount: number): { combatant: T; hpLoss: number } {
  const hpLoss = Math.min(combatant.hp, Math.max(0, amount))
  if (hpLoss === 0) return { combatant, hpLoss: 0 }
  return {
    combatant: { ...combatant, hp: combatant.hp - hpLoss },
    hpLoss,
  }
}
