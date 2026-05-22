/**
 * Chrome runtime guards used by content-side modules.
 */
export function hasExtensionContext(): boolean {
  try {
    return Boolean(chrome?.runtime?.id)
  } catch {
    return false
  }
}

export function getRuntimeLastErrorMessage(): string | null {
  try {
    return chrome?.runtime?.lastError?.message || null
  } catch {
    return 'Extension context is unavailable'
  }
}

