import { parseGridContextFromPageUrl } from '../../../shared/url/parse'

export function parseGridPageContext(urlString: string): { workspaceId: number; dmsId: number } | null {
  return parseGridContextFromPageUrl(urlString)
}

export function parseGridRouteContext(urlString: string): { workspaceId: number; dmsId: number; mode: string } | null {
  try {
    const url = new URL(urlString)
    const pathMatch = /^\/plm\/workspaces\/(\d+)\/items\/grid$/i.exec(url.pathname)
    if (!pathMatch) return null

    const tab = (url.searchParams.get('tab') || '').toLowerCase()
    const view = (url.searchParams.get('view') || '').toLowerCase()
    const mode = (url.searchParams.get('mode') || '').toLowerCase()
    const itemId = url.searchParams.get('itemId')
    const isSupportedView = view === 'full' || view === 'split'
    if (!itemId || tab !== 'grid' || !isSupportedView) return null

    const workspaceId = Number.parseInt(pathMatch[1]!, 10)
    const normalizedItemId = decodeURIComponent(itemId)
    const parts = normalizedItemId.split(',')
    const wsIdFromItemId = Number.parseInt(parts.at(-2) ?? '', 10)
    const dmsId = Number.parseInt(parts.at(-1) ?? '', 10)
    if (!Number.isFinite(workspaceId) || !Number.isFinite(wsIdFromItemId) || !Number.isFinite(dmsId)) return null
    if (workspaceId !== wsIdFromItemId) return null

    return { workspaceId, dmsId, mode }
  } catch {
    return null
  }
}

export function isGridPage(urlString: string): boolean {
  return parseGridRouteContext(urlString) !== null
}

export function isStrictGridPage(urlString: string): boolean {
  return parseGridPageContext(urlString) !== null
}

export function isGridEditPage(urlString: string): boolean {
  const route = parseGridRouteContext(urlString)
  return Boolean(route && route.mode === 'edit')
}
