import { expect, type Locator, type Page } from '@playwright/test'
import { getCard } from '../src/game/index.ts'
import type { CardDefinition, CardId } from '../src/game/index.ts'

export const SEED = 1

export interface HandCard {
  instanceId: string
  definitionId: CardId
  disabled: boolean
  cost: number
}

export async function openGame(page: Page) {
  await page.goto(`/?seed=${SEED}`)
  await expect(page).toHaveTitle('遗烬之塔')
  await expect(page.getByRole('heading', { level: 1, name: '遗烬之塔' })).toBeVisible()
}

export async function startRun(page: Page) {
  await page.getByRole('button', { name: '开始游戏' }).click()
  await expect(page.getByTestId('run')).toHaveAttribute('data-phase', 'playerTurn')
  await expect(page.getByRole('heading', { name: '灰卫' })).toBeVisible()
  await expect(page.getByText('第 1 / 3 场')).toBeVisible()
}

export async function phase(page: Page): Promise<string | null> {
  return page.getByTestId('run').getAttribute('data-phase')
}

export async function stat(page: Page, side: 'player' | 'enemy', label: '生命' | '护甲' | '能量'): Promise<number> {
  const root = page.locator(side === 'player' ? '.fighter-player' : '.fighter-enemy')
  const text = await root.getByText(new RegExp(`^${label} `)).innerText()
  const match = text.match(/(\d+)/)
  if (!match?.[1]) throw new Error(`无法读取${label}：${text}`)
  return Number(match[1])
}

export async function readHand(page: Page): Promise<HandCard[]> {
  const cards = await page.locator('.hand .card').evaluateAll((elements) =>
    elements.map((element) => ({
      instanceId: element.getAttribute('data-instance-id') ?? '',
      definitionId: element.getAttribute('data-definition-id') ?? '',
      disabled: element instanceof HTMLButtonElement ? element.disabled : true,
      cost: Number(element.getAttribute('data-cost') ?? '0'),
    })),
  )
  return cards.map((card) => ({ ...card, definitionId: asCardId(card.definitionId) }))
}

export async function clickCard(page: Page, instanceId: string) {
  const card = page.locator(`.hand .card[data-instance-id="${instanceId}"]`)
  await card.scrollIntoViewIfNeeded()
  const point = await card.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const scroller = element.closest('.hand-scroller')?.getBoundingClientRect()
    const left = Math.max(rect.left + 2, scroller?.left ?? rect.left)
    const right = Math.min(rect.right - 2, scroller?.right ?? rect.right)
    const top = Math.max(rect.top + 6, scroller?.top ?? rect.top)
    const bottom = Math.min(rect.bottom - 6, scroller?.bottom ?? rect.bottom)
    const y = top + Math.min(28, Math.max((bottom - top) / 2, 4))
    for (let x = left + 4; x <= right; x += 6) {
      const hit = document.elementFromPoint(x, y)
      if (hit && (hit === element || element.contains(hit))) return { x, y }
    }
    return null
  })
  if (!point) throw new Error(`卡牌 ${instanceId} 没有可点击的位置`)
  await page.mouse.click(point.x, point.y)
  await expect(card).toHaveCount(0)
}

export async function inspectDrawPile(page: Page) {
  const opener = page.getByRole('button', { name: /^抽牌堆/ })
  const label = await opener.innerText()
  const count = Number(label.match(/(\d+)/)?.[1] ?? '0')
  await opener.click()
  const dialog = page.getByRole('dialog', { name: '抽牌堆' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('heading', { name: '抽牌堆' })).toBeVisible()
  if (count === 0) {
    await expect(dialog.getByText('没有卡牌')).toBeVisible()
  } else {
    await expect(dialog.locator('li')).toHaveCount(count)
    const names = await dialog.locator('li').allInnerTexts()
    expect(names.every((name) => name.trim().length > 0)).toBe(true)
  }
  const close = dialog.getByRole('button', { name: '关闭' })
  await expect(close).toBeVisible()
  await assertReceivesClick(close)
  await close.click()
  await expect(dialog).toBeHidden()
}

export async function assertNoPageOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}

