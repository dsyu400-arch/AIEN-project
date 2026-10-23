import { expect, test } from '@playwright/test'
import {
  fightToReward,
  openGame,
  phase,
  playUntilVictory,
  rewardSummary,
  startRun,
} from './support.ts'

test('真实操作打完三场战斗', async ({ page }) => {
  await openGame(page)
  await startRun(page)
  let tracked = { hpBefore: 0, selfDamage: 0 }

  await test.step('击败第一关进入三选一', async () => {
    tracked = await fightToReward(page)
    await expect(page.getByRole('heading', { name: '选择一张牌' })).toBeVisible()
    await expect(page.getByText('第 1 场胜利')).toBeVisible()
    await expect(page.locator('[data-reward="true"]')).toHaveCount(3)
    await expect(page.locator('.card-ghost')).toHaveCount(0)
    await expect(page.locator('.float-layer')).toHaveCount(0)
    await expect(page.locator('.battle-screen')).toHaveCount(0)
  })

  await test.step('战后回血正确', async () => {
    const reward = await rewardSummary(page)
    const wounded = tracked.hpBefore - tracked.selfDamage
    const expectedHp = Math.min(50, wounded + 8)
    expect(reward.hp).toBe(expectedHp)
    expect(reward.heal).toBe(expectedHp - wounded)
    expect(reward.heal).toBeGreaterThanOrEqual(0)
    expect(reward.heal).toBeLessThanOrEqual(8)
    test.info().annotations.push({
      type: '回血',
      description: `结算前生命 ${wounded}，回复 ${reward.heal}，奖励页生命 ${reward.hp}`,
    })
  })

  await test.step('领取卡牌进入第二关', async () => {
    const hp = (await rewardSummary(page)).hp
    await page.locator('[data-reward="true"]').first().click()
    await expect(page.getByText('第 2 / 3 场')).toBeVisible()
    await expect(page.getByRole('heading', { name: '烬狼' })).toBeVisible()
    await expect(page.locator('.evasion-line')).toHaveText('闪避 10 个百分点')
    await expect(page.getByTestId('battle')).toHaveAttribute('data-hp', String(hp))
    await expect(page.locator('.card-ghost')).toHaveCount(0)
  })

  await test.step('完成 Boss 战并显示通关', async () => {
    await playUntilVictory(page)
    await expect(page.getByTestId('run')).toHaveAttribute('data-phase', 'victory')
    await expect(page.getByRole('heading', { name: '你登上了塔顶' })).toBeVisible()
    await expect(page.getByText(/三场试炼结束，剩余生命/)).toBeVisible()
    await expect(page.locator('.card-ghost')).toHaveCount(0)
    await expect(page.locator('.battle-screen')).toHaveCount(0)
    await expect(page.locator('.float-layer')).toHaveCount(0)
  })

  await test.step('重新开始返回菜单', async () => {
    await page.getByRole('button', { name: '重新开始' }).click()
    await expect(page.getByTestId('run')).toHaveAttribute('data-phase', 'menu')
    expect(await phase(page)).toBe('menu')
    await expect(page.getByRole('heading', { name: '遗烬之塔' })).toBeVisible()
    await expect(page.getByRole('button', { name: '开始游戏' })).toBeVisible()
    await expect(page.locator('.card-ghost')).toHaveCount(0)
  })
})
