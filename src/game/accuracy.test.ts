import { describe, expect, it } from 'vitest'
import { attackHitChance, attackPreviewLabel, finalHitChance, judgeHit } from './accuracy.ts'
import { getCard } from './cards.ts'
import { AIM_HIT_BONUS, EXPOSE_HIT_BONUS, HIT_CHANCE_MAX, HIT_CHANCE_MIN } from './constants.ts'
import { endTurn } from './combat.ts'
import { applyAction } from './run.ts'
import { nextRng, shuffle } from './rng.ts'
import { getStatus } from './status.ts'
import { begin, card, freezeRun, must, play, prepare } from './test-utils.ts'
import type { Combatant, Intent, Player } from './types.ts'

function fighter(statuses: Combatant['statuses'] = []): Combatant {
  return { hp: 40, maxHp: 40, block: 0, statuses }
}

function playerOf(statuses: Player['statuses'] = [], nextAttackAccuracy: number | null = null): Player {
  return { ...fighter(statuses), hp: 50, maxHp: 50, energy: 3, maxEnergy: 3, nextAttackAccuracy }
}

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

function strikeRows(events: { type: string; hitIndex?: number; chance?: number; amount?: number; blocked?: number; hpLoss?: number }[]) {
  return events.flatMap((event) => {
    if (event.type === 'damageDealt') return [`hit:${event.hitIndex}:${event.chance}:${event.amount}:${event.blocked}:${event.hpLoss}`]
    if (event.type === 'attackMissed') return [`miss:${event.hitIndex}:${event.chance}`]
    return []
  })
}

