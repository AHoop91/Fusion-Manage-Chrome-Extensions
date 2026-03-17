import { parseGridContextFromPageUrl } from '../../../shared/url/parse'
import type { CapturedGridFieldsPayload, CapturedGridRowsPayload } from '../advanced-view/types'

type GridContext = {
  workspaceId: number
  dmsId: number
}

type GridFieldsCacheEntry = {
  workspaceId: number
  dmsId: number
  viewId: number
  timestamp: number
  data: CapturedGridFieldsPayload
}

type GridRowsCacheEntry = {
  workspaceId: number
  dmsId: number
  viewId: number
  timestamp: number
  data: CapturedGridRowsPayload
}

const fieldsByContextViewKey = new Map<string, GridFieldsCacheEntry>()
const rowsByContextViewKey = new Map<string, GridRowsCacheEntry>()
const latestViewIdByContextKey = new Map<string, { viewId: number; timestamp: number }>()
const fieldHydrationInFlightByContextKey = new Map<string, Promise<boolean>>()
const rowHydrationInFlightByContextKey = new Map<string, Promise<boolean>>()

const DEFAULT_GRID_VIEW_ID = 13
const GRID_ROWS_PAGE_LIMIT = 500
const GRID_ROWS_MAX_PAGES = 40

function toContextKey(workspaceId: number, dmsId: number): string {
  return `${workspaceId}:${dmsId}`
}

function toFieldsKey(workspaceId: number, dmsId: number, viewId: number): string {
  return `${workspaceId}:${dmsId}:${viewId}`
}

function toRowsKey(workspaceId: number, dmsId: number, viewId: number): string {
  return `${workspaceId}:${dmsId}:${viewId}`
}

function getCurrentGridContext(): GridContext | null {
  return parseGridContextFromPageUrl(window.location.href)
}

function updateLatestViewId(workspaceId: number, dmsId: number, viewId: number, timestamp: number): void {
  const contextKey = toContextKey(workspaceId, dmsId)
  const current = latestViewIdByContextKey.get(contextKey)
  if (!current || timestamp >= current.timestamp) {
    latestViewIdByContextKey.set(contextKey, { viewId, timestamp })
  }
}

function cacheFieldsPayload(context: GridContext, viewId: number, payload: CapturedGridFieldsPayload): void {
  const timestamp = Date.now()
  fieldsByContextViewKey.set(toFieldsKey(context.workspaceId, context.dmsId, viewId), {
    workspaceId: context.workspaceId,
    dmsId: context.dmsId,
    viewId,
    timestamp,
    data: payload
  })
  updateLatestViewId(context.workspaceId, context.dmsId, viewId, timestamp)
}

function cacheRowsPayload(context: GridContext, viewId: number, payload: CapturedGridRowsPayload): void {
  const timestamp = Date.now()
  rowsByContextViewKey.set(toRowsKey(context.workspaceId, context.dmsId, viewId), {
    workspaceId: context.workspaceId,
    dmsId: context.dmsId,
    viewId,
    timestamp,
    data: payload
  })
  updateLatestViewId(context.workspaceId, context.dmsId, viewId, timestamp)
}

function getCachedFieldsPayload(context: GridContext, viewId: number): CapturedGridFieldsPayload | null {
  return fieldsByContextViewKey.get(toFieldsKey(context.workspaceId, context.dmsId, viewId))?.data || null
}

function getCachedRowsPayload(context: GridContext, viewId: number): CapturedGridRowsPayload | null {
  return rowsByContextViewKey.get(toRowsKey(context.workspaceId, context.dmsId, viewId))?.data || null
}

