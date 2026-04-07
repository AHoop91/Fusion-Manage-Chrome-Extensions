export type BomPageContext = {
  tenant: string
  workspaceId: number
  currentItemId: number
  viewId: number
  viewDefId: number | null
}

const BOM_PATH_RE = /^\/plm\/workspaces\/(\d+)\/items\/bom\/nested$/i

function parseDmsIdFromItemId(itemIdValue: string | null): number | null {
  if (!itemIdValue) return null
  const decoded = decodeURIComponent(itemIdValue)
  const parts = decoded.split(',')
  const maybeDmsId = Number.parseInt(parts.at(-1) ?? '', 10)
  return Number.isFinite(maybeDmsId) && maybeDmsId > 0 ? maybeDmsId : null
}

function parseWorkspaceIdFromPath(pathname: string): number | null {
  const match = BOM_PATH_RE.exec(pathname)
  if (!match) return null
  const value = Number.parseInt(match[1], 10)
  return Number.isFinite(value) && value > 0 ? value : null
}

function getTenantFromHost(hostname: string): string {
  const parts = String(hostname || '').split('.')
  return String(parts[0] || '').toLowerCase()
}

export function isBomTabRoute(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    const workspaceId = parseWorkspaceIdFromPath(url.pathname)
    const tab = String(url.searchParams.get('tab') || '').toLowerCase()
    const mode = String(url.searchParams.get('mode') || '').toLowerCase()
    const view = String(url.searchParams.get('view') || '').toLowerCase()
    const supportedView = view === 'full' || view === 'split'
    return Boolean(workspaceId && tab === 'bom' && mode === 'view' && supportedView)
  } catch {
    return false
  }
}

export function resolveBomPageContext(urlString: string): BomPageContext | null {
  try {
    const url = new URL(urlString)
    const workspaceId = parseWorkspaceIdFromPath(url.pathname)
    const currentItemId = parseDmsIdFromItemId(url.searchParams.get('itemId'))
    const viewIdFromUrl = Number.parseInt(url.searchParams.get('viewId') || '5', 10)
    const viewDefIdRaw = Number.parseInt(url.searchParams.get('viewDefId') || '', 10)
    const viewDefId = Number.isFinite(viewDefIdRaw) && viewDefIdRaw > 0 ? viewDefIdRaw : null

    if (!workspaceId || !currentItemId || !Number.isFinite(viewIdFromUrl)) return null

    return {
      tenant: getTenantFromHost(url.hostname),
      workspaceId,
      currentItemId,
      viewId: viewIdFromUrl,
      viewDefId
    }
  } catch {
    return null
  }
}
