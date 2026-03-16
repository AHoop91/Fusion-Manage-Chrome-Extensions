import { COLUMN_DEFS, ROW_HIDDEN_CLASS, createEmptyColumnFilters, createEmptyColumnIndexMap } from './constants'
import type { ColumnIndexMap, ColumnKey, IndexedUserRow } from './types'
import { normalizeText, titleCase } from './utils'

function getImageTokens(cell: HTMLTableCellElement): string[] {
  const images = Array.from(cell.querySelectorAll('img'))
  const tokens: string[] = []

  for (const image of images) {
    const title = normalizeText(image.getAttribute('title') || image.getAttribute('alt') || '')
    const src = normalizeText(image.getAttribute('src') || '')
    if (title) tokens.push(title)
    if (src) tokens.push(src)
  }

  return tokens
}

export function normalizeTwoFactorValue(cell: HTMLTableCellElement): string {
  const text = normalizeText(cell.textContent || '')
  if (text) return text

  const tokens = getImageTokens(cell)
  if (tokens.length === 0) return ''

  for (const token of tokens) {
    if (token.includes('managed outside') || token.includes('/2fa/sso') || token.includes('sso')) {
      return 'sso'
    }
    if (token.includes('/2fa/enabled') || token.includes('enabled')) {
      return 'enabled'
    }
    if (token.includes('/2fa/disabled') || token.includes('disabled')) {
      return 'disabled'
    }
    if (token.includes('external')) {
      return 'external'
    }
  }

  return 'configured'
}

export function extractColumnValue(cell: HTMLTableCellElement | null, key: ColumnKey): string {
  if (!cell) return ''
  if (key === 'twoFactor') return normalizeTwoFactorValue(cell)

  const text = normalizeText(cell.textContent || '')
  if (text) return text

  const tokens = getImageTokens(cell)
  return tokens[0] || ''
}

export function getCellDisplayText(cell: HTMLTableCellElement | null, key: ColumnKey): string {
  if (!cell) return ''

  if (key === 'twoFactor') {
    const value = normalizeTwoFactorValue(cell)
    return value ? titleCase(value) : ''
  }

  const text = String(cell.textContent || '').replace(/\s+/g, ' ').trim()
  if (text) return text

  const image = cell.querySelector('img')
  if (!image) return ''

  return String(image.getAttribute('title') || image.getAttribute('alt') || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function getHeaderCells(table: HTMLTableElement): HTMLTableCellElement[] {
  if (table.tHead?.rows?.length) {
    return Array.from(table.tHead.rows[0].cells) as HTMLTableCellElement[]
  }

  const tbody = table.tBodies?.[0]
  if (!tbody) return []

  for (const row of Array.from(tbody.rows)) {
    if (row.querySelector('th')) {
      return Array.from(row.cells) as HTMLTableCellElement[]
    }
  }

  return []
}

export function resolveColumnIndexMap(table: HTMLTableElement): ColumnIndexMap {
  const map = createEmptyColumnIndexMap()
  const headerCells = getHeaderCells(table)
  const normalizedHeaders = headerCells.map((cell) => normalizeText(cell.textContent || cell.getAttribute('title') || ''))

  for (const definition of COLUMN_DEFS) {
    let foundIndex = -1

    for (let index = 0; index < normalizedHeaders.length; index += 1) {
      const header = normalizedHeaders[index]
      if (!header) continue

      for (const aliasText of definition.aliases) {
        const alias = normalizeText(aliasText)
        if (header === alias || header.includes(alias)) {
          foundIndex = index
          break
        }
      }

      if (foundIndex !== -1) break
    }

    map[definition.key] = foundIndex
  }

  return map
}

/**
 * Build a normalized in-memory index so filtering avoids repeated DOM reads.
 */
export function buildRowIndex(
  table: HTMLTableElement
): { indexedRows: IndexedUserRow[]; columnIndexByKey: ColumnIndexMap } {
  const columnIndexByKey = resolveColumnIndexMap(table)

  const tbody = table.tBodies?.[0]
  if (!tbody) {
    return {
      indexedRows: [],
      columnIndexByKey
    }
  }

  const indexedRows: IndexedUserRow[] = []
  for (const row of Array.from(tbody.rows) as HTMLTableRowElement[]) {
    if (row.querySelector('th')) continue

    const cells = Array.from(row.cells) as HTMLTableCellElement[]
    const searchable: string[] = []
    const columns = createEmptyColumnFilters()

    for (const cell of cells) {
      const cellText = normalizeText(cell.textContent || '')
      if (cellText) searchable.push(cellText)
    }

    for (const definition of COLUMN_DEFS) {
      const columnIndex = columnIndexByKey[definition.key]
      if (columnIndex >= 0 && columnIndex < cells.length) {
        columns[definition.key] = extractColumnValue(cells[columnIndex], definition.key)
      }
    }

    indexedRows.push({
      row,
      searchableText: searchable.join(' '),
      columns,
      visible: !row.classList.contains(ROW_HIDDEN_CLASS)
    })
  }

  return {
    indexedRows,
    columnIndexByKey
  }
}
