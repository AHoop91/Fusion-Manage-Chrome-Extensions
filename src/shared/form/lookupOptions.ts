import { normalizeApiUrlPath } from '../url/parse'
import { isAbortError } from '../utils/requestAbort'
import { normalizeText } from '../utils/text'

export type LookupOptionRecord = {
  value: string
  label: string
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

export function splitCommaSeparated(value: string): string[] {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
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
    const value = String(record.link || record.__self__ || record.urn || '').trim()
    if (!label || !value || seen.has(label)) continue
    seen.add(label)
    options.push({ label, value })
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
  const normalizedPath = normalizeApiUrlPath(picklistPath)
  const url = new URL(normalizedPath, window.location.origin)
  url.searchParams.set('asc', 'title')
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(offset))
  const normalizedQuery = String(query || '').trim()
  if (normalizedQuery) url.searchParams.set('filter', normalizedQuery)
  else url.searchParams.delete('filter')
  return `${url.pathname}${url.search}`
}

function getTenantFromLocation(urlString: string): string | null {
  try {
    const url = new URL(urlString)
    const hostParts = url.hostname.split('.')
    if (hostParts.length < 3) return null
    return hostParts[0]?.toUpperCase() || null
  } catch {
    return null
  }
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
  if (useCache) {
    const cached = lookupSearchPromiseCache.get(cacheKey)
    if (cached) return cached
  }

  const promise = (async (): Promise<LookupSearchPage> => {
    const path = buildLookupSearchUrl(picklistPath, query, limit, offset)
    const tenant = getTenantFromLocation(window.location.href)
    const runtime = window.__plmExt
    if (!runtime?.requestPlmAction || !tenant) {
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
  })()

  if (useCache) lookupSearchPromiseCache.set(cacheKey, promise)
  return promise
}
