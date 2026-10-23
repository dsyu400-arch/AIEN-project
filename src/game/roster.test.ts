import { describe, expect, it } from 'vitest'
import { attackPreviewLabel } from './accuracy.ts'
import { CARD_IDS, getCard } from './cards.ts'
import { startBattle } from './combat.ts'
import { createEnemy } from './enemies.ts'
import { nextRng, shuffle } from './rng.ts'
import { applyAction, createRun } from './run.ts'
import { getStatus } from './status.ts'
import { begin, card, freezeRun, must, play, prepare } from './test-utils.ts'
import type { CardId, RunState } from './types.ts'

function rngFor(chance: number, wantHit: boolean): number {
  let state = 1
  for (let attempt = 0; attempt < 100000; attempt += 1) {
    const rolled = nextRng(state)
    if ((rolled.value < chance / 100) === wantHit) return state
    state = (state + 1) >>> 0
  }
  throw new Error(`找不到${wantHit ? '命中' : '失手'}随机数`)
}

function rngForSequence(chance: number, hits: readonly boolean[]): number {
  let state = 1
  for (let attempt = 0; attempt < 300000; attempt += 1) {
    let cursor = state
    let matched = true
    for (const want of hits) {
      const rolled = nextRng(cursor)
      cursor = rolled.state
      if ((rolled.value < chance / 100) !== want) {
        matched = false
        break
      }
    }
    if (matched) return state
    state = (state + 1) >>> 0
  }
  throw new Error(`找不到命中序列 ${hits.join(',')}`)
}

function strikeRows(events: RunState['events']): string[] {
  return events.flatMap((event) => {
    if (event.type === 'damageDealt') return [`hit:${event.hitIndex}:${event.chance}:${event.amount}:${event.blocked}:${event.hpLoss}`]
    if (event.type === 'attackMissed') return [`miss:${event.hitIndex}:${event.chance}`]
    return []
  })
}

function preview(state: RunState, id: CardId): string | null {
  const enemy = state.enemy
  if (!enemy) throw new Error('缺少敌人')
  return attackPreviewLabel(getCard(id), state.player, enemy)
}

