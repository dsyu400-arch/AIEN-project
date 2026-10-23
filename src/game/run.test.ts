import { describe, expect, it } from 'vitest'
import { CARD_IDS } from './cards.ts'
import { nextRng } from './rng.ts'
import { applyAction, createRun } from './run.ts'
import type { CardId, RunState } from './types.ts'
import { begin, card, must, pileIds, play, prepare } from './test-utils.ts'

/** 塔主闪避 15 时仍会命中的随机数。流程测试要的是击倒后的奖励，不是这一下是否失手。 */
function connectingHit(): number {
  let state = 1
  for (let attempt = 0; attempt < 100000; attempt += 1) {
    const rolled = nextRng(state)
    if (rolled.value < 0.85) return state
    state = (state + 1) >>> 0
  }
  throw new Error('找不到命中随机数')
}

function winWithSlash(state: RunState, hp = state.player.hp): RunState {
  const slash = card('emberSlash', 'finisher')
  return play(
    prepare(state, { hand: [slash], energy: 1, playerHp: hp, enemyHp: 6, enemyBlock: 0, hitRngState: connectingHit() }),
    'finisher',
  )
}

describe('冒险流程', () => {
  it('开局处于菜单，生命 50，主牌组 10 张', () => {
    const state = createRun(3)
    expect(state.phase).toBe('menu')
    expect(state.player.hp).toBe(50)
    expect(state.player.maxEnergy).toBe(3)
    expect(state.deck).toHaveLength(10)
    expect(state.battleIndex).toBe(0)
    expect(state.enemy).toBeNull()
  })

  it('菜单之外不能开始，失败后不能再结束回合', () => {
    const menu = createRun(1)
    const started = begin(1)
    const rejected = applyAction(started, { type: 'startRun' })
    expect(rejected.ok).toBe(false)
    expect(rejected.state).toBe(started)

    const doomed = prepare(started, { playerHp: 8, playerBlock: 0 })
    const defeated = must(applyAction(doomed, { type: 'endTurn' }))
    expect(defeated.phase).toBe('defeat')
    expect(defeated.player.hp).toBe(0)
    expect(defeated.hand).toHaveLength(0)
    expect(defeated.turn).toBe(1)
    expect(defeated.rewardOptions).toHaveLength(0)
    const again = applyAction(defeated, { type: 'endTurn' })
    expect(again.ok).toBe(false)
    expect(again.state).toBe(defeated)
    expect(again.state.rngState).toBe(defeated.rngState)
    expect(menu.phase).toBe('menu')
  })

  it('第一关和第二关各回复 8 点生命，且只回复一次', () => {
    const first = winWithSlash(begin(), 20)
    expect(first.phase).toBe('reward')
    expect(first.player.hp).toBe(28)
    expect(first.rewardOptions).toHaveLength(3)
    expect(new Set(first.rewardOptions).size).toBe(3)
    const repeated = applyAction(first, { type: 'playCard', instanceId: 'finisher' })
    expect(repeated.state).toBe(first)
    expect(repeated.state.player.hp).toBe(28)

    const choice = first.rewardOptions[0] as CardId
    const secondBattle = must(applyAction(first, { type: 'chooseReward', definitionId: choice }))
    expect(secondBattle.player.hp).toBe(28)
    expect(secondBattle.battleIndex).toBe(1)
    expect(secondBattle.enemy?.name).toBe('烬狼')
    expect(secondBattle.enemy?.statuses).toEqual([{ id: 'evasion', amount: 10, deferred: 0 }])
    expect(secondBattle.deck).toHaveLength(11)
    expect(pileIds(secondBattle)).toEqual(secondBattle.deck.map((item) => item.instanceId).sort())

    const second = winWithSlash(secondBattle, 10)
    expect(second.phase).toBe('reward')
    expect(second.player.hp).toBe(18)
    const afterPick = must(applyAction(second, { type: 'chooseReward', definitionId: second.rewardOptions[0] as CardId }))
    expect(afterPick.player.hp).toBe(18)
  })

  it('满血胜利后仍为 50', () => {
    const state = winWithSlash(begin(), 50)
    expect(state.phase).toBe('reward')
    expect(state.player.hp).toBe(50)
  })

  it('回复不超过 50', () => {
    expect(winWithSlash(begin(), 45).player.hp).toBe(50)
    expect(winWithSlash(begin(), 42).player.hp).toBe(50)
  })

  it('错误的奖励不会改变状态', () => {
    const reward = winWithSlash(begin(), 30)
    const missing = CARD_IDS.find((id) => !reward.rewardOptions.includes(id))
    expect(missing).toBeDefined()
    const rejected = applyAction(reward, { type: 'chooseReward', definitionId: missing as CardId })
    expect(rejected.ok).toBe(false)
    if (rejected.ok) return
    expect(rejected.reason).toBe('这张牌不在奖励中')
    expect(rejected.state).toBe(reward)
    expect(rejected.state.rngState).toBe(reward.rngState)
  })

  it('同一个种子的洗牌和奖励一致，不同种子可以不同', () => {
    const rewardsOf = (seed: number) => winWithSlash(begin(seed), 40).rewardOptions
    const openingOf = (seed: number) => begin(seed).hand.map((item) => item.instanceId)
    expect(rewardsOf(8)).toEqual(rewardsOf(8))
    expect(openingOf(8)).toEqual(openingOf(8))

    const firstRewards = rewardsOf(1).join()
    const firstHand = openingOf(1).join()
    let rewardDiffers = false
    let handDiffers = false
    for (let seed = 2; seed < 25; seed += 1) {
      if (rewardsOf(seed).join() !== firstRewards) rewardDiffers = true
      if (openingOf(seed).join() !== firstHand) handDiffers = true
    }
    expect(rewardDiffers).toBe(true)
    expect(handDiffers).toBe(true)
  })

  it('自伤同时击倒双方时判失败，并且不回复', () => {
    const state = prepare(begin(), {
      hand: [card('heartBurn', 'burn')],
      energy: 1,
      playerHp: 2,
      playerBlock: 8,
      enemyHp: 9,
    })
    const next = play(state, 'burn')
    expect(next.phase).toBe('defeat')
    expect(next.player.hp).toBe(0)
    expect(next.enemy?.hp).toBe(0)
    expect(next.rewardOptions).toHaveLength(0)
  })

  it('Boss 胜利不回复并直接通关', () => {
    const first = winWithSlash(begin(), 40)
    const secondBattle = must(applyAction(first, { type: 'chooseReward', definitionId: first.rewardOptions[0] as CardId }))
    const second = winWithSlash(secondBattle, 30)
    const bossBattle = must(applyAction(second, { type: 'chooseReward', definitionId: second.rewardOptions[0] as CardId }))
    expect(bossBattle.enemy?.name).toBe('塔主·残焰')
    expect(bossBattle.enemy?.hp).toBe(70)
    expect(bossBattle.enemy?.statuses).toEqual([{ id: 'evasion', amount: 15, deferred: 0 }])
    expect(bossBattle.battleIndex).toBe(2)
    const victory = winWithSlash(bossBattle, 33)
    expect(victory.phase).toBe('victory')
    expect(victory.player.hp).toBe(33)
    expect(victory.rewardOptions).toHaveLength(0)
    expect(victory.deck).toHaveLength(12)
    const repeated = applyAction(victory, { type: 'chooseReward', definitionId: 'emberSlash' })
    expect(repeated.state).toBe(victory)
  })

  it('消耗只在本场生效，下一场会重新发到', () => {
    const flame = begin().deck.find((item) => item.definitionId === 'returnFlame')
    expect(flame).toBeDefined()
    if (!flame) return
    const exhausted = play(
      prepare(begin(), { hand: [flame, card('emberSlash', 'finisher')], energy: 1, enemyHp: 20 }),
      flame.instanceId,
    )
    expect(exhausted.exhaustPile.map((item) => item.instanceId)).toContain(flame.instanceId)
    const reward = play(prepare(exhausted, { hand: [card('emberSlash', 'finisher')], energy: 1, enemyHp: 6 }), 'finisher')
    expect(reward.deck.map((item) => item.instanceId)).toContain(flame.instanceId)
    const nextBattle = must(applyAction(reward, { type: 'chooseReward', definitionId: reward.rewardOptions[0] as CardId }))
    expect(pileIds(nextBattle)).toContain(flame.instanceId)
  })

  it('重新开始回到菜单并清零进度', () => {
    const defeated = must(applyAction(prepare(begin(12), { playerHp: 1, playerBlock: 0 }), { type: 'endTurn' }))
    expect(defeated.phase).toBe('defeat')
    const restarted = must(applyAction(defeated, { type: 'restart' }))
    expect(restarted).not.toBe(defeated)
    expect(restarted.phase).toBe('menu')
    expect(restarted.player.hp).toBe(50)
    expect(restarted.battleIndex).toBe(0)
    expect(restarted.deck).toHaveLength(10)
    expect(restarted.hand).toHaveLength(0)
    expect(restarted.enemy).toBeNull()
    expect(restarted.seed).toBe(defeated.seed)
  })
})
