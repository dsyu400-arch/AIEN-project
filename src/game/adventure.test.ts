import { describe, expect, it } from 'vitest'
import { attackHitChance } from './accuracy.ts'
import { getCard } from './cards.ts'
import { modifyAttackDamage } from './damage.ts'
import { currentIntent } from './enemies.ts'
import { applyAction, createRun } from './run.ts'
import type { CardDefinition, CardId, RunState } from './types.ts'
import { must } from './test-utils.ts'

function damageOf(definition: CardDefinition): number {
  return definition.effects.reduce((total, effect) => {
    return effect.type === 'damage' ? total + effect.amount * effect.times : total
  }, 0)
}

function blockOf(definition: CardDefinition): number {
  return definition.effects.reduce((total, effect) => {
    return effect.type === 'block' ? total + effect.amount : total
  }, 0)
}

function killsSelf(definition: CardDefinition, hp: number): boolean {
  return definition.effects.some((effect) => effect.type === 'selfDamage' && effect.amount >= hp)
}

function expectedDamage(definition: CardDefinition, state: RunState): number {
  if (!state.enemy) return damageOf(definition)
  const profile = attackHitChance({
    baseAccuracy: definition.accuracy,
    nextAttackAccuracy: state.player.nextAttackAccuracy,
    cannotMiss: definition.cannotMiss === true,
    attacker: state.player,
    defender: state.enemy,
  })
  let total = 0
  for (const effect of definition.effects) {
    if (effect.type !== 'damage') continue
    total += modifyAttackDamage(effect.amount, state.player, state.enemy) * effect.times * (profile.chance / 100)
  }
  return total
}

function playOutTurn(state: RunState): RunState {
  let current = state
  for (let step = 0; step < 30 && current.phase === 'playerTurn'; step += 1) {
    const threat = current.enemy
      ? Math.max(0, currentIntent(current.enemy).damage * currentIntent(current.enemy).times - current.player.block)
      : 0
    const playable = current.hand
      .map((item) => ({ item, definition: getCard(item.definitionId) }))
      .filter((entry) => entry.definition.cost <= current.player.energy)
      .filter((entry) => !killsSelf(entry.definition, current.player.hp))
    if (playable.length === 0) break

    const blocks = playable.filter((entry) => blockOf(entry.definition) > 0)
    const attacks = playable.filter((entry) => damageOf(entry.definition) > 0)
    const utility = playable.filter((entry) =>
      entry.definition.effects.some((effect) =>
        effect.type === 'draw' || effect.type === 'gainEnergy' || effect.type === 'applyStatus' || effect.type === 'setNextAttackAccuracy',
      ),
    )
    const setup = playable.find((entry) => entry.definition.effects.some((effect) => effect.type === 'setNextAttackAccuracy'))
    const attackAfterSetup = setup
      ? attacks.some((entry) => entry.definition.cost <= current.player.energy - setup.definition.cost)
      : false
    const choice =
      (threat > 0 ? blocks.sort((left, right) => blockOf(right.definition) - blockOf(left.definition))[0] : undefined) ??
      (attackAfterSetup ? setup : undefined) ??
      attacks.sort((left, right) => expectedDamage(right.definition, current) - expectedDamage(left.definition, current))[0] ??
      utility[0] ??
      playable[0]
    if (!choice) break
    const played = applyAction(current, { type: 'playCard', instanceId: choice.item.instanceId })
    if (!played.ok) break
    current = played.state
  }
  if (current.phase !== 'playerTurn') return current
  return must(applyAction(current, { type: 'endTurn' }))
}

function fight(state: RunState): RunState {
  let current = state
  for (let turn = 0; turn < 40 && current.phase === 'playerTurn'; turn += 1) {
    current = playOutTurn(current)
  }
  return current
}

function adventure(seed: number): { phase: RunState['phase']; rewards: CardId[]; hp: number; deck: number } {
  let state = must(applyAction(createRun(seed), { type: 'startRun' }))
  const rewards: CardId[] = []
  for (let battle = 0; battle < 3 && state.phase !== 'victory' && state.phase !== 'defeat'; battle += 1) {
    state = fight(state)
    if (state.phase !== 'reward') break
    const choice = state.rewardOptions[0]
    if (!choice) break
    rewards.push(choice)
    const hp = state.player.hp
    state = must(applyAction(state, { type: 'chooseReward', definitionId: choice }))
    if (state.player.hp !== hp) {
      throw new Error('领取奖励时不应再次回复生命')
    }
  }
  return { phase: state.phase, rewards, hp: state.player.hp, deck: state.deck.length }
}

describe('完整冒险', () => {
  it('用固定种子打完三场战斗并通关', () => {
    const finished = adventure(1)
    expect(finished.phase).toBe('victory')
    expect(finished.rewards).toHaveLength(2)
    expect(new Set(finished.rewards).size).toBe(finished.rewards.length)
    expect(finished.deck).toBe(12)
    expect(finished.hp).toBeGreaterThan(0)
    expect(finished.hp).toBeLessThanOrEqual(50)
  })

  it('同一条冒险流程可以复现', () => {
    expect(adventure(1)).toEqual(adventure(1))
  })
})
