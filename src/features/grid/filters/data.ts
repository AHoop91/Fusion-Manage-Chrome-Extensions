import { GRID_MASTER_TABLE_SELECTOR, GRID_ROW_HIDDEN_CLASS } from './constants'
import { classifyColumnKind } from './filterEngine'
import type { ApiFieldMeta, HeaderMeta } from './model'
import type { GridColumnDef, IndexedGridRow } from '../grid.types'
import { parseGridContextFromPageUrl } from '../../../shared/url/parse'
import { normalizeText, normalizeWhitespace } from '../../../shared/utils/text'
import type { CapturedGridFieldsPayload } from '../advanced-view/types'
import {
  getGridFieldsPayloadForContext,
  getGridFieldsPayloadForCurrentContext,
  getLatestGridViewIdForContext as getLatestGridViewIdFromApiCache,
  hydrateGridFieldsForCurrentContext
} from '../services/gridApiMetadata'

function buildColumnKey(raw: string, index: number, used: Set<string>): string {
  const normalized = normalizeText(raw).replace(/[^a-z0-9]+/g, '_') || `col_${index + 1}`
  let key = normalized
  let suffix = 2
  while (used.has(key)) {
    key = `${normalized}_${suffix}`
    suffix += 1
  }
  used.add(key)
  return key
}

function extractHeaderMeta(cell: HTMLTableCellElement, index: number): HeaderMeta {
  const headerValue = cell.querySelector('.header') as HTMLElement | null
  const titleFromAttr = (headerValue?.getAttribute('title') || '').trim()
  const titleFromText = (headerValue?.textContent || cell.textContent || '').replace(/\s+/g, ' ').trim()
  const syntheticTitle = !titleFromAttr && !titleFromText
  const title = titleFromAttr || titleFromText || `Column ${index + 1}`
  const rawFieldId = (headerValue?.getAttribute('field-id') || '').trim()
  const fieldId = rawFieldId.replace(/^_+|_+$/g, '')

  return {
    key: fieldId || title,
    title,
    fieldId,
    syntheticTitle
  }
}

export function extractCellValue(cell: HTMLTableCellElement | null): string {
  if (!cell) return ''

  const checkboxInput = cell.querySelector('input[type="checkbox"]') as HTMLInputElement | null
  if (checkboxInput) {
    return checkboxInput.checked ? 'true' : 'false'
  }

  const ariaCheckedNode = cell.querySelector('[aria-checked]') as HTMLElement | null
  if (ariaCheckedNode) {
    const ariaChecked = normalizeWhitespace(ariaCheckedNode.getAttribute('aria-checked') || '')
    if (ariaChecked === 'true' || ariaChecked === 'false') return ariaChecked
  }

  const fromTitle = normalizeWhitespace(cell.getAttribute('title') || '')
  if (fromTitle) return normalizeText(fromTitle)

  const fromText = normalizeWhitespace(cell.textContent || '')
  if (fromText) return normalizeText(fromText)

  return ''
}

function isLikelySelectionColumn(table: HTMLTableElement, index: number, header: HeaderMeta): boolean {
  if (index !== 0) return false
  if (header.fieldId) return false

  const titleIsSynthetic = header.syntheticTitle || /^column\s+\d+$/i.test(header.title)
  if (!titleIsSynthetic) return false

  const rows = Array.from(table.tBodies?.[0]?.rows || []).slice(0, 30) as HTMLTableRowElement[]
  if (rows.length === 0) return true

  for (const row of rows) {
    const cell = row.cells[index] as HTMLTableCellElement | undefined
    if (!cell) continue
    if (extractCellValue(cell)) return false
  }

  return true
}

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

    const workspaceId = Number.parseInt(pathMatch[1], 10)
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

export function getGridTable(): HTMLTableElement | null {
  return document.querySelector(GRID_MASTER_TABLE_SELECTOR) as HTMLTableElement | null
}

export function isGridLoading(): boolean {
  const loader = document.getElementById('spreadsheetLoader')
  if (!loader) return false
  return !loader.classList.contains('vis-hidden')
}

