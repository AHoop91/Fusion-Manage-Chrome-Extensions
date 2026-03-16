/**
 * Pure normalization/parsing helpers for BOM clone values.
 */
export const DEFAULT_CLONE_QUANTITY = '0.0'
const QUANTITY_COMPARE_EPSILON = 0.000001

export function normalizeTopLevelItemNumber(value: string, fallback: string): string {
  const fallbackValue = String(fallback || '1.1').trim()
  const trimmed = String(value || '').trim()
  if (/^\d+\.\d+$/.test(trimmed)) return trimmed
  if (/^\d+$/.test(trimmed)) return `1.${trimmed}`
  return fallbackValue
}

export function normalizeQuantity(value: string, fallback: string): string {
  const fallbackValue = String(fallback || DEFAULT_CLONE_QUANTITY).trim() || DEFAULT_CLONE_QUANTITY
  const trimmed = String(value || '').trim()
  if (!trimmed) return fallbackValue
  return /^\d+(\.\d+)?$/.test(trimmed) ? trimmed : fallbackValue
}

export function areQuantitiesEquivalent(left: string, right: string, fallback = DEFAULT_CLONE_QUANTITY): boolean {
  const normalizedLeft = normalizeQuantity(left, fallback)
  const normalizedRight = normalizeQuantity(right, fallback)
  const parsedLeft = Number.parseFloat(normalizedLeft)
  const parsedRight = Number.parseFloat(normalizedRight)
  if (!Number.isFinite(parsedLeft) || !Number.isFinite(parsedRight)) return normalizedLeft === normalizedRight
  return Math.abs(parsedLeft - parsedRight) <= QUANTITY_COMPARE_EPSILON
}

export function parseCommitItemNumber(value: string, fallback: number): number {
  const trimmed = String(value || '').trim()
  if (!trimmed) return fallback
  const fromDepthValue = /^\d+\.(\d+)$/.exec(trimmed)
  if (fromDepthValue) return Number(fromDepthValue[1]) || fallback
  const asNumber = Number(trimmed)
  return Number.isFinite(asNumber) && asNumber > 0 ? Math.floor(asNumber) : fallback
}

export function parsePositiveInt(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.floor(parsed)
}

export function dedupePositiveInts(values: number[]): number[] {
  const seen = new Set<number>()
  const deduped: number[] = []
  for (const value of values) {
    const parsed = parsePositiveInt(value)
    if (parsed === null || seen.has(parsed)) continue
    seen.add(parsed)
    deduped.push(parsed)
  }
  return deduped
}


