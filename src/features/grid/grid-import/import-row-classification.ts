import { normalizeText } from '../../../shared/utils/text'
import type { CsvParseResult, GridImportMappedCell } from './types'

export type GridImportMatchableRow = {
  rowId: string | null
  index: number
  byFieldId: Map<string, string>
}

export type GridImportNonEmptyCsvRow = {
  row: string[]
  csvRowNumber: number
}

export type GridImportRowClassification =
  | { kind: 'insert' }
  | { kind: 'update'; matchedRowId: string; matchedApiRowIndex: number }
  | { kind: 'error'; code: 'ambiguous-match' | 'missing-row-id' | 'no-mapped-values' }

function normalizeMatchValue(value: unknown): string {
  return normalizeText(String(value || '').trim())
}

export function buildCompositeKeyFromValues(values: string[]): string | null {
  if (values.length === 0) return null
  if (values.some((value) => !normalizeMatchValue(value))) return null
  return values.map(normalizeMatchValue).join('\u001f')
}

export function buildExistingRowMatchIndex(
  existingRows: GridImportMatchableRow[] | undefined,
  matchFieldIds: string[]
): Map<string, GridImportMatchableRow[]> {
  const index = new Map<string, GridImportMatchableRow[]>()
  if (!existingRows || matchFieldIds.length === 0) return index
  for (const row of existingRows) {
    const key = buildCompositeKeyFromValues(matchFieldIds.map((fieldId) => row.byFieldId.get(fieldId) || ''))
    if (!key) continue
    const rows = index.get(key) || []
    rows.push(row)
    index.set(key, rows)
  }
  return index
}

export function getNonEmptyCsvRows(parsed: CsvParseResult): GridImportNonEmptyCsvRow[] {
  return parsed.rows
    .map((row, index) => ({ row, csvRowNumber: index + 2 }))
    .filter((entry) => entry.row.some((value) => String(value || '').trim()))
}

export function classifyImportRowMatch(
  cells: GridImportMappedCell[],
  matchFieldIds: string[],
  existingMatchIndex: Map<string, GridImportMatchableRow[]>
): GridImportRowClassification {
  const cellByFieldId = new Map(cells.map((cell) => [cell.field.fieldId, cell.value]))
  const matchKey = buildCompositeKeyFromValues(matchFieldIds.map((fieldId) => cellByFieldId.get(fieldId) || ''))
  const matches = matchKey ? existingMatchIndex.get(matchKey) || [] : []
  if (matches.length > 1) return { kind: 'error', code: 'ambiguous-match' }
  if (matches.length === 1) {
    const matched = matches[0]
    if (!matched.rowId) return { kind: 'error', code: 'missing-row-id' }
    return { kind: 'update', matchedRowId: matched.rowId, matchedApiRowIndex: matched.index }
  }
  return { kind: 'insert' }
}

export function classificationErrorMessage(
  code: Extract<GridImportRowClassification, { kind: 'error' }>['code'] | 'no-mapped-values'
): string {
  if (code === 'ambiguous-match') return 'Multiple existing grid rows match selected Match On fields.'
  if (code === 'missing-row-id') return 'Matched grid row is missing a row id.'
  return 'No mapped field values for row.'
}
