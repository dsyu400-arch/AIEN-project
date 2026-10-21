// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../App.tsx'
import { getCard } from '../game/index.ts'
import type { CardDefinition, CardId } from '../game/index.ts'

afterEach(() => {
  cleanup()
})

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

function phase(): string | undefined {
  return screen.getByTestId('run').dataset.phase
}

function handCards(): HTMLButtonElement[] {
  return screen.getAllByRole('button').filter((button): button is HTMLButtonElement => {
    return button instanceof HTMLButtonElement && Boolean(button.dataset.instanceId)
  })
}

function chooseCard(hp: number, threat: number): HTMLButtonElement | undefined {
  const playable = handCards()
    .filter((button) => !button.disabled)
    .map((button) => ({
      button,
      definition: getCard(button.dataset.definitionId as CardId),
    }))
    .filter((entry) => !killsSelf(entry.definition, hp))
  const blocks = playable.filter((entry) => blockOf(entry.definition) > 0)
  const attacks = playable.filter((entry) => damageOf(entry.definition) > 0)
  const utility = playable.filter((entry) =>
    entry.definition.effects.some((effect) => effect.type === 'draw' || effect.type === 'gainEnergy'),
  )
  const choice =
    (threat > 0 ? blocks.sort((left, right) => blockOf(right.definition) - blockOf(left.definition))[0] : undefined) ??
    attacks.sort((left, right) => damageOf(right.definition) - damageOf(left.definition))[0] ??
    utility[0] ??
    playable[0]
  return choice?.button
}

describe('游戏界面', () => {
  it('从封面开始第一场战斗，并能出牌、结束回合、查看牌堆', () => {
    render(<App seed={1} />)
    fireEvent.click(screen.getByRole('button', { name: '开始游戏' }))

    expect(phase()).toBe('playerTurn')
    expect(screen.getByRole('heading', { name: '灰卫' })).toBeTruthy()
    expect(screen.getByText('意图 攻击 8')).toBeTruthy()
    expect(screen.getByText('能量 3 / 3')).toBeTruthy()
    expect(screen.getByText('生命 50 / 50')).toBeTruthy()
    expect(screen.getByText('第 1 / 3 场')).toBeTruthy()
    expect(handCards().length).toBeGreaterThan(0)

    const before = handCards().length
    const playable = handCards().find((button) => !button.disabled)
    expect(playable).toBeTruthy()
    fireEvent.click(playable as HTMLButtonElement)
    expect(handCards().length).toBe(before - 1)

    fireEvent.click(screen.getByRole('button', { name: /^抽牌堆/ }))
    expect(screen.getByRole('dialog', { name: '抽牌堆' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '结束回合' }))
    expect(screen.getByText('意图 获得 6 点护甲')).toBeTruthy()
    expect(screen.getByText('能量 3 / 3')).toBeTruthy()
  })

  it('可以打完三场战斗、领取奖励，并重新开始', () => {
    render(<App seed={1} />)
    fireEvent.click(screen.getByRole('button', { name: '开始游戏' }))

    for (let step = 0; step < 250 && phase() !== 'victory' && phase() !== 'defeat'; step += 1) {
      if (phase() === 'reward') {
        expect(screen.getByText(/回复/)).toBeTruthy()
        const rewards = screen.getAllByRole('button').filter((button) => button.dataset.reward === 'true')
        expect(rewards).toHaveLength(3)
        fireEvent.click(rewards[0] as HTMLButtonElement)
        continue
      }
      const battle = screen.getByTestId('battle')
      const hp = Number(battle.dataset.hp)
      const threat = Math.max(0, Number(battle.dataset.threat) - Number(battle.dataset.block))
      const choice = chooseCard(hp, threat)
      if (choice) {
        fireEvent.click(choice)
        continue
      }
      fireEvent.click(screen.getByRole('button', { name: '结束回合' }))
    }

    expect(phase()).toBe('victory')
    expect(screen.getByRole('heading', { name: '你登上了塔顶' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '重新开始' }))
    expect(phase()).toBe('menu')
    expect(screen.getByRole('button', { name: '开始游戏' })).toBeTruthy()
  })
})