export async function assertReceivesClick(target: Locator, edge: 'center' | 'start' = 'center') {
  await expect(target).toBeVisible()
  await target.scrollIntoViewIfNeeded()
  const point = await target.evaluate((element, at) => {
    const rect = element.getBoundingClientRect()
    const scroller = element.closest('.hand-scroller')?.getBoundingClientRect()
    const left = Math.max(rect.left, scroller?.left ?? rect.left)
    const right = Math.min(rect.right, scroller?.right ?? rect.right)
    const top = Math.max(rect.top, scroller?.top ?? rect.top)
    const bottom = Math.min(rect.bottom, scroller?.bottom ?? rect.bottom)
    const width = right - left
    const height = bottom - top
    const x = at === 'start' ? left + Math.min(16, Math.max(width / 2, 4)) : left + width / 2
    const y = top + Math.min(28, Math.max(height / 2, 4))
    const hit = document.elementFromPoint(x, y)
    return {
      width,
      height,
      inView: x >= 0 && y >= 0 && x <= window.innerWidth && y <= window.innerHeight,
      owned: Boolean(hit && (hit === element || element.contains(hit))),
    }
  }, edge)
  expect(point.width).toBeGreaterThan(16)
  expect(point.height).toBeGreaterThan(16)
  expect(point.inView).toBe(true)
  expect(point.owned).toBe(true)
}

export async function assertBattleLayout(page: Page, viewport: { width: number; height: number }) {
  const endTurn = page.getByRole('button', { name: '结束回合' })
  await expect(endTurn).toBeEnabled()
  await expect(endTurn).toBeInViewport({ ratio: 1 })
  await endTurn.click({ trial: true })
  await assertReceivesClick(endTurn)
  const box = await endTurn.boundingBox()
  if (!box) throw new Error('结束回合没有布局')
  expect(box.x).toBeGreaterThanOrEqual(-1)
  expect(box.y).toBeGreaterThanOrEqual(-1)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)

  const cards = page.locator('.hand .card')
  await expect(cards).toHaveCount(5)
  for (let index = 0; index < 5; index += 1) {
    await assertReceivesClick(cards.nth(index), 'start')
  }
  if (viewport.width >= 768) {
    const fits = await page.locator('.hand-scroller').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)
    expect(fits).toBe(true)
  }

  await expect(page.locator('.fighter-player').getByText(/^生命 /)).toBeInViewport({ ratio: 1 })
  await expect(page.locator('.fighter-player').getByText(/^能量 /)).toBeInViewport({ ratio: 1 })
  const intent = page.locator('.intent')
  await expect(intent).toBeInViewport({ ratio: 1 })
  await expect(intent).toContainText('意图')
  await assertReceivesClick(intent)
  await assertNoPageOverflow(page)
  await inspectDrawPile(page)
}

export async function assertRewards(page: Page) {
  const rewards = page.locator('[data-reward="true"]')
  await expect(rewards).toHaveCount(3)
  for (let index = 0; index < 3; index += 1) {
    const reward = rewards.nth(index)
    await expect(reward).toBeEnabled()
    await reward.scrollIntoViewIfNeeded()
    await assertReceivesClick(reward)
    await reward.click({ trial: true })
  }
  await assertNoPageOverflow(page)
}

export async function rewardSummary(page: Page): Promise<{ hp: number; heal: number }> {
  const text = await page.locator('.reward-life').innerText()
  const hp = Number(text.match(/生命 (\d+)/)?.[1])
  const heal = Number(text.match(/回复 (\d+) 点生命/)?.[1])
  if (!Number.isInteger(hp) || !Number.isInteger(heal)) throw new Error(`无法读取战后回复：${text}`)
  return { hp, heal }
}

export async function fightToReward(page: Page): Promise<{ hpBefore: number; selfDamage: number }> {
  let hpBefore = 0
  let selfDamage = 0
  for (let step = 0; step < 80; step += 1) {
    const current = await phase(page)
    if (current === 'reward') return { hpBefore, selfDamage }
    if (current === 'defeat') throw new Error('第一关失败')
    if (current !== 'playerTurn') throw new Error(`第一关停在${current ?? '未知阶段'}`)
    const before = await readBattle(page)
    const choice = chooseCard(await readHand(page), before.hp, before.threat)
    hpBefore = before.hp
    if (!choice) {
      selfDamage = 0
      await page.getByRole('button', { name: '结束回合' }).click()
      continue
    }
    selfDamage = selfDamageOf(getCard(choice.definitionId))
    await clickCard(page, choice.instanceId)
  }
  throw new Error('第一关没有进入奖励')
}

export async function playUntilVictory(page: Page) {
  for (let step = 0; step < 250; step += 1) {
    const current = await phase(page)
    if (current === 'victory') return
    if (current === 'defeat' || current === 'menu') throw new Error(`冒险停在${current ?? '未知阶段'}`)
    if (current === 'reward') {
      const before = (await rewardSummary(page)).hp
      const rewards = page.locator('[data-reward="true"]')
      await expect(rewards).toHaveCount(3)
      await rewards.first().click()
      if ((await phase(page)) === 'playerTurn') {
        await expect(page.getByTestId('battle')).toHaveAttribute('data-hp', String(before))
      }
      continue
    }
    await playBest(page)
  }
  throw new Error('冒险步数用尽')
}