export function getApiFieldsPayloadForContext(workspaceId: number, dmsId: number): CapturedGridFieldsPayload | null {
  return getGridFieldsPayloadForContext(workspaceId, dmsId)
}

export function getLatestGridViewIdForContext(workspaceId: number, dmsId: number): number | null {
  return getLatestGridViewIdFromApiCache(workspaceId, dmsId)
}

export function buildApiFieldMeta(payload: CapturedGridFieldsPayload | null): ApiFieldMeta[] {
  if (!payload || !Array.isArray(payload.fields) || payload.fields.length === 0) return []

  const map = new Map<string, ApiFieldMeta>()
  for (const field of payload.fields) {
    if (!field || typeof field !== 'object') continue
    if (field.derived === true) continue

    const title = String(field.label || field.name || '').trim()
    const fieldId = String(field.name || '').trim().toUpperCase()
    if (!title || !fieldId || /^row id$/i.test(title) || /^rowid$/i.test(fieldId)) continue

    if (!map.has(fieldId)) {
      map.set(fieldId, {
        fieldId,
        title,
        kind: classifyColumnKind(String(field.type?.title || ''))
      })
    }
  }

  return Array.from(map.values())
}

export function hasApiMetadataForCurrentGrid(): boolean {
  const context = parseGridPageContext(window.location.href)
  if (!context) return true
  return Boolean(getGridFieldsPayloadForCurrentContext())
}

function buildTableColumns(table: HTMLTableElement): GridColumnDef[] {
  const headerRow = table.tHead?.rows?.[0]
  if (!headerRow) return []

  const cells = Array.from(headerRow.cells) as HTMLTableCellElement[]
  const used = new Set<string>()
  const columns: GridColumnDef[] = []

  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index]
    const header = extractHeaderMeta(cell, index)
    if (isLikelySelectionColumn(table, index, header)) continue
    columns.push({
      key: buildColumnKey(header.key, index, used),
      title: header.title,
      index,
      kind: 'text',
      fieldId: header.fieldId ? header.fieldId.toUpperCase() : undefined
    })
  }

  return columns
}

export function buildColumns(table: HTMLTableElement): GridColumnDef[] {
  const tableColumns = buildTableColumns(table)
  if (tableColumns.length === 0) return []

  const context = parseGridPageContext(window.location.href)
  if (!context) return tableColumns

  const payload = getApiFieldsPayloadForContext(context.workspaceId, context.dmsId)
  if (!payload) {
    void hydrateGridFieldsForCurrentContext()
    return []
  }
  const apiFields = buildApiFieldMeta(payload)
  if (apiFields.length === 0) return []

  const fieldsById = new Map(apiFields.map((field) => [field.fieldId.toUpperCase(), field]))
  const fieldsByTitle = new Map(apiFields.map((field) => [normalizeText(field.title), field]))

  const apiDrivenColumns: GridColumnDef[] = []
  for (const column of tableColumns) {
    const fromId = column.fieldId ? fieldsById.get(column.fieldId.toUpperCase()) : null
    const fromTitle = fieldsByTitle.get(normalizeText(column.title))
    const matched = fromId || fromTitle
    if (!matched) continue

    apiDrivenColumns.push({
      ...column,
      title: matched.title || column.title,
      kind: matched.kind,
      fieldId: matched.fieldId
    })
  }

  return apiDrivenColumns
}

/**
 * Build normalized row index from current rendered grid table.
 */
export function buildRowIndex(table: HTMLTableElement, columns: GridColumnDef[]): IndexedGridRow[] {
  const tbody = table.tBodies?.[0]
  if (!tbody) return []
  const rows = Array.from(tbody.rows) as HTMLTableRowElement[]

  const indexed: IndexedGridRow[] = []
  for (const row of rows) {
    const cells = Array.from(row.cells) as HTMLTableCellElement[]
    if (cells.length === 0) continue

    const values = columns.map((column) => extractCellValue(cells[column.index] || null))
    indexed.push({
      row,
      values,
      searchableText: values.join(' '),
      visible: !row.classList.contains(GRID_ROW_HIDDEN_CLASS)
    })
  }

  return indexed
}

