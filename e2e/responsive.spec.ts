import { test, expect } from '@playwright/test'
import { assertBattleLayout, assertNoPageOverflow, assertRewards, fightToReward, openGame, startRun } from './support.ts'

const viewports = [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
] as const

for (const viewport of viewports) {
  test(`${viewport.width}×${viewport.height} 可以操作战斗和奖励`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await openGame(page)
    await assertNoPageOverflow(page)
    await startRun(page)
    await assertBattleLayout(page, viewport)
    await fightToReward(page)
    await expect(page.getByRole('heading', { name: '选择一张牌' })).toBeVisible()
    await assertRewards(page)
  })
}