export async function findHandCard(page: Page, match: (card: HandCard, definition: CardDefinition) => boolean): Promise<HandCard> {
  for (let turn = 0; turn < 4; turn += 1) {
    const found = (await readHand(page)).find((card) => match(card, getCard(card.definitionId)))
    if (found) return found
    await page.getByRole('button', { name: '结束回合' }).click()
    if ((await phase(page)) !== 'playerTurn') break
  }
  throw new Error('手牌中没有符合条件的卡')
}

export async function prepareUnaffordableCard(page: Page): Promise<Locator> {
  for (let step = 0; step < 24; step += 1) {
    const disabled = page.locator('.hand .card:disabled')
    if ((await disabled.count()) > 0) return disabled.first()
    if ((await phase(page)) !== 'playerTurn') throw new Error('战斗结束时还没有能量不足的牌')
    const skill = page.locator('.hand .card.card-skill[data-cost="1"]:not([disabled])')
    const any = page.locator('.hand .card[data-cost="1"]:not([disabled])')
    const spend = (await skill.count()) > 0 ? skill : any
    if ((await spend.count()) > 0) {
      const instanceId = await spend.first().getAttribute('data-instance-id')
      if (!instanceId) throw new Error('手牌缺少实例编号')
      await clickCard(page, instanceId)
      continue
    }
    await page.getByRole('button', { name: '结束回合' }).click()
  }
  throw new Error('没有出现能量不足的牌')
}

export function singleStrike(definition: CardDefinition): number {
  const damages = definition.effects.filter((effect) => effect.type === 'damage')
  const strike = damages[0]
  if (damages.length !== 1 || !strike || strike.times !== 1) return 0
  if (definition.effects.some((effect) => effect.type === 'selfDamage' || effect.type === 'draw')) return 0
  return strike.amount
}

function asCardId(value: string): CardId {
  const definition = getCard(value as CardId)
  if (!definition || definition.id !== value) throw new Error(`未知卡牌：${value}`)
  return value as CardId
}

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

function selfDamageOf(definition: CardDefinition): number {
  return definition.effects.reduce((total, effect) => {
    return effect.type === 'selfDamage' ? total + effect.amount : total
  }, 0)
}

function killsSelf(definition: CardDefinition, hp: number): boolean {
  return definition.effects.some((effect) => effect.type === 'selfDamage' && effect.amount >= hp)
}

function highest<T>(items: T[], score: (item: T) => number): T | undefined {
  return items.reduce<T | undefined>((best, item) => {
    if (!best || score(item) > score(best)) return item
    return best
  }, undefined)
}

function chooseCard(hand: HandCard[], hp: number, threat: number): HandCard | undefined {
  const playable = hand
    .filter((card) => !card.disabled)
    .map((card) => ({ card, definition: getCard(card.definitionId) }))
    .filter((entry) => !killsSelf(entry.definition, hp))
  const blocks = playable.filter((entry) => blockOf(entry.definition) > 0)
  const attacks = playable.filter((entry) => damageOf(entry.definition) > 0)
  const utility = playable.filter((entry) =>
    entry.definition.effects.some((effect) => effect.type === 'draw' || effect.type === 'gainEnergy'),
  )
  if (threat > 0) {
    const block = highest(blocks, (entry) => blockOf(entry.definition))
    if (block) return block.card
  }
  return highest(attacks, (entry) => damageOf(entry.definition))?.card ?? utility[0]?.card ?? playable[0]?.card
}

async function readBattle(page: Page): Promise<{ hp: number; threat: number }> {
  const battle = page.getByTestId('battle')
  const hp = Number(await battle.getAttribute('data-hp'))
  const block = Number(await battle.getAttribute('data-block'))
  const incoming = Number(await battle.getAttribute('data-threat'))
  return { hp, threat: Math.max(0, incoming - block) }
}

async function playBest(page: Page) {
  if ((await phase(page)) !== 'playerTurn') throw new Error('当前不能出牌')
  const before = await readBattle(page)
  const choice = chooseCard(await readHand(page), before.hp, before.threat)
  if (!choice) {
    await page.getByRole('button', { name: '结束回合' }).click()
    return
  }
  await clickCard(page, choice.instanceId)
}
