import { describe, expect, it } from 'vitest'
import { applyAction } from './run.ts'
import { begin, card, freezeRun, pileIds, play, prepare } from './test-utils.ts'

describe('出牌与伤害', () => {
  it('余烬斩消耗 1 点能量并造成 6 点伤害', () => {
    const state = prepare(begin(), {
      hand: [card('emberSlash', 'slash')],
      energy: 3,
      enemyHp: 30,
    })
    const next = play(state, 'slash')
    expect(next.player.energy).toBe(2)
    expect(next.enemy?.hp).toBe(24)
    expect(next.discardPile.map((item) => item.instanceId)).toContain('slash')
    expect(next.hand).toHaveLength(0)
    expect(state.enemy?.hp).toBe(30)
    expect(state.hand).toHaveLength(1)
  })

  it('裂塔重击造成 13 点伤害', () => {
    const state = prepare(begin(), { hand: [card('towerSmash')], energy: 2, enemyHp: 40 })
    const next = play(state, 'towerSmash')
    expect(next.player.energy).toBe(0)
    expect(next.enemy?.hp).toBe(27)
  })

  it('灰烬连斩逐段打穿护甲', () => {
    const state = prepare(begin(), {
      hand: [card('ashFlurry')],
      energy: 1,
      enemyHp: 20,
      enemyBlock: 5,
    })
    const next = play(state, 'ashFlurry')
    expect(next.enemy?.block).toBe(0)
    expect(next.enemy?.hp).toBe(17)
  })

  it('焚心一击的自伤不消耗护甲', () => {
    const state = prepare(begin(), {
      hand: [card('heartBurn')],
      energy: 1,
      playerHp: 20,
      playerBlock: 10,
      enemyHp: 30,
    })
    const next = play(state, 'heartBurn')
    expect(next.enemy?.hp).toBe(21)
    expect(next.player.hp).toBe(18)
    expect(next.player.block).toBe(10)
  })

  it('烬矛突刺不消耗能量', () => {
    const state = prepare(begin(), { hand: [card('emberSpear')], energy: 3, enemyHp: 10 })
    const next = play(state, 'emberSpear')
    expect(next.player.energy).toBe(3)
    expect(next.enemy?.hp).toBe(7)
  })

  it('灰盾和塔壁获得对应护甲', () => {
    const shield = prepare(begin(), { hand: [card('ashShield')], energy: 1 })
    expect(play(shield, 'ashShield').player.block).toBe(5)
    const wall = prepare(begin(), { hand: [card('towerWall')], energy: 2 })
    expect(play(wall, 'towerWall').player.block).toBe(11)
  })

  it('烬甲先抽牌，再把打出的牌放入弃牌堆', () => {
    const drawn = card('emberSlash', 'drawn')
    const state = prepare(begin(), {
      hand: [card('emberArmor', 'armor')],
      drawPile: [drawn],
      discardPile: [],
      energy: 1,
    })
    const next = play(state, 'armor')
    expect(next.player.block).toBe(4)
    expect(next.hand.map((item) => item.instanceId)).toEqual(['drawn'])
    expect(next.discardPile.map((item) => item.instanceId)).toEqual(['armor'])
  })

  it('拾烬从弃牌堆洗回并抽 2 张', () => {
    const left = card('ashShield', 'left')
    const right = card('emberSlash', 'right')
    const state = prepare(begin(), {
      hand: [card('gatherAsh', 'draw')],
      drawPile: [],
      discardPile: [left, right],
      energy: 1,
    })
    const next = play(state, 'draw')
    expect(next.hand.map((item) => item.instanceId).sort()).toEqual(['left', 'right'])
    expect(next.discardPile.map((item) => item.instanceId)).toEqual(['draw'])
    expect(next.rngState).not.toBe(state.rngState)
  })

  it('余火洞察不会抽到自己刚打出的牌', () => {
    const waiting = card('emberSlash', 'waiting')
    const state = prepare(begin(), {
      hand: [card('emberInsight', 'insight')],
      drawPile: [],
      discardPile: [waiting],
      energy: 0,
    })
    const next = play(state, 'insight')
    expect(next.hand.map((item) => item.instanceId)).toEqual(['waiting'])
    expect(next.discardPile.map((item) => item.instanceId)).toEqual(['insight'])
  })

  it('抽牌堆和弃牌堆都空时少抽，不报错', () => {
    const state = prepare(begin(), {
      hand: [card('gatherAsh', 'draw')],
      drawPile: [],
      discardPile: [],
      energy: 1,
    })
    const next = play(state, 'draw')
    expect(next.hand).toHaveLength(0)
    expect(next.discardPile.map((item) => item.instanceId)).toEqual(['draw'])
  })

  it('手牌达到 10 张后，多抽的牌进入弃牌堆', () => {
    const fillers = Array.from({ length: 9 }, (_, index) => card('ashShield', `fill-${index}`))
    const overflow = card('emberSlash', 'overflow')
    const kept = card('emberSpear', 'kept')
    const state = prepare(begin(), {
      hand: [card('gatherAsh', 'draw'), ...fillers],
      drawPile: [kept, overflow],
      discardPile: [],
      energy: 1,
    })
    const next = play(state, 'draw')
    expect(next.hand).toHaveLength(10)
    expect(next.hand.map((item) => item.instanceId)).toContain('kept')
    expect(next.hand.map((item) => item.instanceId)).not.toContain('overflow')
    expect(next.discardPile.map((item) => item.instanceId)).toEqual(['overflow', 'draw'])
  })

  it('回焰获得 1 点能量并进入消耗堆', () => {
    const state = prepare(begin(), { hand: [card('returnFlame', 'flame')], energy: 3 })
    const next = play(state, 'flame')
    expect(next.player.energy).toBe(4)
    expect(next.exhaustPile.map((item) => item.instanceId)).toEqual(['flame'])
    expect(next.discardPile).toHaveLength(0)
  })

  it('聚焰支付 1 点后获得 2 点能量', () => {
    const state = prepare(begin(), { hand: [card('gatherFlame')], energy: 1 })
    expect(play(state, 'gatherFlame').player.energy).toBe(2)
  })
})

