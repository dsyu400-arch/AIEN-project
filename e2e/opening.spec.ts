import { expect, test } from '@playwright/test'
import { getCard } from '../src/game/index.ts'
import type { CardId } from '../src/game/index.ts'
import {
  clickCard,
  findHandCard,
  inspectDrawPile,
  openGame,
  prepareUnaffordableCard,
  readHand,
  singleStrike,
  startRun,
  stat,
} from './support.ts'

test('打开首页并显示游戏标题', async ({ page }) => {
  await openGame(page)
  await expect(page.getByRole('heading', { level: 1, name: '遗烬之塔' })).toBeVisible()
  await expect(page.getByRole('button', { name: '开始游戏' })).toBeVisible()
})

test('固定种子下两次开局手牌一致', async ({ page }) => {
  await openGame(page)
  await startRun(page)
  const first = (await readHand(page)).map((card) => card.definitionId)
  await openGame(page)
  await startRun(page)
  const second = (await readHand(page)).map((card) => card.definitionId)
  expect(second).toEqual(first)
  expect(first).toHaveLength(5)
})

test.describe('第一场战斗', () => {
  test.beforeEach(async ({ page }) => {
    await openGame(page)
    await startRun(page)
  })

  test('开始游戏后进入第一场战斗', async ({ page }) => {
    await expect(page.getByTestId('run')).toHaveAttribute('data-phase', 'playerTurn')
    await expect(page.getByRole('heading', { name: '灰卫' })).toBeVisible()
    await expect(page.getByText('第 1 / 3 场')).toBeVisible()
    await expect(page.locator('.intent')).toHaveText('意图 攻击 8')
  })

  test('初始生命为 50', async ({ page }) => {
    expect(await stat(page, 'player', '生命')).toBe(50)
    await expect(page.locator('.fighter-player').getByText('生命 50 / 50')).toBeVisible()
    expect(await stat(page, 'enemy', '生命')).toBe(36)
  })

  test('初始能量为 3', async ({ page }) => {
    expect(await stat(page, 'player', '能量')).toBe(3)
    await expect(page.locator('.fighter-player').getByText('能量 3 / 3')).toBeVisible()
    await expect(page.getByTestId('battle')).toHaveAttribute('data-energy', '3')
  })

  test('初始手牌为 5 张', async ({ page }) => {
    await expect(page.locator('.hand')).toHaveAttribute('data-count', '5')
    await expect(page.locator('.hand .card')).toHaveCount(5)
  })

  test('打出攻击牌后敌人生命减少', async ({ page }) => {
    const attack = await findHandCard(page, (card, definition) => !card.disabled && singleStrike(definition) > 0)
    const dealt = singleStrike(getCard(attack.definitionId as CardId))
    const before = await stat(page, 'enemy', '生命')
    const block = await stat(page, 'enemy', '护甲')
    await clickCard(page, attack.instanceId)
    expect(dealt).toBeGreaterThan(block)
    expect(await stat(page, 'enemy', '生命')).toBe(before - (dealt - block))
  })

  test('打出防御牌后护甲增加', async ({ page }) => {
    const shield = await findHandCard(page, (card, definition) => {
      return !card.disabled && definition.effects.some((effect) => effect.type === 'block')
    })
    const gain = getCard(shield.definitionId).effects.reduce((total, effect) => {
      return effect.type === 'block' ? total + effect.amount : total
    }, 0)
    const before = await stat(page, 'player', '护甲')
    await clickCard(page, shield.instanceId)
    expect(gain).toBeGreaterThan(0)
    expect(await stat(page, 'player', '护甲')).toBe(before + gain)
  })

  test('能量不足的牌无法使用', async ({ page }) => {
    const disabled = await prepareUnaffordableCard(page)
    await expect(disabled).toBeDisabled()
    const cost = Number(await disabled.getAttribute('data-cost'))
    const enemyBefore = await stat(page, 'enemy', '生命')
    const blockBefore = await stat(page, 'player', '护甲')
    const energyBefore = await stat(page, 'player', '能量')
    const handBefore = await page.locator('.hand .card').count()
    expect(energyBefore).toBeLessThan(cost)
    await disabled.evaluate((element) => {
      element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    expect(await stat(page, 'enemy', '生命')).toBe(enemyBefore)
    expect(await stat(page, 'player', '护甲')).toBe(blockBefore)
    expect(await stat(page, 'player', '能量')).toBe(energyBefore)
    await expect(page.locator('.hand .card')).toHaveCount(handBefore)
  })

  test('结束回合后敌人会行动', async ({ page }) => {
    expect(await stat(page, 'player', '生命')).toBe(50)
    await expect(page.locator('.intent')).toHaveText('意图 攻击 8')
    await page.getByRole('button', { name: '结束回合' }).click()
    await expect(page.locator('.fighter-player').getByText('生命 42 / 50')).toBeVisible()
    await expect(page.getByText('灰卫：攻击 8')).toBeVisible()
    await expect(page.locator('.fighter-player').getByText('能量 3 / 3')).toBeVisible()
  })

  test('结束回合后敌人意图更新', async ({ page }) => {
    await expect(page.locator('.intent')).toHaveText('意图 攻击 8')
    await page.getByRole('button', { name: '结束回合' }).click()
    await expect(page.locator('.intent')).toHaveText('意图 获得 6 点护甲')
  })

  test('抽牌堆可以打开并关闭', async ({ page }) => {
    await expect(page.getByRole('button', { name: '抽牌堆 5' })).toBeVisible()
    await inspectDrawPile(page)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
