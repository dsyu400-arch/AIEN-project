/**
 * 洗牌、奖励和战斗内抽牌只用这一条序列。
 * 命中判定使用 deriveHitRngState 派生的另一条序列，不推进 rngState。
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

/** 从开局种子派生命中序列的起点。和洗牌序列互相独立，同一个种子结果固定。 */
export function deriveHitRngState(seed: number): number {
  const salted = ((seed >>> 0) ^ 0xa11ce11d) >>> 0
  return nextRng(salted).state
}
