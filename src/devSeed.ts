/** 从地址栏读取整数种子。生产构建不得调用它来开局。 */
export function readSeedParam(search: string): number | undefined {
  const raw = new URLSearchParams(search).get('seed')
  if (raw === null || !/^-?\d+$/.test(raw)) return undefined
  const seed = Number(raw)
  if (!Number.isSafeInteger(seed)) return undefined
  return seed
}

/** 只有非生产环境才采纳地址栏种子，正式构建始终交给调用方使用当前时间。 */
export function seedFromLocation(search: string, production: boolean): number | undefined {
  if (production) return undefined
  return readSeedParam(search)
}
