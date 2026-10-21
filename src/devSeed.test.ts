import { describe, expect, it } from 'vitest'
import { readSeedParam, seedFromLocation } from './devSeed.ts'

describe('地址栏种子', () => {
  it('开发环境可以读取整数种子', () => {
    expect(readSeedParam('?seed=1')).toBe(1)
    expect(readSeedParam('?seed=0')).toBe(0)
    expect(readSeedParam('?seed=42&panel=1')).toBe(42)
    expect(seedFromLocation('?seed=7', false)).toBe(7)
  })

  it('生产环境忽略种子，非法值也不会被采用', () => {
    expect(seedFromLocation('?seed=1', true)).toBeUndefined()
    expect(seedFromLocation('?seed=0', true)).toBeUndefined()
    expect(readSeedParam('')).toBeUndefined()
    expect(readSeedParam('?seed=')).toBeUndefined()
    expect(readSeedParam('?seed=1.5')).toBeUndefined()
    expect(readSeedParam('?seed=abc')).toBeUndefined()
    expect(readSeedParam('?other=1')).toBeUndefined()
  })
})
