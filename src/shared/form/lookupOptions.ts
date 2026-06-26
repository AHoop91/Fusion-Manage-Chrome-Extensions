import { getTenantFromPlmHost, normalizeApiUrlPath, normalizeFusionManageApiReferenceToPath } from '../url/parse'
import { getPlmRuntimeOptional } from '../runtime/plmRuntime'
import { runSingleFlight } from '../utils/singleFlight'
import { isAbortError } from '../utils/requestAbort'
import { normalizeText } from '../utils/text'

export type LookupOptionRecord = {
  value: string
  label: string
  /** Option URN when the list API returns it (radio / some lookups). */
  urn?: string
}

export type LookupSearchPage = {
  options: LookupOptionRecord[]
  total: number | null
  limit: number
  offset: number
}

export type LookupFetchConfig = {
  signal?: AbortSignal
  useCache?: boolean
}

const lookupSearchPromiseCache = new Map<string, Promise<LookupSearchPage>>()
const LOOKUP_SEARCH_CACHE_MAX_ENTRIES = 80

function trimLookupSearchCache(): void {
  while (lookupSearchPromiseCache.size > LOOKUP_SEARCH_CACHE_MAX_ENTRIES) {
    const oldestKey = lookupSearchPromiseCache.keys().next().value
    if (!oldestKey) break
    lookupSearchPromiseCache.delete(oldestKey)
  }
}

export function splitCommaSeparated(value: string): string[] {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const NESTED_LINK_RECORD_KEYS = ['item', 'workflowItem', 'entity', 'target', 'ref', 'value'] as const

/**
 * Resolves a Fusion `/api/v3/...` path from a picklist or item row (handles absolute URLs and nested `item`/`workflowItem` wrappers).
 */
export function extractFusionApiPathFromRecord(record: Record<string, unknown>, maxDepth = 3): string {
  if (maxDepth < 0) return ''
  for (const key of ['link', '__self__', 'self', 'href'] as const) {
    const path = normalizeFusionManageApiReferenceToPath(String(record[key] ?? ''))
    if (path) return path
  }
  for (const nest of NESTED_LINK_RECORD_KEYS) {
    const inner = record[nest]
    if (!inner || typeof inner !== 'object' || Array.isArray(inner)) continue
    const path = extractFusionApiPathFromRecord(inner as Record<string, unknown>, maxDepth - 1)
    if (path) return path
  }
  return ''
}

function picklistOptionApiLink(record: Record<string, unknown>): string {
  return extractFusionApiPathFromRecord(record, 3)
}

function extractLookupOptions(data: unknown): LookupOptionRecord[] {
  const options: LookupOptionRecord[] = []
  if (!data) return options

  let source: unknown[] | null = null
  if (Array.isArray(data)) {
    source = data
  } else if (typeof data === 'object') {
    const root = data as Record<string, unknown>
    if (Array.isArray(root.items)) source = root.items
    else if (Array.isArray(root.options)) source = root.options
    else if (Array.isArray(root.results)) source = root.results
    else if (Array.isArray(root.data)) source = root.data
  }
  if (!source) return options

  const seen = new Set<string>()
  for (const item of source) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const label = String(record.title || record.label || record.name || '').trim()
    const apiLink = picklistOptionApiLink(record)
    const urn = String(record.urn || '').trim()
    if (!label || !apiLink || seen.has(apiLink)) continue
    seen.add(apiLink)
    const entry: LookupOptionRecord = { label, value: apiLink }
    if (urn.toLowerCase().startsWith('urn:')) entry.urn = urn
    options.push(entry)
  }
  return options
}

function parseFiniteNonNegativeInt(value: unknown): number | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.floor(parsed)
}

function extractLookupTotal(data: unknown): number | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const root = data as Record<string, unknown>
  const directCandidates = [root.total, root.totalCount, root.count, root.itemsCount, root.resultsCount, root.matchedCount]
  for (const candidate of directCandidates) {
    const parsed = parseFiniteNonNegativeInt(candidate)
    if (parsed !== null) return parsed
  }

  const nestedCandidates = [root.meta, root.pagination, root.page, root.paging]
  for (const nested of nestedCandidates) {
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) continue
    const record = nested as Record<string, unknown>
    const parsed =
      parseFiniteNonNegativeInt(record.total) ??
      parseFiniteNonNegativeInt(record.totalCount) ??
      parseFiniteNonNegativeInt(record.count)
    if (parsed !== null) return parsed
  }
  return null
}

function buildLookupSearchUrl(picklistPath: string, query: string, limit: number, offset: number): string {
  const normalizedPath = normalizeFusionManageApiReferenceToPath(picklistPath) || normalizeApiUrlPath(picklistPath)
  const url = new URL(normalizedPath, window.location.origin)
  url.searchParams.set('asc', 'title')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(offset))
  const normalizedQuery = String(query || '').trim()
  if (normalizedQuery) url.searchParams.set('filter', normalizedQuery)
  else url.searchParams.delete('filter')
  return `${url.pathname}${url.search}`
}

export async function fetchLookupOptionsByQuery(
  picklistPath: string,
  query: string,
  limit = 100,
  offset = 0,
  config: LookupFetchConfig = {}
): Promise<LookupSearchPage> {
  const useCache = config.useCache ?? !config.signal
  const cacheKey = `${picklistPath.trim()}::${normalizeText(query)}::${limit}::${offset}`

  const factory = async (): Promise<LookupSearchPage> => {
    const path = buildLookupSearchUrl(picklistPath, query, limit, offset)
    const tenant = getTenantFromPlmHost(window.location.href)
    const runtime = getPlmRuntimeOptional()
    if (!runtime || !tenant) {
      return { options: [], total: null, limit, offset }
    }
    try {
      if (config.signal?.aborted) return { options: [], total: null, limit, offset }
      const data = await runtime.requestPlmAction<unknown>('fetchApiJson', {
        tenant,
        path
      })
      if (config.signal?.aborted) return { options: [], total: null, limit, offset }
      return {
        options: extractLookupOptions(data),
        total: extractLookupTotal(data),
        limit,
        offset
      }
    } catch (error) {
      if (isAbortError(error)) return { options: [], total: null, limit, offset }
      return { options: [], total: null, limit, offset }
    }
  }

  if (!useCache) return factory()
  trimLookupSearchCache()
  return runSingleFlight(lookupSearchPromiseCache, cacheKey, factory)
}
