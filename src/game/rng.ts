/**
 * 洗牌、奖励和战斗内抽牌只用这一条序列。
 * 阶段 C 的命中判定会从同一开局种子另派生一条序列，不推进这里的 rngState。
 * 阶段 A 不读取、不推进第二条序列。
 */
export function nextRng(rngState: number): { state: number; value: number } {
  const state = (rngState + 0x6d2b79f5) >>> 0
  let mixed = Math.imul(state ^ (state >>> 15), state | 1)
  mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)) ^ mixed
  const value = ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296
  return { state, value }
}

export function shuffle<T>(items: readonly T[], rngState: number): { items: T[]; rngState: number } {
  const next = items.slice()
  let state = rngState
  for (let index = next.length - 1; index > 0; index -= 1) {
    const rolled = nextRng(state)
    state = rolled.state
    const swapIndex = Math.floor(rolled.value * (index + 1))
    const current = next[index]
    next[index] = next[swapIndex] as T
    next[swapIndex] = current as T
  }
  return { items: next, rngState: state }
}
