/**
 * Handoff contract from grid-import to the advanced editor (Phase A+).
 * Independent of advanced-editor staging implementation types.
 */

export type GridStagedFieldValue = {
  fieldId: string
  payload: string
  display: string
}

export type GridImportEditInsertRow = {
  kind: 'insert'
  csvRowNumber: number
  sourceRowLabel: string
  fields: GridStagedFieldValue[]
}

export type GridImportEditUpdateRow = {
  kind: 'update'
  csvRowNumber: number
  matchedRowId: string
  /** API row index from existing grid metadata; used when dom row index is not yet known. */
  matchedApiRowIndex: number
  /**
   * DOM row index for advanced-editor staging when the caller can resolve it
   * (e.g. after grid hydration). Null until mapped.
   */
  domRowIndex: number | null
  fields: GridStagedFieldValue[]
}

export type GridImportEditRow = GridImportEditInsertRow | GridImportEditUpdateRow

export type GridImportEditValidationTone = 'pass' | 'error' | 'warning'

export type GridImportEditRowValidationHint = {
  tone: GridImportEditValidationTone
  messages: string[]
}

export type GridImportEditSession = {
  source: 'grid-import'
  fileName: string
  rows: GridImportEditRow[]
  validationHints: {
    rowValidationByCsvRow: Record<number, GridImportEditRowValidationHint>
    blockingCsvRowNumbers: number[]
  }
  skippedRows: Array<{ csvRowNumber: number; reason: string }>
}

export type GridImportEditOpenResult =
  | { ok: true }
  | { ok: false; reason: string }
