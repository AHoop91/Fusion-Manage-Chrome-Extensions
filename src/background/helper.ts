const BADGE_TEXT = ' '
const HEALTH_DIAGNOSTIC_STORAGE_KEY = 'plmExtension.healthDiagnostic'
const HEALTH_DIAGNOSTIC_BY_PAGE_SIGNATURE_STORAGE_KEY = 'plmExtension.healthDiagnosticByPageSignature'

const BADGE_COLORS = {
  healthy: '#4CAF50',
  partial: '#F9A825',
  down: '#E53935'
} as const

const lastBadgeModeByTab = new Map<number, string>()

function getHashTab(url: URL): string {
  const hash = String(url.hash || '').replace(/^#/, '')
  const hashParams = new URLSearchParams(hash)
  return String(hashParams.get('tab') || '').toLowerCase()
}

function getDiagnosticSignatureCandidates(urlString: string): string[] {
  try {
    const url = new URL(String(urlString || ''))
    const pathname = url.pathname.toLowerCase()
    const tab = String(url.searchParams.get('tab') || '').toLowerCase()
    const hashTab = getHashTab(url)

    if (pathname.includes('/items/itemdetails') || pathname.includes('/items/additem')) {
      return ['runtime-baseline:item-details']
    }
    if (pathname.includes('/items/grid')) return ['runtime-baseline:grid']
    if (pathname.includes('/items/bom') && tab === 'bom') return ['bom.clone', 'runtime-baseline:bom']
    if (pathname.includes('/admin') || tab === 'users' || hashTab === 'users' || tab === 'groups' || tab === 'roles') {
      return ['runtime-baseline:security-users']
    }
  } catch {
    // No-op.
  }
  return []
}

function getExpectedFeatureKeys(urlString: string): string[] {
  try {
    const url = new URL(urlString)
    const pathname = url.pathname.toLowerCase()
    const tab = String(url.searchParams.get('tab') || '').toLowerCase()
    const hash = String(url.hash || '').replace(/^#/, '')
    const hashParams = new URLSearchParams(hash)
    const hashTab = String(hashParams.get('tab') || '').toLowerCase()

    if (pathname.includes('/items/itemdetails') || pathname.includes('/items/additem')) {
      return ['itemDetails.relatedLinks', 'itemDetails.options', 'itemDetails.search']
    }
    if (pathname.includes('/items/grid')) return ['grid']
    if (pathname.includes('/items/bom') && tab === 'bom') return ['bom.clone']
    if (tab === 'users' || hashTab === 'users') return ['securityUsersFilter']
  } catch {
    // No-op.
  }
  return []
}

function isFeatureDisabled(featureKey: string, disabledFeatures: string[]): boolean {
  if (disabledFeatures.includes(featureKey)) return true
  if (featureKey.startsWith('itemDetails.') && disabledFeatures.includes('itemDetails')) return true
  return false
}

function resolveBadgeMode(diagnostic: any, expectedFeatureKeys: string[]): keyof typeof BADGE_COLORS | 'none' {
  if (!diagnostic) return 'down'
  if (!Array.isArray(expectedFeatureKeys) || expectedFeatureKeys.length === 0) return 'down'

  const status = String(diagnostic.status || '').toUpperCase()
  const disabledFeatures = Array.isArray(diagnostic.disabledFeatures) ? diagnostic.disabledFeatures : []
  const enabledCount = expectedFeatureKeys.filter((key) => !isFeatureDisabled(key, disabledFeatures)).length

  if (status === 'CRITICAL_FAILURE' || enabledCount === 0) return 'down'
  if (status === 'HEALTHY' && enabledCount === expectedFeatureKeys.length) return 'healthy'
  return 'partial'
}

function getStorageValues(keys: string[], area: 'local' | 'session' = 'local'): Promise<Record<string, any>> {
  return new Promise((resolve) => {
    try {
      const storageArea = chrome?.storage?.[area]
      if (!storageArea) {
        resolve({})
        return
      }
      storageArea.get(keys, (result) => resolve(result || {}))
    } catch {
      resolve({})
    }
  })
}

async function resolveDiagnosticForUrl(urlString: string): Promise<any> {
  const sessionResult = await getStorageValues(
    [HEALTH_DIAGNOSTIC_STORAGE_KEY, HEALTH_DIAGNOSTIC_BY_PAGE_SIGNATURE_STORAGE_KEY],
    'session'
  )

  const byPageSignature = sessionResult?.[HEALTH_DIAGNOSTIC_BY_PAGE_SIGNATURE_STORAGE_KEY] || {}
  const candidates = getDiagnosticSignatureCandidates(urlString)
  for (const candidate of candidates) {
    const exact = byPageSignature?.[candidate] || null
    if (exact) return exact
    const prefixed = Object.values(byPageSignature).find((entry: any) => {
      const scope = String(entry?.pageScope || '')
      const signature = String(entry?.pageSignature || '')
      return scope === candidate
        || scope.startsWith(`${candidate}:`)
        || signature === candidate
        || signature.startsWith(`${candidate}:`)
    })
    if (prefixed) return prefixed
  }

  const latest = sessionResult?.[HEALTH_DIAGNOSTIC_STORAGE_KEY] || null
  if (!latest) return null
  if (candidates.some((candidate) => {
    const scope = String(latest.pageScope || '')
    const signature = String(latest.pageSignature || '')
    return scope === candidate
      || scope.startsWith(`${candidate}:`)
      || signature === candidate
      || signature.startsWith(`${candidate}:`)
  })) return latest
  return null
}

async function setBadgeMode(tabId: number, mode: keyof typeof BADGE_COLORS | 'none'): Promise<void> {
  const prevMode = lastBadgeModeByTab.get(tabId) || null
  if (prevMode === mode) return

  if (mode === 'none') {
    await chrome.action.setBadgeText({ text: '', tabId })
    lastBadgeModeByTab.set(tabId, mode)
    return
  }

  const color = BADGE_COLORS[mode] || BADGE_COLORS.down
  await chrome.action.setBadgeText({ text: BADGE_TEXT, tabId })
  await chrome.action.setBadgeBackgroundColor({ color, tabId })
  lastBadgeModeByTab.set(tabId, mode)
}

export async function updateActionForTab(tabId: number, url?: string, diagnosticOverride: any = null): Promise<void> {
  if (!url) return

  let isFusionManage = false

  if (typeof url === 'string') {
    try {
      const parsed = new URL(url)
      isFusionManage = parsed.hostname.toLowerCase().endsWith('autodeskplm360.net')
    } catch {
      isFusionManage = false
    }
  }

  if (!isFusionManage) {
    await setBadgeMode(tabId, 'none')
    return
  }

  const expectedFeatureKeys = getExpectedFeatureKeys(url)
  const diagnostic = diagnosticOverride || (await resolveDiagnosticForUrl(url))
  const badgeMode = resolveBadgeMode(diagnostic, expectedFeatureKeys)
  await setBadgeMode(tabId, badgeMode)
}