describe('命中率', () => {
  it('按百分点计算，并夹在集中定义的上下限里', () => {
    expect(finalHitChance(60, AIM_HIT_BONUS, 10, false)).toBe(70)
    expect(finalHitChance(100, 0, 20, false)).toBe(80)
    expect(finalHitChance(0, 0, 0, false)).toBe(HIT_CHANCE_MIN)
    expect(finalHitChance(160, 0, 0, false)).toBe(HIT_CHANCE_MAX)
    expect(finalHitChance(100, 0, 90, true)).toBe(HIT_CHANCE_MAX)
    expect(HIT_CHANCE_MIN).toBe(25)
    expect(HIT_CHANCE_MAX).toBe(100)
  })

  it('瞄准和破绽各提供固定加成，闪避按层数相减', () => {
    const aimed = attackHitChance({
      baseAccuracy: 60,
      nextAttackAccuracy: null,
      cannotMiss: false,
      attacker: playerOf([{ id: 'aim', amount: 2, deferred: 0 }]),
      defender: fighter([
        { id: 'expose', amount: 3, deferred: 0 },
        { id: 'evasion', amount: 10, deferred: 0 },
      ]),
    })
    expect(aimed).toMatchObject({ base: 60, bonus: AIM_HIT_BONUS + EXPOSE_HIT_BONUS, penalty: 10, chance: 85, cannotMiss: false })

    const plain = attackHitChance({
      baseAccuracy: undefined,
      nextAttackAccuracy: null,
      cannotMiss: false,
      attacker: playerOf(),
      defender: fighter([{ id: 'evasion', amount: 20, deferred: 0 }]),
    })
    expect(plain).toMatchObject({ base: 100, bonus: 0, penalty: 20, chance: 80, cannotMiss: false })

    const certain = attackHitChance({
      baseAccuracy: 40,
      nextAttackAccuracy: null,
      cannotMiss: true,
      attacker: playerOf(),
      defender: fighter([{ id: 'evasion', amount: 90, deferred: 0 }]),
    })
    expect(certain.cannotMiss).toBe(true)
    expect(certain.chance).toBe(100)
    expect(certain.penalty).toBe(90)
  })

  it('拉弓覆写基础命中率，但不会变成必定命中', () => {
    const overridden = attackHitChance({
      baseAccuracy: 60,
      nextAttackAccuracy: 100,
      cannotMiss: false,
      attacker: playerOf(),
      defender: fighter([{ id: 'evasion', amount: 20, deferred: 0 }]),
    })
    expect(overridden).toMatchObject({ base: 100, chance: 80, cannotMiss: false })
  })

  it('预览只读战斗状态，多段攻击会标明每一段都判定', () => {
    const state = freezeRun(prepare(begin(), {
      enemyStatuses: [
        { id: 'evasion', amount: 10, deferred: 0 },
        { id: 'expose', amount: 2, deferred: 0 },
      ],
      playerStatuses: [{ id: 'aim', amount: 2, deferred: 0 }],
    }))
    const enemy = state.enemy
    if (!enemy) throw new Error('缺少敌人')
    const beforeHit = state.hitRngState
    const beforeRng = state.rngState
    expect(attackPreviewLabel(getCard('scatteredShot'), state.player, enemy)).toBe('命中 85%')
    expect(attackPreviewLabel(getCard('emberSlash'), state.player, enemy)).toBe('命中 100%')
    expect(attackPreviewLabel(getCard('ashFlurry'), state.player, enemy)).toBe('每段命中 100%')
    expect(attackPreviewLabel(getCard('tripleShot'), state.player, enemy)).toBe('每段命中 75%')
    expect(attackPreviewLabel(getCard('sureEdge'), state.player, enemy)).toBe('必定命中')
    expect(attackPreviewLabel(getCard('ashShield'), state.player, enemy)).toBeNull()
    expect(attackPreviewLabel({
      ...getCard('sureEdge'),
      effects: [{ type: 'damage', amount: 1, times: 3 }],
    }, state.player, enemy)).toBe('每段必定命中')
    expect(state.hitRngState).toBe(beforeHit)
    expect(state.rngState).toBe(beforeRng)
  })

  it('每个攻击段都推进命中序列，100% 和必定命中也不例外', () => {
    const rolled = nextRng(41)
    expect(judgeHit(41, 100, false)).toEqual({ hitRngState: rolled.state, hit: true })
    expect(judgeHit(41, 0, true).hit).toBe(true)
    expect(judgeHit(41, 0, true).hitRngState).toBe(rolled.state)
    const miss = rngFor(40, false)
    expect(judgeHit(miss, 40, false).hit).toBe(false)
    expect(judgeHit(miss, 40, true).hit).toBe(true)
  })

  it('失手不退能量、不还牌、不打护甲，自伤仍然生效', () => {
    const missAt25 = rngFor(25, false)
    const missed = play(prepare(begin(), {
      hand: [card('emberSlash', 'slash')],
      energy: 1,
      enemyHp: 30,
      enemyBlock: 9,
      enemyStatuses: [{ id: 'evasion', amount: 80, deferred: 0 }],
      hitRngState: missAt25,
    }), 'slash')
    expect(missed.enemy?.hp).toBe(30)
    expect(missed.enemy?.block).toBe(9)
    expect(missed.player.energy).toBe(0)
    expect(missed.hand).toEqual([])
    expect(missed.discardPile.map((item) => item.definitionId)).toEqual(['emberSlash'])
    expect(missed.rngState).toBe(begin().rngState)
    expect(missed.hitRngState).not.toBe(missAt25)
    expect(strikeRows(missed.events)).toEqual(['miss:0:25'])
    expect(missed.log).toContain('第 1 段失手')

    const burned = play(prepare(begin(), {
      hand: [card('heartBurn', 'burn')],
      energy: 1,
      playerHp: 50,
      enemyHp: 30,
      enemyBlock: 4,
      enemyStatuses: [{ id: 'evasion', amount: 80, deferred: 0 }],
      hitRngState: missAt25,
    }), 'burn')
    expect(burned.enemy?.hp).toBe(30)
    expect(burned.enemy?.block).toBe(4)
    expect(burned.player.hp).toBe(48)
  })

  it('必定命中无视闪避，基础 100% 则仍会失手', () => {
    const missAt25 = rngFor(25, false)
    const evasion = [{ id: 'evasion' as const, amount: 80, deferred: 0 }]
    const loose = play(prepare(begin(), {
      hand: [card('emberSlash', 'slash')],
      energy: 1,
      enemyHp: 30,
      enemyBlock: 9,
      enemyStatuses: evasion,
      hitRngState: missAt25,
    }), 'slash')
    const sure = play(prepare(begin(), {
      hand: [card('sureEdge', 'edge')],
      energy: 1,
      enemyHp: 30,
      enemyBlock: 0,
      enemyStatuses: evasion,
      hitRngState: missAt25,
    }), 'edge')
    expect(loose.enemy?.hp).toBe(30)
    expect(loose.enemy?.block).toBe(9)
    expect(sure.enemy?.hp).toBe(26)
    expect(sure.hitRngState).toBe(loose.hitRngState)
    expect(strikeRows(sure.events)).toEqual(['hit:0:100:4:0:4'])
  })

  it('三段攻击各自判定，命中段才计算力量、护甲和生命', () => {
    const sequence = rngForSequence(50, [false, true, false])
    const next = play(prepare(begin(), {
      hand: [card('tripleShot', 'tri')],
      energy: 1,
      enemyHp: 40,
      enemyBlock: 5,
      playerStatuses: [{ id: 'strength', amount: 1, deferred: 0 }],
      hitRngState: sequence,
    }), 'tri')
    expect(next.enemy?.hp).toBe(40)
    expect(next.enemy?.block).toBe(1)
    expect(strikeRows(next.events)).toEqual(['miss:0:50', 'hit:1:50:4:4:0', 'miss:2:50'])
    expect(getStatus(next.player.statuses, 'strength')?.amount).toBe(1)
  })

  it('命中才触发 onHit，失手才触发 onMiss', () => {
    const missed = play(prepare(begin(), {
      hand: [card('scatteredShot', 'shot')],
      energy: 1,
      playerBlock: 0,
      enemyHp: 40,
      hitRngState: rngFor(60, false),
    }), 'shot')
    expect(missed.player.block).toBe(3)
    expect(missed.enemy?.hp).toBe(40)
    expect(missed.enemy?.statuses).toEqual([])

    const hit = play(prepare(begin(), {
      hand: [card('scatteredShot', 'shot')],
      energy: 1,
      playerBlock: 0,
      enemyHp: 40,
      hitRngState: rngFor(60, true),
    }), 'shot')
    expect(hit.player.block).toBe(0)
    expect(hit.enemy?.hp).toBe(35)
    expect(hit.enemy?.statuses).toEqual([{ id: 'vulnerable', amount: 1, deferred: 0 }])
  })

  it('拉弓进入弃牌堆，力量叠加，命中率覆写不累计次数', () => {
    let state = prepare(begin(), {
      hand: [card('drawBow', 'bow-1'), card('drawBow', 'bow-2'), card('scatteredShot', 'first'), card('scatteredShot', 'second')],
      energy: 6,
      enemyHp: 50,
      enemyStatuses: [{ id: 'evasion', amount: 40, deferred: 0 }],
    })
    state = play(state, 'bow-1')
    state = play(state, 'bow-2')
    expect(state.exhaustPile).toEqual([])
    expect(state.discardPile.map((item) => item.instanceId)).toEqual(['bow-1', 'bow-2'])
    expect(getStatus(state.player.statuses, 'strength')?.amount).toBe(2)
    expect(state.player.nextAttackAccuracy).toBe(100)
    expect(state.log).toContain('下一张攻击的基础命中率变为 100%')
    const enemy = state.enemy
    if (!enemy) throw new Error('缺少敌人')
    expect(attackPreviewLabel(getCard('scatteredShot'), state.player, enemy)).toBe('命中 60%')

    state = play(state, 'first')
    expect(state.player.nextAttackAccuracy).toBeNull()
    expect(strikeRows(state.events).at(-1)).toMatch(/^(?:hit|miss):0:60\b/)

    const before = state.events.length
    state = play(state, 'second')
    expect(strikeRows(state.events.slice(before))[0]).toMatch(/^(?:hit|miss):0:25\b/)
    expect(getStatus(state.player.statuses, 'strength')?.amount).toBe(2)
  })

  it('拉弓的覆写留到下一张攻击牌，技能牌和回合结束都不消耗', () => {
    let state = prepare(begin(), {
      hand: [card('drawBow', 'bow'), card('ashShield', 'shield')],
      energy: 3,
      playerHp: 50,
      playerBlock: 0,
    })
    state = play(state, 'bow')
    state = play(state, 'shield')
    expect(state.player.nextAttackAccuracy).toBe(100)
    expect(state.player.block).toBe(5)
    state = must(applyAction(state, { type: 'endTurn' }))
    expect(state.player.nextAttackAccuracy).toBe(100)
    expect(getStatus(state.player.statuses, 'strength')?.amount).toBe(1)
  })

  it('瞄准按攻击牌消耗，回合结束和技能牌不消耗', () => {
    let state = prepare(begin(), {
      hand: [card('ashShield', 'shield'), card('scatteredShot', 'first'), card('scatteredShot', 'second')],
      energy: 3,
      enemyHp: 40,
      playerStatuses: [{ id: 'aim', amount: 2, deferred: 0 }],
    })
    state = play(state, 'shield')
    expect(getStatus(state.player.statuses, 'aim')?.amount).toBe(2)
    state = play(state, 'first')
    expect(getStatus(state.player.statuses, 'aim')?.amount).toBe(1)
    expect(strikeRows(state.events).at(-1)).toMatch(/^(?:hit|miss):0:80\b/)
    state = play(state, 'second')
    expect(getStatus(state.player.statuses, 'aim')).toBeUndefined()
    expect(strikeRows(state.events).at(-1)).toMatch(/^(?:hit|miss):0:80\b/)

    const held = prepare(begin(), {
      hand: [card('ashShield', 'shield')],
      energy: 1,
      playerHp: 50,
      playerBlock: 0,
      playerStatuses: [{ id: 'aim', amount: 2, deferred: 0 }],
    })
    const afterTurn = must(applyAction(play(held, 'shield'), { type: 'endTurn' }))
    expect(getStatus(afterTurn.player.statuses, 'aim')?.amount).toBe(2)
  })

  it('破绽只增加固定命中率，并按回合减少', () => {
    const enemy = begin().enemy
    if (!enemy) throw new Error('缺少敌人')
    const thin = playerOf()
    const once = attackHitChance({
      baseAccuracy: 60,
      nextAttackAccuracy: null,
      cannotMiss: false,
      attacker: thin,
      defender: { ...enemy, statuses: [{ id: 'expose', amount: 1, deferred: 0 }] },
    })
    const stacked = attackHitChance({
      baseAccuracy: 60,
      nextAttackAccuracy: null,
      cannotMiss: false,
      attacker: thin,
      defender: { ...enemy, statuses: [{ id: 'expose', amount: 4, deferred: 0 }] },
    })
    expect(once.chance).toBe(75)
    expect(stacked.chance).toBe(once.chance)

    let state = prepare(begin(), {
      hand: [card('scatteredShot', 'shot')],
      energy: 1,
      enemyHp: 40,
      enemyStatuses: [{ id: 'expose', amount: 1, deferred: 0 }],
      hitRngState: rngFor(75, true),
    })
    state = play(state, 'shot')
    expect(strikeRows(state.events)).toEqual(['hit:0:75:5:0:5'])
    state = must(applyAction(state, { type: 'endTurn' }))
    expect(state.enemy?.statuses.some((status) => status.id === 'expose')).toBe(false)
  })

  it('敌人攻击也会失手，失手不消耗玩家护甲', () => {
    const intent: Intent = { kind: 'attack', damage: 8, times: 1, block: 0, label: '攻击 8', accuracy: 40 }
    const state = prepare(begin(), {
      playerHp: 50,
      playerBlock: 8,
      hitRngState: rngFor(40, false),
    })
    const armed = state.enemy ? { ...state, enemy: { ...state.enemy, pattern: [intent], patternIndex: 0 } } : state
    const result = endTurn(armed)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.player.hp).toBe(50)
    expect(result.state.player.block).toBe(8)
    expect(result.state.log).toContain('第 1 段失手')

    const certain: Intent = { ...intent, cannotMiss: true, accuracy: 40 }
    const forced = prepare(begin(), {
      playerHp: 50,
      playerBlock: 0,
      playerStatuses: [{ id: 'evasion', amount: 90, deferred: 0 }],
      hitRngState: rngFor(25, false),
    })
    const bossed = forced.enemy ? { ...forced, enemy: { ...forced.enemy, pattern: [certain], patternIndex: 0 } } : forced
    const landed = endTurn(bossed)
    expect(landed.ok).toBe(true)
    if (!landed.ok) return
    expect(landed.state.player.hp).toBe(42)
  })

  it('同一种子的命中序列一致，而且不改变洗牌随机数', () => {
    function pattern(seed: number) {
      let state = prepare(begin(seed), {
        hand: [card('tripleShot', 'a'), card('scatteredShot', 'b')],
        energy: 3,
        enemyHp: 80,
        enemyStatuses: [{ id: 'evasion', amount: 15, deferred: 0 }],
      })
      state = play(state, 'a')
      state = play(state, 'b')
      return { rng: state.rngState, hit: state.hitRngState, rows: strikeRows(state.events) }
    }
    expect(pattern(11)).toEqual(pattern(11))
    expect(pattern(11).rng).toBe(begin(11).rngState)
    expect(begin(11).hitRngState).not.toBe(begin(12).hitRngState)
    expect(shuffle([1, 2, 3, 4, 5], pattern(11).rng)).toEqual(shuffle([1, 2, 3, 4, 5], begin(11).rngState))

    const poor = prepare(begin(), { hand: [card('emberSlash', 'slash')], energy: 0 })
    expect(applyAction(poor, { type: 'playCard', instanceId: 'slash' }).state).toBe(poor)
  })

  it('战斗结束时清掉尚未使用的命中率覆写', () => {
    const state = prepare(begin(), {
      enemyHp: 5,
      enemyStatuses: [{ id: 'poison', amount: 5, deferred: 0 }],
      nextAttackAccuracy: 100,
      playerHp: 50,
    })
    const next = must(applyAction(state, { type: 'endTurn' }))
    expect(next.phase).toBe('reward')
    expect(next.player.nextAttackAccuracy).toBeNull()
    expect(next.rewardOptions.every((id) => id !== 'drawBow' && id !== 'scatteredShot' && id !== 'sureEdge' && id !== 'tripleShot')).toBe(true)
  })
})