describe('正式命中卡牌', () => {
  it('三名敌人按 0、10、15 修正正式攻击的最终命中率', () => {
    const guard = begin(4)
    const wolf = startBattle(createRun(4), createEnemy(1))
    const boss = startBattle(createRun(4), createEnemy(2))
    expect(preview(guard, 'emberSlash')).toBe('命中 100%')
    expect(preview(guard, 'emberArrow')).toBe('命中 75%')
    expect(preview(wolf, 'emberSlash')).toBe('命中 90%')
    expect(preview(wolf, 'emberArrow')).toBe('命中 65%')
    expect(preview(boss, 'emberSlash')).toBe('命中 85%')
    expect(preview(boss, 'emberArrow')).toBe('命中 60%')
    expect(preview(boss, 'ruinArrow')).toBe('命中 45%')
    expect(preview(boss, 'chainArrow')).toBe('每段命中 65%')

    const frozen = freezeRun(boss)
    const beforeHit = frozen.hitRngState
    const beforeRng = frozen.rngState
    expect(preview(frozen, 'chainArrow')).toBe('每段命中 65%')
    expect(frozen.hitRngState).toBe(beforeHit)
    expect(frozen.rngState).toBe(beforeRng)
  })

  it('烬矢在正式对局里可以失手，也可以命中；同一种子可以复现，且不推动洗牌', () => {
    const miss = rngFor(75, false)
    const hit = rngFor(75, true)
    const missed = play(prepare(begin(6), {
      hand: [card('emberArrow', 'arrow')],
      energy: 1,
      enemyHp: 36,
      enemyBlock: 4,
      hitRngState: miss,
    }), 'arrow')
    expect(missed.enemy?.name).toBe('灰卫')
    expect(missed.enemy?.hp).toBe(36)
    expect(missed.enemy?.block).toBe(4)
    expect(missed.player.energy).toBe(0)
    expect(missed.discardPile.map((item) => item.instanceId)).toEqual(['arrow'])
    expect(missed.log).toContain('第 1 段失手')
    expect(missed.rngState).toBe(begin(6).rngState)

    const again = play(prepare(begin(6), {
      hand: [card('emberArrow', 'arrow')],
      energy: 1,
      enemyHp: 36,
      enemyBlock: 4,
      hitRngState: miss,
    }), 'arrow')
    expect(strikeRows(again.events)).toEqual(strikeRows(missed.events))
    expect(again.rngState).toBe(missed.rngState)
    expect(shuffle([1, 2, 3, 4, 5], again.rngState)).toEqual(shuffle([1, 2, 3, 4, 5], missed.rngState))

    const landed = play(prepare(begin(6), {
      hand: [card('emberArrow', 'arrow')],
      energy: 1,
      enemyHp: 36,
      enemyBlock: 0,
      hitRngState: hit,
    }), 'arrow')
    expect(landed.enemy?.hp).toBe(26)
    expect(landed.log.some((line) => line.includes('失手'))).toBe(false)
    expect(landed.rngState).toBe(missed.rngState)
    expect(landed.hitRngState).not.toBe(missed.hitRngState)
  })

  it('命中但被护甲吸干时不记失手', () => {
    const landed = play(prepare(begin(), {
      hand: [card('emberArrow', 'arrow')],
      energy: 1,
      enemyHp: 36,
      enemyBlock: 10,
      hitRngState: rngFor(75, true),
    }), 'arrow')
    expect(landed.enemy?.hp).toBe(36)
    expect(landed.enemy?.block).toBe(0)
    expect(landed.events.some((event) => event.type === 'attackMissed')).toBe(false)
    expect(landed.events.some((event) => event.type === 'damageDealt' && event.blocked === 10 && event.hpLoss === 0)).toBe(true)
  })

  it('破灭重矢失手后消耗费用和卡牌，伤害为 0', () => {
    const missed = play(prepare(begin(), {
      hand: [card('ruinArrow', 'ruin')],
      energy: 3,
      enemyHp: 40,
      enemyBlock: 8,
      hitRngState: rngFor(60, false),
    }), 'ruin')
    expect(missed.player.energy).toBe(1)
    expect(missed.discardPile.map((item) => item.instanceId)).toEqual(['ruin'])
    expect(missed.enemy?.hp).toBe(40)
    expect(missed.enemy?.block).toBe(8)

    const poor = prepare(begin(), { hand: [card('ruinArrow', 'ruin')], energy: 1, hitRngState: 99 })
    const rejected = applyAction(poor, { type: 'playCard', instanceId: 'ruin' })
    expect(rejected.ok).toBe(false)
    expect(rejected.state).toBe(poor)
    expect(rejected.state.hitRngState).toBe(99)
    expect(rejected.state.rngState).toBe(poor.rngState)
  })

  it('连珠烬箭三段独立命中，力量只加在命中的段上，并仍受虚弱和易伤修正', () => {
    const state = play(prepare(begin(), {
      hand: [card('chainArrow', 'chain')],
      energy: 1,
      enemyHp: 40,
      enemyBlock: 5,
      playerStatuses: [
        { id: 'strength', amount: 1, deferred: 0 },
        { id: 'weak', amount: 1, deferred: 0 },
      ],
      enemyStatuses: [{ id: 'vulnerable', amount: 1, deferred: 0 }],
      hitRngState: rngForSequence(80, [true, false, true]),
    }), 'chain')
    expect(strikeRows(state.events)).toEqual(['hit:0:80:5:5:0', 'miss:1:80', 'hit:2:80:5:0:5'])
    expect(state.enemy?.hp).toBe(35)
    expect(state.enemy?.block).toBe(0)
    expect(getStatus(state.player.statuses, 'strength')?.amount).toBe(1)
  })

  it('拉弓增加力量并覆写下一张攻击，闪避仍然降低最终命中率', () => {
    const boss = startBattle(createRun(8), createEnemy(2))
    let state = prepare(boss, {
      hand: [card('drawBow', 'bow'), card('emberArrow', 'arrow'), card('ashShield', 'shield')],
      energy: 3,
      enemyHp: 70,
      playerHp: 50,
    })
    expect(preview(state, 'emberArrow')).toBe('命中 60%')
    state = play(state, 'bow')
    expect(state.discardPile.map((item) => item.instanceId)).toEqual(['bow'])
    expect(state.exhaustPile).toEqual([])
    expect(getStatus(state.player.statuses, 'strength')?.amount).toBe(1)
    expect(state.player.nextAttackAccuracy).toBe(100)
    expect(preview(state, 'emberArrow')).toBe('命中 85%')
    expect(preview(state, 'emberArrow')).not.toBe('必定命中')
    state = play(state, 'shield')
    expect(state.player.nextAttackAccuracy).toBe(100)
    state = must(applyAction(state, { type: 'endTurn' }))
    expect(state.player.nextAttackAccuracy).toBe(100)
    expect(getStatus(state.player.statuses, 'strength')?.amount).toBe(1)
    state = play(prepare(state, {
      hand: [card('emberArrow', 'arrow')],
      energy: 1,
      enemyHp: 70,
      enemyBlock: 0,
      hitRngState: rngFor(85, true),
    }), 'arrow')
    expect(state.player.nextAttackAccuracy).toBeNull()
    expect(strikeRows(state.events).at(-1)).toBe('hit:0:85:11:0:11')
    expect(getStatus(state.player.statuses, 'strength')?.amount).toBe(1)
  })

  it('重复拉弓继续加力量，但不累计多次命中覆写', () => {
    let state = prepare(begin(), {
      hand: [card('drawBow', 'bow-1'), card('drawBow', 'bow-2'), card('ruinArrow', 'ruin')],
      energy: 6,
      enemyHp: 80,
      enemyStatuses: [{ id: 'evasion', amount: 30, deferred: 0 }],
    })
    state = play(state, 'bow-1')
    state = play(state, 'bow-2')
    expect(getStatus(state.player.statuses, 'strength')?.amount).toBe(2)
    expect(state.player.nextAttackAccuracy).toBe(100)
    expect(preview(state, 'ruinArrow')).toBe('命中 70%')
    state = play(state, 'ruin')
    expect(state.player.nextAttackAccuracy).toBeNull()
    expect(preview(state, 'emberSlash')).toBe('命中 70%')
  })

  it('校准增加 20 个百分点，跨回合保留，使用后消耗，打出攻击后用掉一次', () => {
    let state = prepare(begin(), {
      hand: [card('calibrate', 'cal'), card('ruinArrow', 'ruin')],
      drawPile: [],
      energy: 2,
      enemyHp: 80,
      playerHp: 50,
    })
    state = play(state, 'cal')
    expect(state.player.energy).toBe(2)
    expect(state.exhaustPile.map((item) => item.instanceId)).toEqual(['cal'])
    expect(state.discardPile).toEqual([])
    expect(getStatus(state.player.statuses, 'aim')?.amount).toBe(1)
    expect(preview(state, 'ruinArrow')).toBe('命中 80%')
    state = must(applyAction(state, { type: 'endTurn' }))
    expect(state.phase).toBe('playerTurn')
    expect(getStatus(state.player.statuses, 'aim')?.amount).toBe(1)
    state = play(prepare(state, {
      hand: [card('ruinArrow', 'ruin')],
      energy: 2,
      enemyHp: 80,
      hitRngState: rngFor(80, true),
    }), 'ruin')
    expect(getStatus(state.player.statuses, 'aim')).toBeUndefined()
    expect(strikeRows(state.events).at(-1)).toBe('hit:0:80:22:0:22')
    expect(state.enemy?.hp).toBe(58)
  })

  it('校准、拉弓和破绽可以同时作用，普通加成不超过 100%', () => {
    let state = prepare(begin(), {
      hand: [card('calibrate', 'cal'), card('riftMark', 'mark'), card('ruinArrow', 'ruin')],
      drawPile: [card('ashShield', 'extra')],
      energy: 3,
      enemyHp: 90,
      enemyStatuses: [{ id: 'evasion', amount: 30, deferred: 0 }],
    })
    state = play(state, 'cal')
    state = play(state, 'mark')
    expect(getStatus(state.enemy?.statuses ?? [], 'expose')?.amount).toBe(2)
    expect(preview(state, 'ruinArrow')).toBe('命中 65%')
    state = play(prepare(state, {
      hand: [card('drawBow', 'bow'), card('ruinArrow', 'ruin')],
      energy: 3,
    }), 'bow')
    expect(preview(state, 'ruinArrow')).toBe('命中 100%')
    expect(preview(state, 'ruinArrow')).not.toBe('必定命中')
    expect(getStatus(state.player.statuses, 'strength')?.amount).toBe(1)
    expect(getStatus(state.player.statuses, 'aim')?.amount).toBe(1)
  })

  it('连珠烬箭的每一段共享同一次拉弓和校准', () => {
    let state = prepare(begin(), {
      hand: [card('drawBow', 'bow'), card('calibrate', 'cal'), card('chainArrow', 'chain')],
      energy: 3,
      enemyHp: 80,
      enemyStatuses: [{ id: 'evasion', amount: 25, deferred: 0 }],
      hitRngState: rngForSequence(95, [true, true, false]),
    })
    state = play(state, 'bow')
    state = play(state, 'cal')
    expect(preview(state, 'chainArrow')).toBe('每段命中 95%')
    state = play(state, 'chain')
    expect(strikeRows(state.events)).toEqual(['hit:0:95:5:0:5', 'hit:1:95:5:0:5', 'miss:2:95'])
    expect(state.player.nextAttackAccuracy).toBeNull()
    expect(getStatus(state.player.statuses, 'aim')).toBeUndefined()
    expect(getStatus(state.player.statuses, 'strength')?.amount).toBe(1)
    expect(state.enemy?.hp).toBe(70)
  })

  it('裂隙标记施加 2 回合破绽并抽 1 张牌，重复只加回合', () => {
    const drawn = play(prepare(begin(), {
      hand: [card('riftMark', 'mark')],
      drawPile: [card('gatherAsh', 'drawn')],
      energy: 1,
      enemyHp: 40,
    }), 'mark')
    expect(drawn.hand.map((item) => item.instanceId)).toEqual(['drawn'])
    expect(drawn.discardPile.map((item) => item.instanceId)).toEqual(['mark'])
    expect(getStatus(drawn.enemy?.statuses ?? [], 'expose')?.amount).toBe(2)
    expect(drawn.rngState).toBe(begin().rngState)

    let stacked = prepare(begin(), {
      hand: [card('riftMark', 'a'), card('riftMark', 'b'), card('ruinArrow', 'ruin')],
      energy: 3,
      enemyHp: 80,
    })
    stacked = play(stacked, 'a')
    stacked = play(stacked, 'b')
    expect(getStatus(stacked.enemy?.statuses ?? [], 'expose')?.amount).toBe(4)
    expect(preview(stacked, 'ruinArrow')).toBe('命中 75%')

    let timed = prepare(startBattle(createRun(5), createEnemy(1)), {
      hand: [card('riftMark', 'mark')],
      energy: 1,
      playerHp: 50,
      enemyHp: 48,
    })
    timed = play(timed, 'mark')
    expect(getStatus(timed.enemy?.statuses ?? [], 'expose')?.amount).toBe(2)
    expect(getStatus(timed.enemy?.statuses ?? [], 'evasion')?.amount).toBe(10)
    timed = must(applyAction(timed, { type: 'endTurn' }))
    expect(getStatus(timed.enemy?.statuses ?? [], 'expose')?.amount).toBe(1)
    expect(getStatus(timed.enemy?.statuses ?? [], 'evasion')?.amount).toBe(10)
    timed = must(applyAction(timed, { type: 'endTurn' }))
    expect(getStatus(timed.enemy?.statuses ?? [], 'expose')).toBeUndefined()
    expect(getStatus(timed.enemy?.statuses ?? [], 'evasion')?.amount).toBe(10)
  })

  it('开局手牌可以抽到拉弓和烬矢，奖励可以开出六张新牌且不含夹具', () => {
    let sawBow = false
    let sawArrow = false
    for (let seed = 1; seed < 40 && (!sawBow || !sawArrow); seed += 1) {
      const hand = begin(seed).hand.map((item) => item.definitionId)
      if (hand.includes('drawBow')) sawBow = true
      if (hand.includes('emberArrow')) sawArrow = true
    }
    expect(sawBow).toBe(true)
    expect(sawArrow).toBe(true)

    const wanted = ['drawBow', 'emberArrow', 'ruinArrow', 'chainArrow', 'calibrate', 'riftMark'] as const
    const found = new Set<CardId>()
    const fixtures = new Set<CardId>(['scatteredShot', 'sureEdge', 'tripleShot'])
    for (let seed = 1; seed < 400 && found.size < wanted.length; seed += 1) {
      const reward = play(prepare(begin(seed), {
        hand: [card('emberSlash', 'finisher')],
        energy: 1,
        enemyHp: 6,
        enemyBlock: 0,
      }), 'finisher')
      expect(reward.phase).toBe('reward')
      for (const id of reward.rewardOptions) {
        expect(fixtures.has(id)).toBe(false)
        expect(CARD_IDS).toContain(id)
        if ((wanted as readonly CardId[]).includes(id)) found.add(id)
      }
    }
    expect([...found].sort()).toEqual([...wanted].sort())
  })
})
