import { parseItemDetailsContextFromPageUrl, type ItemDetailsContext } from '../../../shared/url/parse'
import type { ItemDetailsRuntime } from '../item-details.types'

type WorkspaceTitleCacheEntry = {
  titles: Map<number, string>
  timestamp: number
}

type ItemDetailsCacheEntry = {
  data: unknown
  timestamp: number
}

const ITEM_DETAILS_CACHE_TTL_MS = 5 * 60_000
const WORKSPACE_TITLE_CACHE_TTL_MS = 10 * 60_000
const ITEM_DETAILS_CACHE_MAX_ENTRIES = 80

const itemDetailsByKey = new Map<string, ItemDetailsCacheEntry>()
const itemDetailsInFlightByKey = new Map<string, Promise<unknown | null>>()
const workspaceTitlesByTenant = new Map<string, WorkspaceTitleCacheEntry>()
const workspaceTitlesInFlightByTenant = new Map<string, Promise<Map<number, string>>>()

const WORKSPACE_LINK_RE = /^\/api\/v3\/workspaces\/(\d+)$/i

function toItemDetailsCacheKey(tenant: string, context: ItemDetailsContext): string {
  return `${tenant.toLowerCase()}:${context.workspaceId}:${context.dmsId}`
}

function trimItemDetailsCache(): void {
  if (itemDetailsByKey.size <= ITEM_DETAILS_CACHE_MAX_ENTRIES) return
  const oldestKey = itemDetailsByKey.keys().next().value
  if (oldestKey) itemDetailsByKey.delete(oldestKey)
}

export function getTenantFromLocation(urlString: string): string | null {
  try {
    const url = new URL(urlString)
    const hostParts = url.hostname.split('.')
    if (hostParts.length < 3) return null
    return hostParts[0] || null
  } catch {
    return null
  }
}

export function getCurrentItemContextFromLocation(urlString: string): ItemDetailsContext | null {
  return parseItemDetailsContextFromPageUrl(urlString)
}

export function getCachedItemDetails(tenant: string, context: ItemDetailsContext): unknown | null {
  const key = toItemDetailsCacheKey(tenant, context)
  const entry = itemDetailsByKey.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > ITEM_DETAILS_CACHE_TTL_MS) {
    itemDetailsByKey.delete(key)
    return null
  }
  return entry.data
}

export function getCachedItemDetailsForCurrentPage(): unknown | null {
  const tenant = getTenantFromLocation(window.location.href)
  const context = getCurrentItemContextFromLocation(window.location.href)
  if (!tenant || !context) return null
  return getCachedItemDetails(tenant, context)
}

export async function loadItemDetails(
  ext: ItemDetailsRuntime,
  tenant: string,
  context: ItemDetailsContext
): Promise<unknown | null> {
  const cached = getCachedItemDetails(tenant, context)
  if (cached) return cached

  const key = toItemDetailsCacheKey(tenant, context)
  const existing = itemDetailsInFlightByKey.get(key)
  if (existing) return existing

  const run = (async (): Promise<unknown | null> => {
    try {
      const data = await ext.requestPlmAction<unknown>('getItemDetails', {
        tenant,
        workspaceId: context.workspaceId,
        dmsId: context.dmsId
      })
      itemDetailsByKey.set(key, {
        data,
        timestamp: Date.now()
      })
      trimItemDetailsCache()
      return data
    } catch {
      return null
    } finally {
      itemDetailsInFlightByKey.delete(key)
    }
  })()

  itemDetailsInFlightByKey.set(key, run)
  return run
}

export async function loadItemDetailsForCurrentPage(ext: ItemDetailsRuntime): Promise<unknown | null> {
  const tenant = getTenantFromLocation(window.location.href)
  const context = getCurrentItemContextFromLocation(window.location.href)
  if (!tenant || !context) return null
  return loadItemDetails(ext, tenant, context)
}

function parseWorkspaceTitleMapFromWorkspacesResponse(data: unknown): Map<number, string> {
  const result = new Map<number, string>()
  if (!data || typeof data !== 'object') return result
  const record = data as Record<string, unknown>
  const items = Array.isArray(record.items) ? (record.items as unknown[]) : []

  for (const itemNode of items) {
    if (!itemNode || typeof itemNode !== 'object') continue
    const item = itemNode as Record<string, unknown>
    const link = typeof item.link === 'string' ? item.link : ''
    const title = typeof item.title === 'string' ? item.title.trim() : ''
    if (!link || !title) continue

    const match = WORKSPACE_LINK_RE.exec(link)
    if (!match) continue
    const workspaceId = Number.parseInt(match[1], 10)
    if (!Number.isFinite(workspaceId)) continue
    result.set(workspaceId, title)
  }

  return result
}

export function getCachedWorkspaceTitle(tenant: string, workspaceId: number): string | null {
  const entry = workspaceTitlesByTenant.get(tenant.toLowerCase())
  if (!entry) return null
  if (Date.now() - entry.timestamp > WORKSPACE_TITLE_CACHE_TTL_MS) {
    workspaceTitlesByTenant.delete(tenant.toLowerCase())
    return null
  }

  const title = entry.titles.get(workspaceId)
  return typeof title === 'string' && title.trim() ? title : null
}

export async function loadWorkspaceTitleMap(ext: ItemDetailsRuntime, tenant: string): Promise<Map<number, string>> {
  const cacheKey = tenant.toLowerCase()
  const cachedEntry = workspaceTitlesByTenant.get(cacheKey)
  if (cachedEntry && Date.now() - cachedEntry.timestamp <= WORKSPACE_TITLE_CACHE_TTL_MS) {
    return new Map(cachedEntry.titles)
  }

  const existing = workspaceTitlesInFlightByTenant.get(cacheKey)
  if (existing) return existing

  const run = (async (): Promise<Map<number, string>> => {
    const merged = new Map<number, string>()
    const pageLimit = 250
    const maxPages = 20

    try {
      for (let page = 0; page < maxPages; page += 1) {
        const offset = page * pageLimit
        let response: unknown
        try {
          response = await ext.requestPlmAction<unknown>('getWorkspaces', {
            tenant,
            offset,
            limit: pageLimit,
            useCache: false
          })
        } catch {
          break
        }

        const pageMap = parseWorkspaceTitleMapFromWorkspacesResponse(response)
        for (const [workspaceId, title] of pageMap.entries()) {
          merged.set(workspaceId, title)
        }

        const record = response && typeof response === 'object' ? (response as Record<string, unknown>) : null
        const items = Array.isArray(record?.items) ? (record.items as unknown[]) : []
        if (items.length < pageLimit) break
      }
    } finally {
      workspaceTitlesInFlightByTenant.delete(cacheKey)
    }

    workspaceTitlesByTenant.set(cacheKey, {
      titles: new Map(merged),
      timestamp: Date.now()
    })
    return merged
  })()

  workspaceTitlesInFlightByTenant.set(cacheKey, run)
  return run
}
