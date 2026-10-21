// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createEnemy, createRun } from '../game/index.ts'
import type { CardId, RunState } from '../game/index.ts'
import { BattleScreen } from './screens/BattleScreen.tsx'
import { RewardScreen } from './screens/RewardScreen.tsx'
import './styles/play.css'

afterEach(() => {
  cleanup()
})

function battleWithHand(count: number): RunState {
  const state = createRun(1)
  const ids = ['emberSlash', 'ashShield'] as const satisfies readonly CardId[]
  return {
    ...state,
    phase: 'playerTurn',
    enemy: createEnemy(0),
    turn: 1,
    hand: Array.from({ length: count }, (_, index) => ({
      instanceId: `hand-${index}`,
      definitionId: ids[index % ids.length] ?? 'emberSlash',
    })),
  }
}

describe('战斗布局', () => {
  it('五张和十张手牌都留在同一行，且关键文案还在', () => {
    const { rerender } = render(<BattleScreen state={battleWithHand(5)} onAction={() => undefined} />)
    const hand = document.querySelector('.hand')
    expect(hand?.getAttribute('data-count')).toBe('5')
    expect(hand?.classList.contains('hand')).toBe(true)
    expect(screen.getAllByRole('button').filter((button) => button.dataset.instanceId)).toHaveLength(5)
    expect(screen.getByRole('heading', { name: '灰卫' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '结束回合' })).toBeTruthy()
    expect(screen.getByText('生命 50 / 50')).toBeTruthy()
    expect(screen.getByText('能量 3 / 3')).toBeTruthy()
    expect(screen.getByText('意图 攻击 8')).toBeTruthy()
    expect(screen.getByText('第 1 / 3 场')).toBeTruthy()

    rerender(<BattleScreen state={battleWithHand(10)} onAction={() => undefined} />)
    const crowded = document.querySelector('.hand')
    expect(crowded?.getAttribute('data-count')).toBe('10')
    const cards = screen.getAllByRole('button').filter((button): button is HTMLButtonElement => {
      return button instanceof HTMLButtonElement && Boolean(button.dataset.instanceId)
    })
    expect(cards).toHaveLength(10)
    expect(cards.every((button) => !button.disabled)).toBe(true)
    expect(cards.every((button) => button.tabIndex === 0)).toBe(true)
  })

  it('奖励三选一复用卡面文案', () => {
    const state = createRun(1)
    render(
      <RewardScreen
        state={{ ...state, phase: 'reward', battleIndex: 0, rewardOptions: ['emberSlash', 'ashShield', 'returnFlame'] }}
        onAction={() => undefined}
      />,
    )
    const rewards = screen.getAllByRole('button').filter((button) => button.dataset.reward === 'true')
    expect(rewards).toHaveLength(3)
    expect(screen.getByRole('button', { name: '选择余烬斩' })).toBeTruthy()
    expect(screen.getByText('造成 6 点伤害。')).toBeTruthy()
    expect(screen.getByText('获得 5 点护甲。')).toBeTruthy()
    expect(screen.getByText('选择一张牌')).toBeTruthy()
  })
})
