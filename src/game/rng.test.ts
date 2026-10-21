import { describe, expect, it } from 'vitest'
import { nextRng, shuffle } from './rng.ts'

describe('随机数', () => {
  it('同一个种子洗牌两次得到相同结果', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const first = shuffle(items, 42)
    const second = shuffle(items, 42)
    expect(second).toEqual(first)
  })

  it('洗牌不会修改原数组', () => {
    const items = [1, 2, 3, 4, 5, 6]
    const snapshot = items.slice()
    shuffle(items, 7)
    expect(items).toEqual(snapshot)
  })

  it('不同种子可以洗出不同顺序', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8]
    const first = shuffle(items, 1).items.join(',')
    const second = shuffle(items, 2).items.join(',')
    expect(second).not.toBe(first)
  })

  it('同一个种子的随机序列一致', () => {
    const first = nextRng(99)
    const second = nextRng(99)
    expect(second).toEqual(first)
    expect(first.value).toBeGreaterThanOrEqual(0)
    expect(first.value).toBeLessThan(1)
  })
})
