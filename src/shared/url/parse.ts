/**
 * URL guards and page-context parsers for PLM pages.
 */
export type ItemDetailsContext = { workspaceId: number; dmsId: number }
export type GridContext = { workspaceId: number; dmsId: number }

export function isFusionHost(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    return url.hostname.toLowerCase().endsWith('autodeskplm360.net')
  } catch {
    return false
  }
}

export function isItemDetailsPage(urlString: string): boolean {
  try {
    if (!isFusionHost(urlString)) return false
    const context = parseItemDetailsContextFromPageUrl(urlString)
    return context !== null
  } catch {
    return false
  }
}

export function isAddItemPage(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    if (!isFusionHost(urlString)) return false

    const pathMatch = /^\/plm\/workspaces\/(\d+)\/items\/addItem$/i.test(url.pathname)
    if (!pathMatch) return false

    const view = (url.searchParams.get('view') || '').toLowerCase()
    return view === 'split' || view === 'full'
  } catch {
    return false
  }
}

export function parseWorkspaceIdFromPlmWorkspacePath(urlString: string): number | null {
  try {
    const url = new URL(urlString)
    const workspaceMatch = /\/plm\/workspaces\/(\d+)\b/i.exec(url.pathname)
    if (!workspaceMatch) return null

    const workspaceId = Number.parseInt(workspaceMatch[1], 10)
    return Number.isFinite(workspaceId) ? workspaceId : null
  } catch {
    return null
  }
}

export function parseItemDetailsContextFromPageUrl(urlString: string): ItemDetailsContext | null {
  try {
    const url = new URL(urlString)

    const pathMatch = /^\/plm\/workspaces\/(\d+)\/items\/itemDetails$/i.exec(url.pathname)
    if (!pathMatch) return null

    const workspaceId = Number.parseInt(pathMatch[1], 10)
    const itemId = url.searchParams.get('itemId')
    if (!itemId) return null

    const normalizedItemId = decodeURIComponent(itemId)
    const parts = normalizedItemId.split(',')
    const wsIdFromItemId = Number.parseInt(parts.at(-2) ?? '', 10)
    const dmsId = Number.parseInt(parts.at(-1) ?? '', 10)
    if (!Number.isFinite(workspaceId) || !Number.isFinite(wsIdFromItemId) || !Number.isFinite(dmsId)) return null
    if (workspaceId !== wsIdFromItemId) return null

    return { workspaceId, dmsId }
  } catch {
    return null
  }
}

export function parseGridContextFromPageUrl(urlString: string): GridContext | null {
  try {
    const url = new URL(urlString)

    const pathMatch = /^\/plm\/workspaces\/(\d+)\/items\/grid$/i.exec(url.pathname)
    if (!pathMatch) return null

    const tab = (url.searchParams.get('tab') || '').toLowerCase()
    const view = (url.searchParams.get('view') || '').toLowerCase()
    const mode = (url.searchParams.get('mode') || '').toLowerCase()
    const itemId = url.searchParams.get('itemId')
    const isSupportedView = view === 'full' || view === 'split'
    if (!itemId || tab !== 'grid' || !isSupportedView || mode !== 'view') return null

    const wsIdFromPath = Number.parseInt(pathMatch[1], 10)
    const normalizedItemId = decodeURIComponent(itemId)
    const parts = normalizedItemId.split(',')
    const wsIdFromItemId = Number.parseInt(parts.at(-2) ?? '', 10)
    const dmsId = Number.parseInt(parts.at(-1) ?? '', 10)
    if (!Number.isFinite(wsIdFromPath) || !Number.isFinite(wsIdFromItemId) || !Number.isFinite(dmsId)) return null
    if (wsIdFromPath !== wsIdFromItemId) return null

    return { workspaceId: wsIdFromPath, dmsId }
  } catch {
    return null
  }
}

export function normalizeApiUrlPath(path: string): string {
  const trimmed = String(path || '').trim()
  if (!trimmed) return ''
  if (/^\/\//.test(trimmed)) return ''
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      if (url.origin !== window.location.origin) return ''
      return url.pathname + url.search
    } catch {
      return ''
    }
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

