import { describe, expect, it } from 'vitest'
import { GAME_TITLE } from './index.ts'

describe('游戏入口', () => {
  it('使用《遗烬之塔》作为名称', () => {
    expect(GAME_TITLE).toBe('遗烬之塔')
  })
})
