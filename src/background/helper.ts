const BADGE_TEXT = ' '
const BADGE_ACTIVE_COLOR = '#4CAF50'

const lastBadgeStateByTab = new Map<number, 'active' | 'none'>()

function getExpectedFeatureKeys(urlString: string): string[] {
  try {
    const url = new URL(urlString)
    const pathname = url.pathname.toLowerCase()
    const tab = String(url.searchParams.get('tab') || '').toLowerCase()

    const view = (url.searchParams.get('view') || '').toLowerCase()
    if (pathname.includes('/items/itemdetails') && view === 'split') {
      return ['itemDetails.relatedLinks', 'itemDetails.options', 'itemDetails.search', 'tableaus']
    }
    if (pathname.includes('/items/itemdetails') || pathname.includes('/items/additem')) {
      return ['itemDetails.relatedLinks', 'itemDetails.options', 'itemDetails.search']
    }
    if (pathname.includes('/items/grid')) return ['grid']
    if (pathname.includes('/items/bom') && tab === 'bom') return ['bom.clone']
    if (/\/plm\/workspaces\/\d+\/items$/i.test(pathname)) return ['tableaus']
  } catch {
    // No-op.
  }
  return []
}

async function setToolbarBadge(tabId: number, active: boolean): Promise<void> {
  const next: 'active' | 'none' = active ? 'active' : 'none'
  const prev = lastBadgeStateByTab.get(tabId)
  if (prev === next) return

  if (!active) {
    await chrome.action.setBadgeText({ text: '', tabId })
    lastBadgeStateByTab.set(tabId, 'none')
    return
  }

  await chrome.action.setBadgeText({ text: BADGE_TEXT, tabId })
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_ACTIVE_COLOR, tabId })
  lastBadgeStateByTab.set(tabId, 'active')
}

/**
 * Toolbar badge: green dot only when this tab is on a Fusion Manage URL where the extension
 * has supported features; otherwise the badge is cleared (invisible).
 */
export async function updateActionForTab(tabId: number, url?: string): Promise<void> {
  if (!url) return

  let isFusionManage = false
  try {
    const parsed = new URL(url)
    isFusionManage = parsed.hostname.toLowerCase().endsWith('autodeskplm360.net')
  } catch {
    await setToolbarBadge(tabId, false)
    return
  }

  if (!isFusionManage) {
    await setToolbarBadge(tabId, false)
    return
  }

  const extensionActiveOnPage = getExpectedFeatureKeys(url).length > 0
  await setToolbarBadge(tabId, extensionActiveOnPage)
}
