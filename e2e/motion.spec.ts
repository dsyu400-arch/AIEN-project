import { expect, test } from '@playwright/test'
import { getCard } from '../src/game/index.ts'
import {
  fightToReward,
  findHandCard,
  inspectDrawPile,
  openGame,
  phase,
  playUntilVictory,
  rewardSummary,
  singleStrike,
  startRun,
  stat,
} from './support.ts'

test('快速连续点击不会重复结算同一张攻击牌', async ({ page }) => {
  await openGame(page)
  await startRun(page)
  const attack = await findHandCard(page, (card, definition) => !card.disabled && singleStrike(definition) > 0)
  const dealt = singleStrike(getCard(attack.definitionId))
  const before = await stat(page, 'enemy', '生命')
  const block = await stat(page, 'enemy', '护甲')
  const handBefore = await page.locator('.hand .card').count()
  const card = page.locator(`.hand .card[data-instance-id="${attack.instanceId}"]`)
  await card.evaluate((element) => {
    const click = () => element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    click()
    click()
  })
  await expect(page.locator('.hand .card')).toHaveCount(handBefore - 1)
  await expect(card).toHaveCount(0)
  expect(await stat(page, 'enemy', '生命')).toBe(before - Math.max(0, dealt - block))
})

test('出牌动画不会挡住结束回合', async ({ page }) => {
  await openGame(page)
  await startRun(page)
  const attack = await findHandCard(page, (card, definition) => !card.disabled && singleStrike(definition) > 0)
  const card = page.locator(`.hand .card[data-instance-id="${attack.instanceId}"]`)
  const during = await card.evaluate((element) => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    return new Promise<{ ghost: boolean; pointerEvents: string | null; endHit: boolean }>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const ghost = document.querySelector('.card-ghost')
          const end = [...document.querySelectorAll('button')].find((button) => button.textContent?.includes('结束回合'))
          const box = end?.getBoundingClientRect()
          const hit = box ? document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) : null
          resolve({
            ghost: Boolean(ghost),
            pointerEvents: ghost ? getComputedStyle(ghost).pointerEvents : null,
            endHit: Boolean(end && hit && (hit === end || end.contains(hit))),
          })
        })
      })
    })
  })
  expect(during.ghost).toBe(true)
  expect(during.pointerEvents).toBe('none')
  expect(during.endHit).toBe(true)
  await page.getByRole('button', { name: '结束回合' }).click({ trial: true })
})

test('进入奖励页后不残留战斗动画', async ({ page }) => {
  await openGame(page)
  await startRun(page)
  await fightToReward(page)
  await expect(page.locator('.card-ghost')).toHaveCount(0)
  await expect(page.locator('.float-layer')).toHaveCount(0)
  await expect(page.locator('.battle-screen')).toHaveCount(0)
  await expect(page.locator('.float-number')).toHaveCount(0)
  await page.locator('[data-reward="true"]').first().click()
  await expect(page.getByTestId('battle')).toBeVisible()
  await expect(page.locator('.card-ghost')).toHaveCount(0)
  await expect(page.locator('.float-layer')).toHaveCount(0)
})

test.describe('减少动态效果', () => {
  test.use({ reducedMotion: 'reduce' })

  test('关闭动画后仍能完成整局操作', async ({ page }) => {
    await openGame(page)
    await startRun(page)
    await expect(page.locator('.ember-mote').first()).toHaveCSS('animation-name', 'none')
    await page.getByRole('button', { name: '结束回合' }).click({ trial: true })
    await inspectDrawPile(page)

    const tracked = await fightToReward(page)
    const reward = await rewardSummary(page)
    const wounded = tracked.hpBefore - tracked.selfDamage
    expect(reward.hp).toBe(Math.min(50, wounded + 8))
    expect(reward.heal).toBe(reward.hp - wounded)
    await expect(page.locator('.card-ghost')).toHaveCount(0)
    await expect(page.locator('.float-layer')).toHaveCount(0)
    await expect(page.locator('[data-reward="true"]')).toHaveCount(3)
    const hp = reward.hp
    await page.locator('[data-reward="true"]').first().click()
    await expect(page.getByText('第 2 / 3 场')).toBeVisible()
    await expect(page.getByTestId('battle')).toHaveAttribute('data-hp', String(hp))

    await playUntilVictory(page)
    await expect(page.getByRole('heading', { name: '你登上了塔顶' })).toBeVisible()
    await expect(page.locator('.card-ghost')).toHaveCount(0)
    await page.getByRole('button', { name: '重新开始' }).click()
    expect(await phase(page)).toBe('menu')
    await expect(page.getByRole('button', { name: '开始游戏' })).toBeVisible()
    await expect(page.locator('.card-ghost')).toHaveCount(0)
  })
})