async function fetchJson<T>(requestUrl: string): Promise<T | null> {
  try {
    const response = await fetch(requestUrl, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' }
    })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

async function fetchAllRowsForView(context: GridContext, viewId: number): Promise<CapturedGridRowsPayload | null> {
  let offset = 0
  let page = 0
  let firstPayload: CapturedGridRowsPayload | null = null
  const mergedRows: Array<unknown> = []

  while (page < GRID_ROWS_MAX_PAGES) {
    const requestUrl =
      `/api/v3/workspaces/${context.workspaceId}/items/${context.dmsId}/views/${viewId}/rows` +
      `?limit=${GRID_ROWS_PAGE_LIMIT}&offset=${offset}`
    const payload = await fetchJson<CapturedGridRowsPayload>(requestUrl)
    if (!payload) return null

    if (!firstPayload) firstPayload = payload
    const rows = Array.isArray(payload.rows) ? payload.rows : []
    mergedRows.push(...rows)
    if (rows.length < GRID_ROWS_PAGE_LIMIT) break

    offset += GRID_ROWS_PAGE_LIMIT
    page += 1
  }

  if (!firstPayload) return null
  return {
    ...firstPayload,
    rows: mergedRows as CapturedGridRowsPayload['rows']
  }
}

export function getGridViewIdCandidates(workspaceId: number, dmsId: number): number[] {
  const contextKey = toContextKey(workspaceId, dmsId)
  const seen = new Set<number>()
  const ordered: Array<{ viewId: number; timestamp: number }> = []
  const pushCandidate = (viewId: unknown, timestamp: unknown): void => {
    const numericViewId = Number(viewId)
    if (!Number.isFinite(numericViewId) || numericViewId <= 0) return
    if (seen.has(numericViewId)) return
    seen.add(numericViewId)
    ordered.push({
      viewId: numericViewId,
      timestamp: Number.isFinite(Number(timestamp)) ? Number(timestamp) : 0
    })
  }

  const latest = latestViewIdByContextKey.get(contextKey)
  if (latest) pushCandidate(latest.viewId, latest.timestamp)

  for (const entry of rowsByContextViewKey.values()) {
    if (entry.workspaceId !== workspaceId || entry.dmsId !== dmsId) continue
    pushCandidate(entry.viewId, entry.timestamp)
  }

  for (const entry of fieldsByContextViewKey.values()) {
    if (entry.workspaceId !== workspaceId || entry.dmsId !== dmsId) continue
    pushCandidate(entry.viewId, entry.timestamp)
  }

  pushCandidate(DEFAULT_GRID_VIEW_ID, -1)
  ordered.sort((left, right) => right.timestamp - left.timestamp)
  return ordered.map((entry) => entry.viewId)
}

export function getLatestGridViewIdForContext(workspaceId: number, dmsId: number): number | null {
  return getGridViewIdCandidates(workspaceId, dmsId)[0] || null
}

export function getGridFieldsPayloadForContext(workspaceId: number, dmsId: number): CapturedGridFieldsPayload | null {
  const context = { workspaceId, dmsId }
  for (const viewId of getGridViewIdCandidates(workspaceId, dmsId)) {
    const payload = getCachedFieldsPayload(context, viewId)
    if (Array.isArray(payload?.fields) && payload.fields.length > 0) return payload
  }
  return null
}

export function getGridRowsPayloadForContext(workspaceId: number, dmsId: number): CapturedGridRowsPayload | null {
  const context = { workspaceId, dmsId }
  let bestPayload: CapturedGridRowsPayload | null = null
  let bestRowCount = -1

  for (const viewId of getGridViewIdCandidates(workspaceId, dmsId)) {
    const payload = getCachedRowsPayload(context, viewId)
    const rows = Array.isArray(payload?.rows) ? payload.rows : []
    if (!payload || rows.length < bestRowCount) continue
    bestPayload = payload
    bestRowCount = rows.length
  }

  return bestPayload
}

export function getGridFieldsPayloadForCurrentContext(): CapturedGridFieldsPayload | null {
  const context = getCurrentGridContext()
  if (!context) return null
  return getGridFieldsPayloadForContext(context.workspaceId, context.dmsId)
}

export function getGridRowsPayloadForCurrentContext(): CapturedGridRowsPayload | null {
  const context = getCurrentGridContext()
  if (!context) return null
  return getGridRowsPayloadForContext(context.workspaceId, context.dmsId)
}

export function clearGridRowsPayloadForCurrentContext(): void {
  const context = getCurrentGridContext()
  if (!context) return

  const contextKey = toContextKey(context.workspaceId, context.dmsId)
  rowHydrationInFlightByContextKey.delete(contextKey)

  for (const key of Array.from(rowsByContextViewKey.keys())) {
    if (!key.startsWith(`${context.workspaceId}:${context.dmsId}:`)) continue
    rowsByContextViewKey.delete(key)
  }
}

export async function hydrateGridFieldsForCurrentContext(): Promise<boolean> {
  const context = getCurrentGridContext()
  if (!context) return false

  const contextKey = toContextKey(context.workspaceId, context.dmsId)
  const existing = fieldHydrationInFlightByContextKey.get(contextKey)
  if (existing) return existing

  const run = (async (): Promise<boolean> => {
    try {
      for (const viewId of getGridViewIdCandidates(context.workspaceId, context.dmsId)) {
        const cached = getCachedFieldsPayload(context, viewId)
        if (Array.isArray(cached?.fields) && cached.fields.length > 0) return true

        const requestUrl = `/api/v3/workspaces/${context.workspaceId}/items/${context.dmsId}/views/${viewId}/fields`
        const payload = await fetchJson<CapturedGridFieldsPayload>(requestUrl)
        if (!Array.isArray(payload?.fields) || payload.fields.length === 0) continue
        cacheFieldsPayload(context, viewId, payload)
        return true
      }
      return false
    } finally {
      fieldHydrationInFlightByContextKey.delete(contextKey)
    }
  })()

  fieldHydrationInFlightByContextKey.set(contextKey, run)
  return run
}

export async function hydrateGridRowsForCurrentContext(): Promise<boolean> {
  const context = getCurrentGridContext()
  if (!context) return false

  const contextKey = toContextKey(context.workspaceId, context.dmsId)
  const existing = rowHydrationInFlightByContextKey.get(contextKey)
  if (existing) return existing

  const run = (async (): Promise<boolean> => {
    try {
      for (const viewId of getGridViewIdCandidates(context.workspaceId, context.dmsId)) {
        const cached = getCachedRowsPayload(context, viewId)
        if (Array.isArray(cached?.rows) && cached.rows.length > 0) return true

        const payload = await fetchAllRowsForView(context, viewId)
        if (!payload) continue
        cacheRowsPayload(context, viewId, payload)
        if (Array.isArray(payload.rows) && payload.rows.length > 0) return true
      }
      return false
    } finally {
      rowHydrationInFlightByContextKey.delete(contextKey)
    }
  })()

  rowHydrationInFlightByContextKey.set(contextKey, run)
  return run
}

export function clearGridApiMetadataCache(): void {
  fieldsByContextViewKey.clear()
  rowsByContextViewKey.clear()
  latestViewIdByContextKey.clear()
  fieldHydrationInFlightByContextKey.clear()
  rowHydrationInFlightByContextKey.clear()
}
