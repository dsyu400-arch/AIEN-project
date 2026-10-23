// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode, useReducer } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyAction, createEnemy, createRun, getCard } from '../game/index.ts'
import { startBattle } from '../game/combat.ts'
import { nextRng } from '../game/rng.ts'
import { begin, card, prepare } from '../game/test-utils.ts'
import type { GameAction, RunState } from '../game/index.ts'
import { diffCombat, missFloatsSince } from './feedback.ts'
import type { CombatSnapshot } from './feedback.ts'
import { BattleScreen } from './screens/BattleScreen.tsx'
import { RewardScreen } from './screens/RewardScreen.tsx'
import { GHOST_MS } from './useCombatPresentation.ts'
import './styles/play.css'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function startedBattle(): RunState {
  return applyAction(createRun(1), { type: 'startRun' }).state
}

function controlledBattle(): RunState {
  return prepare(begin(1), {
    hand: [card('emberSlash', 'slash-a'), card('emberSlash', 'slash-b'), card('ashShield', 'shield')],
    energy: 3,
    enemyHp: 36,
    enemyBlock: 0,
    playerBlock: 0,
  })
}

function Harness({ initial }: { initial: RunState }) {
  const [state, dispatch] = useReducer(
    (current: RunState, action: GameAction) => applyAction(current, action).state,
    initial,
  )
  return <BattleScreen state={state} onAction={dispatch} />
}

function buttonByDefinition(id: string): HTMLButtonElement {
  const button = screen.getAllByRole('button').find((item): item is HTMLButtonElement => {
    return item instanceof HTMLButtonElement && item.dataset.definitionId === id && !item.disabled
  })
  if (!button) throw new Error(`缺少可打出的 ${id}`)
  return button
}

function handCount(): number {
  return screen.getAllByRole('button').filter((button) => button instanceof HTMLButtonElement && button.dataset.instanceId).length
}

const baseSnap: CombatSnapshot = {
  turn: 1,
  playerHp: 50,
  playerBlock: 0,
  playerEnergy: 3,
  enemyHp: 36,
  enemyBlock: 0,
}

