import { describe, expect, it } from 'vitest'
import { applyAction } from './run.ts'
import type { Intent, RunState } from './types.ts'
import { begin, card, must, play, prepare } from './test-utils.ts'

function withPattern(state: RunState, pattern: readonly Intent[]): RunState {
  return {
    ...state,
    enemy: state.enemy ? { ...state.enemy, pattern, patternIndex: 0 } : null,
  }
}

describe('传统状态战斗', () => {
  it('力量加在每一段上，负力量可以把伤害降到 0', () => {
    const strengthened = prepare(begin(), {
      hand: [card('ashFlurry', 'flurry')],
      energy: 1,
      enemyHp: 40,
      playerStatuses: [{ id: 'strength', amount: 3, deferred: 0 }],
    })
    const hit = play(strengthened, 'flurry')
    expect(hit.enemy?.hp).toBe(26)
    expect(hit.events.flatMap((event) => (event.type === 'damageDealt' ? [event.amount] : []))).toEqual([7, 7])
    expect(hit.rngState).toBe(strengthened.rngState)

    const weakened = prepare(begin(), {
      hand: [card('emberSlash', 'slash')],
      energy: 1,
      enemyHp: 30,
      playerStatuses: [{ id: 'strength', amount: -8, deferred: 0 }],
    })
    expect(play(weakened, 'slash').enemy?.hp).toBe(30)
  })

  it('玩家阶段施加的虚弱会削弱敌人下一次攻击，并在那次行动后消失', () => {
    const state = prepare(begin(), {
      playerHp: 50,
      playerBlock: 0,
      enemyStatuses: [{ id: 'weak', amount: 1, deferred: 0 }],
    })
    const next = must(applyAction(state, { type: 'endTurn' }))
    expect(next.player.hp).toBe(44)
    expect(next.enemy?.statuses).toEqual([])
    expect(next.rngState).toBe(state.rngState)
  })

  it('玩家阶段施加的易伤让本回合后续攻击受益', () => {
    const state = prepare(begin(), {
      hand: [card('emberSpear', 'spear')],
      energy: 1,
      enemyHp: 30,
      enemyStatuses: [{ id: 'vulnerable', amount: 1, deferred: 0 }],
    })
    const next = play(state, 'spear')
    expect(next.enemy?.hp).toBe(26)
    expect(next.enemy?.statuses).toEqual([{ id: 'vulnerable', amount: 1, deferred: 0 }])
  })

  it('敌人刚施加的易伤不会在同一轮过期，下一次攻击才会提高伤害', () => {
    const state = withPattern(prepare(begin(), { playerHp: 50, playerBlock: 0 }), [
      {
        kind: 'attack',
        damage: 8,
        times: 1,
        block: 0,
        label: '攻击 8，施加易伤',
        apply: [{ status: 'vulnerable', amount: 1, target: 'player' }],
      },
      { kind: 'attack', damage: 8, times: 1, block: 0, label: '攻击 8' },
    ])
    const first = must(applyAction(state, { type: 'endTurn' }))
    expect(first.player.hp).toBe(42)
    expect(first.player.statuses).toEqual([{ id: 'vulnerable', amount: 1, deferred: 0 }])
    const second = must(applyAction(first, { type: 'endTurn' }))
    expect(second.player.hp).toBe(30)
    expect(second.player.statuses).toEqual([])
  })

  it('叠加新层数时，原来的层数仍会正常减少', () => {
    const state = withPattern(
      prepare(begin(), {
        playerBlock: 0,
        playerStatuses: [{ id: 'frail', amount: 3, deferred: 0 }],
      }),
      [
        {
          kind: 'block',
          damage: 0,
          times: 0,
          block: 0,
          label: '施加脆弱',
          apply: [{ status: 'frail', amount: 1, target: 'player' }],
        },
      ],
    )
    const next = must(applyAction(state, { type: 'endTurn' }))
    expect(next.player.statuses).toEqual([{ id: 'frail', amount: 3, deferred: 0 }])
  })

  it('敏捷和脆弱改变卡牌格挡，不改变敌人意图获得的护甲', () => {
    const shielded = prepare(begin(), {
      hand: [card('ashShield', 'shield')],
      energy: 1,
      playerStatuses: [
        { id: 'dexterity', amount: 2, deferred: 0 },
        { id: 'frail', amount: 1, deferred: 0 },
      ],
    })
    expect(play(shielded, 'shield').player.block).toBe(5)

    const guarding = prepare(begin(), {
      patternIndex: 1,
      enemyStatuses: [
        { id: 'dexterity', amount: 4, deferred: 0 },
        { id: 'frail', amount: 2, deferred: 0 },
      ],
    })
    const ended = must(applyAction(guarding, { type: 'endTurn' }))
    expect(ended.enemy?.block).toBe(6)
  })

  it('焚心一击的自伤不吃易伤，敌人身上的易伤仍会提高攻击', () => {
    const state = prepare(begin(), {
      hand: [card('heartBurn', 'burn')],
      energy: 1,
      playerHp: 20,
      playerBlock: 10,
      enemyHp: 30,
      playerStatuses: [{ id: 'vulnerable', amount: 2, deferred: 0 }],
      enemyStatuses: [{ id: 'vulnerable', amount: 1, deferred: 0 }],
    })
    const next = play(state, 'burn')
    expect(next.enemy?.hp).toBe(17)
    expect(next.player.hp).toBe(18)
    expect(next.player.block).toBe(10)
  })

  it('中毒在玩家回合开始扣血并减层，杀死玩家时不抽牌', () => {
    const surviving = withPattern(
      prepare(begin(), {
        playerHp: 50,
        playerBlock: 10,
        playerStatuses: [{ id: 'poison', amount: 4, deferred: 0 }],
      }),
      [{ kind: 'block', damage: 0, times: 0, block: 0, label: '等待' }],
    )
    const lived = must(applyAction(surviving, { type: 'endTurn' }))
    expect(lived.player.hp).toBe(46)
    expect(lived.player.block).toBe(0)
    expect(lived.player.statuses).toEqual([{ id: 'poison', amount: 3, deferred: 0 }])
    expect(lived.phase).toBe('playerTurn')
    expect(lived.log).toContain('中毒失去 4 点生命')

    const dying = withPattern(
      prepare(begin(), {
        playerHp: 6,
        playerBlock: 8,
        playerStatuses: [{ id: 'poison', amount: 8, deferred: 0 }],
      }),
      [{ kind: 'block', damage: 0, times: 0, block: 0, label: '等待' }],
    )
    const beforeDraw = dying.drawPile.length
    const dead = must(applyAction(dying, { type: 'endTurn' }))
    expect(dead.phase).toBe('defeat')
    expect(dead.player.hp).toBe(0)
    expect(dead.player.statuses).toEqual([])
    expect(dead.hand).toHaveLength(0)
    expect(dead.drawPile).toHaveLength(beforeDraw)
    expect(dead.turn).toBe(1)
    expect(dead.log).toContain('你倒下了')
  })

  it('中毒杀死敌人时敌人不再攻击，没死则攻击照常发生', () => {
    const lethal = prepare(begin(), {
      playerHp: 40,
      playerBlock: 0,
      enemyHp: 5,
      enemyStatuses: [{ id: 'poison', amount: 5, deferred: 0 }],
    })
    const won = must(applyAction(lethal, { type: 'endTurn' }))
    expect(won.phase).toBe('reward')
    expect(won.player.hp).toBe(48)
    expect(won.player.statuses).toEqual([])
    expect(won.enemy).toBeNull()

    const living = prepare(begin(), {
      playerHp: 50,
      playerBlock: 0,
      enemyHp: 20,
      enemyStatuses: [{ id: 'poison', amount: 3, deferred: 0 }],
    })
    const fought = must(applyAction(living, { type: 'endTurn' }))
    expect(fought.phase).toBe('playerTurn')
    expect(fought.enemy?.hp).toBe(17)
    expect(fought.enemy?.statuses).toEqual([{ id: 'poison', amount: 2, deferred: 0 }])
    expect(fought.player.hp).toBe(42)
  })

  it('胜利后清空战斗状态', () => {
    const state = prepare(begin(), {
      hand: [card('emberSlash', 'finisher')],
      energy: 1,
      enemyHp: 6,
      playerStatuses: [{ id: 'strength', amount: 2, deferred: 0 }],
    })
    const reward = play(state, 'finisher')
    expect(reward.phase).toBe('reward')
    expect(reward.player.statuses).toEqual([])
    expect(reward.enemy).toBeNull()
  })
})
