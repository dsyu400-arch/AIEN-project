// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode, useReducer } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyAction, createRun } from '../game/index.ts'
import type { GameAction, RunState } from '../game/index.ts'
import { diffCombat } from './feedback.ts'
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
    render(<Harness initial={startedBattle()} />)
    const before = handCount()
    fireEvent.click(buttonByDefinition('emberSlash'))

    expect(handCount()).toBe(before - 1)
    expect(screen.getByText('生命 30 / 36')).toBeTruthy()
    expect(document.querySelectorAll('.card-ghost')).toHaveLength(1)
    expect(document.querySelector('.card-ghost-attack')).toBeTruthy()
    expect(document.querySelectorAll('.float-hurt')).toHaveLength(1)
    expect(document.querySelector('.float-hurt')?.textContent).toBe('-6')
    expect(document.querySelector('.fighter-enemy')?.classList.contains('is-shaken')).toBe(true)

    const ghost = document.querySelector('.card-ghost')
    if (!ghost) throw new Error('缺少残影')
    fireEvent.click(ghost)
    expect(screen.getByText('生命 30 / 36')).toBeTruthy()
    expect(handCount()).toBe(before - 1)
  })

  it('防御牌使用短反馈，并显示实际护甲', () => {
    render(<Harness initial={startedBattle()} />)
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
    const view = render(<Harness initial={startedBattle()} />)
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
        <Harness initial={startedBattle()} />
      </StrictMode>,
    )
    fireEvent.click(buttonByDefinition('emberSlash'))
    expect(document.querySelectorAll('.float-hurt')).toHaveLength(1)
    expect(document.querySelectorAll('.card-ghost')).toHaveLength(1)
  })
})
