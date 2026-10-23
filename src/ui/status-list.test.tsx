// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createEnemy, createRun } from '../game/index.ts'
import type { RunState } from '../game/index.ts'
import { BattleScreen } from './screens/BattleScreen.tsx'
import './styles/play.css'

afterEach(() => {
  cleanup()
})

function battle(): RunState {
  const state = createRun(1)
  const enemy = createEnemy(0)
  return {
    ...state,
    phase: 'playerTurn',
    turn: 1,
    enemy: { ...enemy, statuses: [{ id: 'weak', amount: 1, deferred: 0 }] },
    player: {
      ...state.player,
      statuses: [
        { id: 'strength', amount: 2, deferred: 0 },
        { id: 'poison', amount: 3, deferred: 0 },
      ],
    },
  }
}

describe('状态展示', () => {
  it('按真实层数区分正负面，并能查看含义', () => {
    const view = render(<BattleScreen state={battle()} onAction={() => undefined} />)
    const player = screen.getByRole('list', { name: '你的状态' })
    expect(player.querySelector('.status-buff')).toBeTruthy()
    expect(player.querySelector('.status-debuff')).toBeTruthy()
    expect(screen.getByRole('button', { name: /力量/ }).textContent).toContain('2 层')
    expect(screen.getByRole('button', { name: /中毒/ }).textContent).toContain('3 层')
    expect(screen.getByRole('button', { name: /虚弱/ }).textContent).toContain('1 回合')

    fireEvent.click(screen.getByRole('button', { name: /力量/ }))
    expect(screen.getByText('每层使每段攻击伤害 +1，可以为负数。')).toBeTruthy()

    const empty = battle()
    view.rerender(
      <BattleScreen
        state={{
          ...empty,
          player: { ...empty.player, statuses: [] },
          enemy: empty.enemy ? { ...empty.enemy, statuses: [] } : null,
        }}
        onAction={() => undefined}
      />,
    )
    expect(screen.queryByRole('list', { name: '你的状态' })).toBeNull()
    expect(screen.queryByRole('list', { name: '敌人状态' })).toBeNull()
  })

  it('负力量显示真实数值', () => {
    const state = battle()
    render(
      <BattleScreen
        state={{ ...state, player: { ...state.player, statuses: [{ id: 'strength', amount: -2, deferred: 0 }] } }}
        onAction={() => undefined}
      />,
    )
    expect(screen.getByRole('button', { name: /力量/ }).textContent).toContain('-2 层')
  })
})