describe('回合', () => {
  it('战斗开始时生命 50、能量 3、抽 5 张', () => {
    const state = begin()
    expect(state.phase).toBe('playerTurn')
    expect(state.player.hp).toBe(50)
    expect(state.player.energy).toBe(3)
    expect(state.hand).toHaveLength(5)
    expect(state.drawPile).toHaveLength(5)
    expect(state.turn).toBe(1)
    expect(state.enemy?.name).toBe('灰卫')
    expect(state.enemy?.hp).toBe(36)
    expect(pileIds(state)).toEqual(state.deck.map((item) => item.instanceId).sort())
  })

  it('能量不足、不存在的牌和错误阶段都返回原状态', () => {
    const state = freezeRun(prepare(begin(), { hand: [card('towerSmash', 'heavy')], energy: 1 }))
    const poor = applyAction(state, { type: 'playCard', instanceId: 'heavy' })
    const missing = applyAction(state, { type: 'playCard', instanceId: 'missing' })
    const reward = applyAction(state, { type: 'chooseReward', definitionId: 'emberSlash' })
    expect(poor).toEqual({ ok: false, state, reason: '能量不足' })
    expect(missing).toEqual({ ok: false, state, reason: '手牌中没有这张牌' })
    expect(reward).toEqual({ ok: false, state, reason: '当前不能领取奖励' })
    expect(poor.state).toBe(state)
    expect(missing.state).toBe(state)
    expect(reward.state).toBe(state)
    expect(state.rngState).toBe(poor.state.rngState)
  })

  it('出牌不会修改被冻结的原状态', () => {
    const state = freezeRun(prepare(begin(), { hand: [card('emberSlash', 'slash')], energy: 1, enemyHp: 20 }))
    const next = play(state, 'slash')
    expect(state.enemy?.hp).toBe(20)
    expect(state.hand).toHaveLength(1)
    expect(next.enemy?.hp).toBe(14)
    expect(next.deck).toBe(state.deck)
  })

  it('本回合护甲能挡住敌人攻击，下回合开始时清除', () => {
    const blocked = prepare(begin(), { playerBlock: 11, playerHp: 50 })
    const safe = applyAction(blocked, { type: 'endTurn' })
    expect(safe.ok).toBe(true)
    if (!safe.ok) return
    expect(safe.state.player.hp).toBe(50)
    expect(safe.state.player.block).toBe(0)
    expect(safe.state.player.energy).toBe(3)

    const partial = prepare(begin(), { playerBlock: 5, playerHp: 50 })
    const hurt = applyAction(partial, { type: 'endTurn' })
    expect(hurt.ok).toBe(true)
    if (!hurt.ok) return
    expect(hurt.state.player.hp).toBe(47)
  })

  it('结束回合弃置手牌、执行当前意图，并且能量回到 3', () => {
    const kept = card('ashShield', 'kept-a')
    const other = card('ashShield', 'kept-b')
    const draw = Array.from({ length: 8 }, (_, index) => card('emberSlash', `pile-${index}`))
    const state = prepare(begin(), {
      hand: [kept, other],
      drawPile: draw,
      discardPile: [],
      energy: 1,
      playerBlock: 0,
      playerHp: 50,
    })
    const next = applyAction(state, { type: 'endTurn' })
    expect(next.ok).toBe(true)
    if (!next.ok) return
    expect(next.state.player.hp).toBe(42)
    expect(next.state.player.energy).toBe(3)
    expect(next.state.turn).toBe(2)
    expect(next.state.enemy?.patternIndex).toBe(1)
    expect(next.state.discardPile.map((item) => item.instanceId)).toEqual(['kept-a', 'kept-b'])
    expect(next.state.hand).toHaveLength(5)
    expect(state.hand).toHaveLength(2)
  })

  it('抽牌堆不足时会洗入弃牌堆再抽满', () => {
    const draw = [card('emberSlash', 'd1'), card('emberSlash', 'd2')]
    const discard = Array.from({ length: 8 }, (_, index) => card('ashShield', `old-${index}`))
    const state = prepare(begin(), { hand: [], drawPile: draw, discardPile: discard, playerHp: 50 })
    const next = applyAction(state, { type: 'endTurn' })
    expect(next.ok).toBe(true)
    if (!next.ok) return
    expect(next.state.hand).toHaveLength(5)
    expect(pileIds(next.state)).toHaveLength(10)
  })

  it('敌人护甲在行动前清除，获得的护甲会保留到玩家回合', () => {
    const guarded = prepare(begin(), { enemyBlock: 9, patternIndex: 0, playerBlock: 0, playerHp: 50 })
    const attacked = applyAction(guarded, { type: 'endTurn' })
    expect(attacked.ok).toBe(true)
    if (!attacked.ok) return
    expect(attacked.state.player.hp).toBe(42)

    const bracing = prepare(begin(), { patternIndex: 1, enemyBlock: 0, playerHp: 50 })
    const blocked = applyAction(bracing, { type: 'endTurn' })
    expect(blocked.ok).toBe(true)
    if (!blocked.ok) return
    expect(blocked.state.enemy?.block).toBe(6)
    const struck = play(
      prepare(blocked.state, { hand: [card('emberSlash', 'slash')], energy: 1 }),
      'slash',
    )
    expect(struck.enemy?.block).toBe(0)
    expect(struck.enemy?.hp).toBe(blocked.state.enemy?.hp)
  })

  it('灰卫的意图循环三回合后回到攻击 8', () => {
    let state = begin()
    const labels = ['获得 6 点护甲', '攻击 11', '攻击 8']
    for (const label of labels) {
      const ended = applyAction(state, { type: 'endTurn' })
      expect(ended.ok).toBe(true)
      if (!ended.ok) return
      state = ended.state
      expect(state.enemy?.pattern[state.enemy.patternIndex]?.label).toBe(label)
    }
  })

  it('两段 7 点攻击会连续打在护甲上', () => {
    const state = prepare(begin(), { patternIndex: 0, playerBlock: 10, playerHp: 40 })
    const frozen = freezeRun({
      ...state,
      enemy: state.enemy
        ? {
            ...state.enemy,
            pattern: [
              { kind: 'attack', damage: 7, times: 2, block: 0, label: '攻击 7×2' },
              ...state.enemy.pattern.slice(1),
            ],
            patternIndex: 0,
          }
        : null,
    })
    const next = applyAction(frozen, { type: 'endTurn' })
    expect(next.ok).toBe(true)
    if (!next.ok) return
    expect(next.state.player.hp).toBe(36)
  })

  it('出牌写入递增事件，但不改变原来的随机数和伤害', () => {
    const state = prepare(begin(), {
      hand: [card('emberSpear', 'spear'), card('emberSlash', 'slash')],
      energy: 3,
      enemyHp: 30,
    })
    const first = play(state, 'spear')
    const second = play(first, 'slash')
    expect(second.enemy?.hp).toBe(21)
    expect(second.rngState).toBe(state.rngState)
    expect(second.player.statuses).toEqual([])
    expect(second.enemy?.statuses).toEqual([])
    expect(second.log).toEqual([
      '打出烬矛突刺',
      '烬矛突刺造成 3 点伤害，共 1 次',
      '打出余烬斩',
      '余烬斩造成 6 点伤害，共 1 次',
    ])
    expect(second.events.map((event) => event.id)).toEqual([1, 2, 3, 4, 5, 6])
    expect(second.events.filter((event) => event.type === 'damageDealt')).toHaveLength(2)
  })

  it('灰烬连斩的两段伤害分别记录护甲吸收', () => {
    const state = prepare(begin(), {
      hand: [card('ashFlurry', 'flurry')],
      energy: 1,
      enemyHp: 20,
      enemyBlock: 5,
    })
    const next = play(state, 'flurry')
    const hits = next.events.filter((event) => event.type === 'damageDealt')
    expect(hits).toEqual([
      expect.objectContaining({ hitIndex: 0, blocked: 4, hpLoss: 0 }),
      expect.objectContaining({ hitIndex: 1, blocked: 1, hpLoss: 3 }),
    ])
    expect(next.log).toEqual(['打出灰烬连斩', '灰烬连斩造成 4 点伤害，共 2 次'])
  })

  it('玩家身上的易伤会提高敌人这次攻击，并在行动后移除', () => {
    const state = prepare(begin(), {
      playerHp: 50,
      playerBlock: 0,
      playerStatuses: [{ id: 'vulnerable', amount: 1, deferred: 0 }],
    })
    const next = applyAction(state, { type: 'endTurn' })
    expect(next.ok).toBe(true)
    if (!next.ok) return
    expect(next.state.player.hp).toBe(38)
    expect(next.state.player.statuses).toEqual([])
    expect(next.state.log).toEqual(['灰卫：攻击 8'])
    expect(next.state.events.some((event) => event.type === 'statusExpired')).toBe(true)
    expect(next.state.rngState).toBe(state.rngState)
  })

  it('敌人阶段刚获得的虚弱不会在同一轮结束时被减掉', () => {
    const state = prepare(begin(), {
      playerHp: 50,
      playerBlock: 0,
      playerStatuses: [{ id: 'weak', amount: 1, deferred: 1 }],
    })
    const next = applyAction(state, { type: 'endTurn' })
    expect(next.ok).toBe(true)
    if (!next.ok) return
    expect(next.state.player.hp).toBe(42)
    expect(next.state.player.statuses).toEqual([{ id: 'weak', amount: 1, deferred: 0 }])
    expect(next.state.events.some((event) => event.type === 'statusTicked' && event.status === 'weak')).toBe(true)
  })

  it('敌人获得护甲只保留原来的意图记录', () => {
    const state = prepare(begin(), { patternIndex: 1, playerHp: 50, playerBlock: 0 })
    const next = applyAction(state, { type: 'endTurn' })
    expect(next.ok).toBe(true)
    if (!next.ok) return
    expect(next.state.enemy?.block).toBe(6)
    expect(next.state.log).toEqual(['灰卫：获得 6 点护甲'])
  })

  it('牌堆和弃牌堆都空时结束回合不会抛错', () => {
    const state = prepare(begin(), {
      hand: [],
      drawPile: [],
      discardPile: [],
      playerHp: 50,
      playerBlock: 0,
    })
    const next = applyAction(state, { type: 'endTurn' })
    expect(next.ok).toBe(true)
    if (!next.ok) return
    expect(next.state.hand).toHaveLength(0)
    expect(next.state.player.hp).toBe(42)
  })
})
