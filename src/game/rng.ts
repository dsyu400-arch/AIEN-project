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
