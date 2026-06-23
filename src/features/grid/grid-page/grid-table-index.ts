import {
  GRID_AGGREGATION_ROW_CLASS,
  GRID_MASTER_TABLE_SELECTOR,
  GRID_ROW_HIDDEN_CLASS
} from './grid-page.constants'
import type { GridColumnDef, IndexedGridRow } from '../grid.types'
import { normalizeText, normalizeWhitespace } from '../../../shared/utils/text'

type HeaderMeta = {
  key: string
  title: string
  fieldId: string
  syntheticTitle: boolean
}

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
  if (fromTitle) return fromTitle

  const fromText = normalizeWhitespace(cell.textContent || '')
  if (fromText) return fromText

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

export function isGridAggregationRow(row: HTMLTableRowElement): boolean {
  if (row.classList.contains(GRID_AGGREGATION_ROW_CLASS)) return true
  return Array.from(row.cells).some((cell) => cell.classList.contains(GRID_AGGREGATION_ROW_CLASS))
}

export function getGridTable(): HTMLTableElement | null {
  return document.querySelector(GRID_MASTER_TABLE_SELECTOR) as HTMLTableElement | null
}

export function isGridLoading(): boolean {
  const loader = document.getElementById('spreadsheetLoader')
  if (!loader) return false
  return !loader.classList.contains('vis-hidden')
}

export function buildTableColumns(table: HTMLTableElement): GridColumnDef[] {
  const headerRow = table.tHead?.rows?.[0]
  if (!headerRow) return []

  const cells = Array.from(headerRow.cells) as HTMLTableCellElement[]
  const used = new Set<string>()
  const columns: GridColumnDef[] = []

  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index]! // bounded by cells.length
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

/**
 * Build normalized row index from current rendered grid table.
 */
export function buildRowIndex(table: HTMLTableElement, columns: GridColumnDef[]): IndexedGridRow[] {
  const tbody = table.tBodies?.[0]
  if (!tbody) return []
  const rows = Array.from(tbody.rows) as HTMLTableRowElement[]

  const indexed: IndexedGridRow[] = []
  for (const row of rows) {
    if (isGridAggregationRow(row)) continue
    const cells = Array.from(row.cells) as HTMLTableCellElement[]
    if (cells.length === 0) continue

    const values = columns.map((column) => extractCellValue(cells[column.index] || null))
    indexed.push({
      row,
      values,
      searchableText: normalizeText(values.join(' ')),
      visible: !row.classList.contains(GRID_ROW_HIDDEN_CLASS)
    })
  }

  return indexed
}
