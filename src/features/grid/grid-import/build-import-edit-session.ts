import type {
  GridImportEditRow,
  GridImportEditRowValidationHint,
  GridImportEditSession
} from '../grid-staging/grid-import-edit-session'
import {
  buildExistingRowMatchIndex,
  classifyImportRowMatch,
  classificationErrorMessage,
  getNonEmptyCsvRows,
  type GridImportMatchableRow
} from './import-row-classification'
import {
  buildGridImportRowData,
  gridStagedFieldValuesForImportEditUpdate,
  gridStagedFieldValuesFromSubmitData
} from './import-row-data'
import type {
  CsvParseResult,
  GridImportField,
  GridImportMapping,
  GridImportRowValidationStatus,
  GridImportValidationResult
} from './types'
import { getMappedRowCells } from './validation.service'

export type BuildImportEditSessionInput = {
  fileName: string
  parsed: CsvParseResult
  fields: GridImportField[]
  mapping: GridImportMapping[]
  matchFieldIds: string[]
  validation: GridImportValidationResult
  rowValidation: Record<number, GridImportRowValidationStatus>
  existingRows?: GridImportMatchableRow[]
  domRowIndexByRowId?: ReadonlyMap<string, number>
}

function toValidationHints(
  rowValidation: Record<number, GridImportRowValidationStatus>
): GridImportEditSession['validationHints'] {
  const rowValidationByCsvRow: Record<number, GridImportEditRowValidationHint> = {}
  const blockingCsvRowNumbers: number[] = []
  for (const [csvRowKey, status] of Object.entries(rowValidation)) {
    const csvRowNumber = Number(csvRowKey)
    if (!Number.isFinite(csvRowNumber)) continue
    rowValidationByCsvRow[csvRowNumber] = {
      tone: status.tone,
      messages: [...status.messages]
    }
    if (status.tone === 'error') blockingCsvRowNumbers.push(csvRowNumber)
  }
  blockingCsvRowNumbers.sort((a, b) => a - b)
  return { rowValidationByCsvRow, blockingCsvRowNumbers }
}

function sourceRowLabel(csvRowNumber: number): string {
  return `CSV row ${csvRowNumber}`
}

/** Aligns with `runImport` gate in `import.controller.ts`. */
export const IMPORT_EDIT_SESSION_VALIDATION_MESSAGE =
  'Resolve field validation issues before importing.'

export const IMPORT_EDIT_MATCH_ONLY_SKIP_MESSAGE =
  'CSV row matched an existing grid row, but only Match On fields were mapped, so there are no editable changes to stage.'

export type ImportEditSkippedRowsSummary = {
  skippedRowCount: number
  firstReason: string
  hasAdditionalSkippedRows: boolean
}

export function summarizeImportEditSkippedRows(
  skippedRows: GridImportEditSession['skippedRows']
): ImportEditSkippedRowsSummary | null {
  if (skippedRows.length === 0) return null
  const firstReason = String(skippedRows[0]?.reason || '').trim() || 'Unknown reason.'
  return {
    skippedRowCount: skippedRows.length,
    firstReason,
    hasAdditionalSkippedRows: skippedRows.length > 1
  }
}

export function formatImportEditAllSkippedStatus(summary: ImportEditSkippedRowsSummary): string {
  const additional =
    summary.hasAdditionalSkippedRows ? ' Additional skipped rows may have other reasons.' : ''
  return (
    `No rows can be opened in the advanced editor. ${summary.skippedRowCount} CSV row(s) could not be staged. ` +
    `First reason: ${summary.firstReason}${additional}`
  )
}

export async function buildImportEditSession(input: BuildImportEditSessionInput): Promise<GridImportEditSession> {
  const {
    fileName,
    parsed,
    fields,
    mapping,
    matchFieldIds,
    validation,
    rowValidation,
    existingRows,
    domRowIndexByRowId
  } = input

  if (!validation.valid) {
    throw new Error(IMPORT_EDIT_SESSION_VALIDATION_MESSAGE)
  }

  const existingMatchIndex = buildExistingRowMatchIndex(existingRows, matchFieldIds)
  const rows: GridImportEditRow[] = []
  const skippedRows: GridImportEditSession['skippedRows'] = []

  for (const entry of getNonEmptyCsvRows(parsed)) {
    const cells = getMappedRowCells(entry.row, parsed.headers, fields, mapping)
    const data = await buildGridImportRowData(cells)
    if (data.length === 0) {
      skippedRows.push({
        csvRowNumber: entry.csvRowNumber,
        reason: classificationErrorMessage('no-mapped-values')
      })
      continue
    }

    const classification = classifyImportRowMatch(cells, matchFieldIds, existingMatchIndex)

    if (classification.kind === 'error') {
      skippedRows.push({
        csvRowNumber: entry.csvRowNumber,
        reason: classificationErrorMessage(classification.code)
      })
      continue
    }

    if (classification.kind === 'update') {
      const stagedFields = gridStagedFieldValuesForImportEditUpdate(data, matchFieldIds)
      if (stagedFields.length === 0) {
        skippedRows.push({
          csvRowNumber: entry.csvRowNumber,
          reason: IMPORT_EDIT_MATCH_ONLY_SKIP_MESSAGE
        })
        continue
      }
      rows.push({
        kind: 'update',
        csvRowNumber: entry.csvRowNumber,
        matchedRowId: classification.matchedRowId,
        matchedApiRowIndex: classification.matchedApiRowIndex,
        domRowIndex: domRowIndexByRowId?.get(classification.matchedRowId) ?? null,
        fields: stagedFields
      })
      continue
    }

    rows.push({
      kind: 'insert',
      csvRowNumber: entry.csvRowNumber,
      sourceRowLabel: sourceRowLabel(entry.csvRowNumber),
      fields: gridStagedFieldValuesFromSubmitData(data)
    })
  }

  return {
    source: 'grid-import',
    fileName,
    rows,
    validationHints: toValidationHints(rowValidation),
    skippedRows
  }
}

/**
 * Returns whether import validation state allows building an edit session.
 * Mirrors the gate used before commit (`validation.valid`).
 */
export function canBuildImportEditSession(validation: GridImportValidationResult | null): boolean {
  return Boolean(validation?.valid)
}
