/**
 * Maps APS manifest `progress` (string or number) to 0–1, or null if unknown.
 */
export function parseManifestProgressRatio(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw > 1 ? Math.min(1, raw / 100) : Math.min(1, Math.max(0, raw))
  }
  const s = String(raw ?? '').trim()
  if (!s) return null
  const pct = /(\d+(?:\.\d+)?)\s*%/.exec(s)
  if (pct) return Math.min(1, Number.parseFloat(pct[1]) / 100)
  const pair = /(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/.exec(s)
  if (pair) {
    const a = Number.parseFloat(pair[1])
    const b = Number.parseFloat(pair[2])
    if (b > 0) return Math.min(1, a / b)
  }
  return null
}

/** When APS omits numeric progress, advance slowly toward ~92% over poll attempts (never 100% until terminal). */
export function estimatedPollRatio(attemptIndex: number, maxAttempts: number): number {
  const cap = 0.92
  const t = maxAttempts > 0 ? Math.min(1, attemptIndex / maxAttempts) : 0
  return Math.min(cap, 0.06 + t * cap)
}
