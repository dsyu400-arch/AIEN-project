import {
  AIM_HIT_BONUS,
  DEFAULT_ATTACK_ACCURACY,
  EXPOSE_HIT_BONUS,
  HIT_CHANCE_MAX,
  HIT_CHANCE_MIN,
} from './constants.ts'
import { nextRng } from './rng.ts'
import { getStatus } from './status.ts'
import type { CardDefinition, Combatant, Player } from './types.ts'

export interface HitChance {
  base: number
  bonus: number
  penalty: number
  chance: number
  cannotMiss: boolean
}

/**
 * P = clamp(A + B - D, HIT_CHANCE_MIN, HIT_CHANCE_MAX)。
 * 必定命中不走这条公式。装备修正留到后续阶段，这里的 B 只含瞄准和破绽。
 */
export function finalHitChance(base: number, bonus: number, penalty: number, cannotMiss: boolean): number {
  if (cannotMiss) return HIT_CHANCE_MAX
  const raw = base + bonus - penalty
  if (raw < HIT_CHANCE_MIN) return HIT_CHANCE_MIN
  if (raw > HIT_CHANCE_MAX) return HIT_CHANCE_MAX
  return raw
}

export function attackHitChance(input: {
  baseAccuracy: number | undefined
  nextAttackAccuracy: number | null
  cannotMiss: boolean
  attacker: Combatant
  defender: Combatant
}): HitChance {
  const base = input.nextAttackAccuracy ?? input.baseAccuracy ?? DEFAULT_ATTACK_ACCURACY
  const aim = getStatus(input.attacker.statuses, 'aim')
  const expose = getStatus(input.defender.statuses, 'expose')
  const bonus =
    (aim && aim.amount > 0 ? AIM_HIT_BONUS : 0) + (expose && expose.amount > 0 ? EXPOSE_HIT_BONUS : 0)
  const penalty = Math.max(0, getStatus(input.defender.statuses, 'evasion')?.amount ?? 0)
  return {
    base,
    bonus,
    penalty,
    cannotMiss: input.cannotMiss,
    chance: finalHitChance(base, bonus, penalty, input.cannotMiss),
  }
}

/** 每个攻击段都推进一次命中序列，包括 100% 和必定命中，避免后面的判定忽前忽后。 */
export function judgeHit(
  hitRngState: number,
  chance: number,
  cannotMiss: boolean,
): { hitRngState: number; hit: boolean } {
  const rolled = nextRng(hitRngState)
  return {
    hitRngState: rolled.state,
    hit: cannotMiss || rolled.value < chance / 100,
  }
}

export function attackPreviewLabel(
  definition: CardDefinition,
  attacker: Player,
  defender: Combatant,
): string | null {
  const segments = definition.effects.reduce((total, effect) => {
    return effect.type === 'damage' ? total + effect.times : total
  }, 0)
  if (segments === 0) return null
  const profile = attackHitChance({
    baseAccuracy: definition.accuracy,
    nextAttackAccuracy: attacker.nextAttackAccuracy,
    cannotMiss: definition.cannotMiss === true,
    attacker,
    defender,
  })
  if (profile.cannotMiss) return segments > 1 ? '每段必定命中' : '必定命中'
  return segments > 1 ? `每段命中 ${profile.chance}%` : `命中 ${profile.chance}%`
}
