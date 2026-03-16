/**
 * Attempts host-native grid tab refresh by activating an existing grid tab control.
 */
export function tryRefreshGridTabInPlace(): boolean {
  const candidates = Array.from(
    document.querySelectorAll(
      ['a[href*="tab=grid"]', 'button[data-tab="grid"]', '[role="tab"][aria-controls*="grid"]', '[role="tab"][id*="grid"]'].join(',')
    )
  ) as HTMLElement[]

  for (const candidate of candidates) {
    if (!candidate || typeof candidate.click !== 'function') continue
    if (candidate instanceof HTMLAnchorElement) {
      const rawHref = candidate.getAttribute('href') || ''
      if (rawHref && !rawHref.startsWith('javascript:')) {
        try {
          const parsed = new URL(rawHref, window.location.origin)
          const tab = (parsed.searchParams.get('tab') || '').toLowerCase()
          if (tab !== 'grid') continue
        } catch {
          continue
        }
      }
    }
    candidate.click()
    return true
  }

  return false
}