describe('战斗反馈', () => {
  it('按真实生命变化显示总伤害，护甲吸收后不使用卡牌基础伤害', () => {
    const partial = diffCombat({ ...baseSnap, enemyBlock: 5 }, { ...baseSnap, enemyHp: 35, enemyBlock: 0, playerEnergy: 2 })
    expect(partial.floats.map((float) => float.text)).toEqual(['-1'])
    expect(partial.cue.enemyShake).toBe(true)
    expect(partial.cue.enemyFlash).toBe(true)

    const blocked = diffCombat({ ...baseSnap, enemyBlock: 8 }, { ...baseSnap, enemyBlock: 2, playerEnergy: 2 })
    expect(blocked.floats).toEqual([])
    expect(blocked.cue.enemyShake).toBe(false)
    expect(blocked.cue.enemyFlash).toBe(true)

    const shield = diffCombat(baseSnap, { ...baseSnap, playerBlock: 5, playerEnergy: 2 })
    expect(shield.floats).toEqual([{ target: 'player', kind: 'block', text: '+5' }])

    const heal = diffCombat(baseSnap, { ...baseSnap, playerHp: 58 })
    expect(heal.floats).toEqual([{ target: 'player', kind: 'heal', text: '+8' }])

    const multiHit = diffCombat(baseSnap, { ...baseSnap, enemyHp: 28, playerEnergy: 2 })
    expect(multiHit.floats).toEqual([{ target: 'enemy', kind: 'hurt', text: '-8' }])
  })

  it('出牌后立刻更新状态，并只结算一次', () => {
    render(<Harness initial={controlledBattle()} />)
    const before = handCount()
    fireEvent.click(buttonByDefinition('emberSlash'))

    expect(handCount()).toBe(before - 1)
    expect(screen.getByText('生命 30 / 36')).toBeTruthy()
    expect(document.querySelectorAll('.card-ghost')).toHaveLength(1)
    expect(document.querySelector('.card-ghost-attack')).toBeTruthy()
    expect(document.querySelectorAll('.float-hurt')).toHaveLength(1)
    expect(document.querySelector('.float-hurt')?.textContent).toBe('-6')
    expect(document.querySelector('.float-miss')).toBeNull()
    expect(document.querySelector('.fighter-enemy')?.classList.contains('is-shaken')).toBe(true)

    const ghost = document.querySelector('.card-ghost')
    if (!ghost) throw new Error('缺少残影')
    fireEvent.click(ghost)
    expect(screen.getByText('生命 30 / 36')).toBeTruthy()
    expect(handCount()).toBe(before - 1)
  })

  it('防御牌使用短反馈，并显示实际护甲', () => {
    render(<Harness initial={controlledBattle()} />)
    fireEvent.click(buttonByDefinition('ashShield'))
    expect(screen.getByText('护甲 5')).toBeTruthy()
    expect(document.querySelector('.card-ghost-skill')).toBeTruthy()
    expect(document.querySelector('.card-ghost-attack')).toBeNull()
    expect(document.querySelector('.float-block')?.textContent).toBe('+5')
    expect(document.querySelector('.float-hurt')).toBeNull()
    expect(document.querySelector('.fighter-player .armor-line')?.classList.contains('is-pulsing')).toBe(true)
  })

  it('结束回合立即结算敌人攻击和玩家受击', () => {
    render(<Harness initial={startedBattle()} />)
    fireEvent.click(screen.getByRole('button', { name: '结束回合' }))
    expect(screen.getByText('生命 42 / 50')).toBeTruthy()
    expect(screen.getByText('能量 3 / 3')).toBeTruthy()
    expect(screen.getByText('意图 获得 6 点护甲')).toBeTruthy()
    expect(document.querySelector('.fighter-player')?.classList.contains('is-hit')).toBe(true)
    expect(document.querySelector('.fighter-enemy')?.classList.contains('is-acting')).toBe(true)
    expect(document.querySelector('.float-hurt')?.textContent).toBe('-8')
    expect(document.querySelector('.float-energy')).toBeNull()
  })

  it('残影会清理，页面切换后不残留', () => {
    vi.useFakeTimers()
    const view = render(<Harness initial={controlledBattle()} />)
    fireEvent.click(buttonByDefinition('emberSlash'))
    expect(document.querySelector('.card-ghost')).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(GHOST_MS)
    })
    expect(document.querySelector('.card-ghost')).toBeNull()

    fireEvent.click(buttonByDefinition('emberSlash'))
    expect(document.querySelector('.card-ghost')).toBeTruthy()
    view.rerender(<RewardScreen state={{ ...startedBattle(), phase: 'reward', rewardOptions: ['emberSlash', 'ashShield', 'returnFlame'] }} onAction={() => undefined} />)
    expect(document.querySelector('.card-ghost')).toBeNull()
    expect(document.querySelector('.battle-screen')).toBeNull()
    expect(document.querySelector('.float-hurt')).toBeNull()
  })

  it('StrictMode 下同一次出牌只出现一个伤害数字', () => {
    render(
      <StrictMode>
        <Harness initial={controlledBattle()} />
      </StrictMode>,
    )
    fireEvent.click(buttonByDefinition('emberSlash'))
    expect(document.querySelectorAll('.float-hurt')).toHaveLength(1)
    expect(document.querySelectorAll('.card-ghost')).toHaveLength(1)
  })

  it('失手飘字来自失手事件，护甲吸干伤害时不会显示 MISS', () => {
    const missed = {
      id: 4,
      type: 'attackMissed' as const,
      source: { side: 'player' as const },
      target: { side: 'enemy' as const, id: 'ashGuard' },
      hitIndex: 0,
      chance: 40,
    }
    expect(missFloatsSince([], [missed])).toEqual([{ target: 'enemy', kind: 'miss', text: 'MISS' }])
    expect(missFloatsSince([missed], [missed])).toEqual([])
    const blocked = diffCombat({ ...baseSnap, enemyBlock: 8 }, { ...baseSnap, enemyBlock: 2, playerEnergy: 2 })
    expect(blocked.floats).toEqual([])
  })

  it('攻击牌显示实际命中率，失手时显示 MISS 且不扣血', () => {
    const opening = startedBattle()
    render(<Harness initial={opening} />)
    const enemy = opening.enemy
    if (!enemy) throw new Error('缺少敌人')
    expect(document.querySelector('.evasion-line')?.textContent).toBe('闪避 0 个百分点')
    const attacks = opening.hand.filter((item) => getCard(item.definitionId).cardType === 'attack')
    expect(attacks.length).toBeGreaterThan(0)
    for (const item of opening.hand) {
      const definition = getCard(item.definitionId)
      const node = document.querySelector(`[data-instance-id="${item.instanceId}"] .card-hit`)
      if (definition.cardType !== 'attack') {
        expect(node).toBeNull()
        continue
      }
      const segments = definition.effects.reduce((total, effect) => (effect.type === 'damage' ? total + effect.times : total), 0)
      const chance = definition.accuracy ?? 100
      expect(node?.textContent).toBe(segments > 1 ? `每段命中 ${chance}%` : `命中 ${chance}%`)
    }
    cleanup()

    const missAt25 = (() => {
      let state = 1
      for (let attempt = 0; attempt < 100000; attempt += 1) {
        const rolled = nextRng(state)
        if (rolled.value >= 0.25) return state
        state = (state + 1) >>> 0
      }
      throw new Error('找不到失手随机数')
    })()
    const prepared = prepare(begin(), {
      hand: [card('emberSlash', 'slash')],
      energy: 1,
      enemyHp: 36,
      enemyBlock: 6,
      enemyStatuses: [{ id: 'evasion', amount: 80, deferred: 0 }],
      hitRngState: missAt25,
    })
    render(<Harness initial={prepared} />)
    expect(document.querySelector('.card-hit')?.textContent).toBe('命中 25%')
    fireEvent.click(buttonByDefinition('emberSlash'))
    expect(document.querySelector('.float-miss')?.textContent).toBe('MISS')
    expect(document.querySelector('.float-hurt')).toBeNull()
    expect(document.querySelector('.fighter-enemy')?.textContent).toContain('生命 36 / 36')
    expect(document.querySelector('.fighter-enemy')?.textContent).toContain('护甲 6')
    expect(document.querySelector('.fighter-player')?.textContent).toContain('能量 0')
  })

  it('拉弓之后攻击牌预览使用覆写后的基础命中率', () => {
    const prepared = prepare(begin(), {
      hand: [card('drawBow', 'bow'), card('scatteredShot', 'shot')],
      energy: 3,
      enemyHp: 40,
      enemyStatuses: [{ id: 'evasion', amount: 20, deferred: 0 }],
    })
    render(<Harness initial={prepared} />)
    expect(document.querySelector('[data-definition-id="scatteredShot"] .card-hit')?.textContent).toBe('命中 40%')
    fireEvent.click(buttonByDefinition('drawBow'))
    expect(screen.getByText('下一张攻击基础命中 100%')).toBeTruthy()
    expect(document.querySelector('[data-definition-id="scatteredShot"] .card-hit')?.textContent).toBe('命中 80%')
    expect(screen.getByRole('button', { name: /力量/ }).textContent).toContain('1 层')
    expect(document.querySelector('.card-hit')?.textContent).not.toBe('必定命中')
  })

  it('六张新牌、拉弓、校准、破绽和敌人闪避都能在界面上读到', () => {
    const wolf = prepare(startBattle(createRun(1), createEnemy(1)), {
      hand: [
        card('drawBow', 'bow'),
        card('emberArrow', 'arrow'),
        card('ruinArrow', 'ruin'),
        card('chainArrow', 'chain'),
        card('calibrate', 'cal'),
        card('riftMark', 'mark'),
      ],
      drawPile: [card('ashShield', 'extra')],
      energy: 3,
      enemyHp: 48,
    })
    render(<Harness initial={wolf} />)
    expect(screen.getByRole('heading', { name: '烬狼' })).toBeTruthy()
    expect(document.querySelector('.evasion-line')?.textContent).toBe('闪避 10 个百分点')
    expect(screen.getByRole('button', { name: /闪避/ }).textContent).toContain('10 层')
    for (const [id, name, kind] of [
      ['emberArrow', '烬矢', '攻击'],
      ['ruinArrow', '破灭重矢', '攻击'],
      ['chainArrow', '连珠烬箭', '攻击'],
      ['drawBow', '拉弓', '技能'],
      ['calibrate', '校准', '技能'],
      ['riftMark', '裂隙标记', '技能'],
    ] as const) {
      const face = document.querySelector(`[data-definition-id="${id}"]`)
      expect(face?.textContent).toContain(name)
      expect(face?.textContent).toContain(kind)
    }
    expect(document.querySelector('[data-definition-id="emberArrow"] .card-hit')?.textContent).toBe('命中 65%')
    expect(document.querySelector('[data-definition-id="ruinArrow"] .card-hit')?.textContent).toBe('命中 50%')
    expect(document.querySelector('[data-definition-id="chainArrow"] .card-hit')?.textContent).toBe('每段命中 70%')
    expect(document.querySelector('[data-definition-id="ruinArrow"]')?.getAttribute('data-cost')).toBe('2')
    expect(document.querySelector('[data-definition-id="calibrate"]')?.getAttribute('data-cost')).toBe('0')

    fireEvent.click(buttonByDefinition('calibrate'))
    expect(screen.getByRole('button', { name: /瞄准/ }).textContent).toContain('1 次')
    expect(screen.getByRole('button', { name: '消耗 1' })).toBeTruthy()
    expect(document.querySelector('[data-definition-id="emberArrow"] .card-hit')?.textContent).toBe('命中 85%')
    expect(document.querySelector('[data-definition-id="chainArrow"] .card-hit')?.textContent).toBe('每段命中 90%')

    fireEvent.click(buttonByDefinition('drawBow'))
    expect(screen.getByText('下一张攻击基础命中 100%')).toBeTruthy()
    expect(screen.getByRole('button', { name: /力量/ }).textContent).toContain('1 层')
    expect(document.querySelector('[data-definition-id="emberArrow"] .card-hit')?.textContent).toBe('命中 100%')
    expect(document.querySelector('[data-definition-id="chainArrow"] .card-hit')?.textContent).toBe('每段命中 100%')
    expect(document.querySelector('[data-definition-id="emberArrow"] .card-hit')?.textContent).not.toBe('必定命中')

    fireEvent.click(buttonByDefinition('riftMark'))
    expect(screen.getByRole('button', { name: /破绽/ }).textContent).toContain('2 回合')
    expect(screen.getByRole('button', { name: /闪避/ }).textContent).toContain('10 层')
    expect(document.querySelector('[data-definition-id="ashShield"]')).toBeTruthy()
  })

  it('奖励里的新牌沿用现有卡面', () => {
    render(
      <RewardScreen
        state={{
          ...startedBattle(),
          phase: 'reward',
          rewardOptions: ['emberArrow', 'drawBow', 'calibrate'],
        }}
        onAction={() => undefined}
      />,
    )
    expect(screen.getByRole('button', { name: '选择烬矢' }).className).toContain('card-attack')
    expect(screen.getByRole('button', { name: '选择拉弓' }).className).toContain('card-skill')
    expect(screen.getByRole('button', { name: '选择校准' }).textContent).toContain('消耗')
    expect(screen.getByRole('button', { name: '选择烬矢' }).textContent).toContain('基础命中率 75%')
  })
})
