export function uniquePositiveIntegers(values: Array<number | null | undefined>): number[] {
  const seen = new Set<number>()
  const result: number[] = []
  for (const value of values) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) continue
    const normalized = Math.floor(parsed)
    if (seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }
  return result
}
