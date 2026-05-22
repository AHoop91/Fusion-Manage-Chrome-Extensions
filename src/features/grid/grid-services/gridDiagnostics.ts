let lastFieldHydrationIssue: string | null = null
const warnedKeys = new Set<string>()

/**
 * Last grid field-metadata hydration failure (for toolbar tooltips).
 */
export function getGridFieldHydrationIssue(): string | null {
  return lastFieldHydrationIssue
}

export function setGridFieldHydrationIssue(message: string | null): void {
  lastFieldHydrationIssue = message
}

/**
 * Log a single diagnostic once per key (extension avoids console.error in production paths).
 */
export function warnGridDiagnostic(key: string, message: string, error?: unknown): void {
  if (warnedKeys.has(key)) return
  warnedKeys.add(key)
  if (error !== undefined) {
    console.warn(`[Fusion Manage · grid] ${message}`, error)
    return
  }
  console.warn(`[Fusion Manage · grid] ${message}`)
}

export function resetGridDiagnostics(): void {
  lastFieldHydrationIssue = null
  warnedKeys.clear()
}
