import type { ApiRowProjection } from '../grid-advanced-editor/types'
import type { CsvParseResult, GridImportField, GridImportMapping } from './types'
import { buildGridImportRowData } from './import-row-data'
import {
  buildExistingRowMatchIndex,
  classifyImportRowMatch,
  classificationErrorMessage,
  getNonEmptyCsvRows,
  type GridImportMatchableRow
} from './import-row-classification'
import { getMappedRowCells } from './validation.service'

export type { GridImportSubmitDataEntry } from './types'
export { buildGridImportRowData } from './import-row-data'

export type GridImportSubmitContext = {
  ext: {
    requestPlmAction: <T = unknown>(action: string, payload?: Record<string, unknown>) => Promise<T>
  }
  tenant: string
  workspaceId: number
  dmsId: number
  viewId: number
  existingRows?: ApiRowProjection[]
  matchFieldIds?: string[]
}

export type GridImportSubmitProgress = {
  completed: number
  total: number
  message: string
}

export type GridImportSubmitFailure = {
  row: number
  message: string
}

export type GridImportSubmitResult = {
  successCount: number
  addCount: number
  updateCount: number
  failures: GridImportSubmitFailure[]
}

function toMatchableRows(rows: ApiRowProjection[] | undefined): GridImportMatchableRow[] | undefined {
  if (!rows) return undefined
  return rows.map((row) => ({
    rowId: row.rowId,
    index: row.index,
    byFieldId: row.byFieldId
  }))
}

export async function submitGridImportRows(
  parsed: CsvParseResult,
  fields: GridImportField[],
  mapping: GridImportMapping[],
  context: GridImportSubmitContext,
  onProgress: (progress: GridImportSubmitProgress) => void
): Promise<GridImportSubmitResult> {
  const failures: GridImportSubmitFailure[] = []
  let successCount = 0
  let addCount = 0
  let updateCount = 0
  const matchFieldIds = context.matchFieldIds || []
  const existingMatchIndex = buildExistingRowMatchIndex(toMatchableRows(context.existingRows), matchFieldIds)
  const nonEmptyRows = getNonEmptyCsvRows(parsed)

  onProgress({ completed: 0, total: nonEmptyRows.length, message: 'Starting import...' })
  for (let index = 0; index < nonEmptyRows.length; index += 1) {
    const entry = nonEmptyRows[index]
    try {
      const cells = getMappedRowCells(entry.row, parsed.headers, fields, mapping)
      const data = await buildGridImportRowData(cells)
      if (data.length === 0) throw new Error(classificationErrorMessage('no-mapped-values'))
      const classification = classifyImportRowMatch(cells, matchFieldIds, existingMatchIndex)
      if (classification.kind === 'error') {
        throw new Error(classificationErrorMessage(classification.code))
      }
      if (classification.kind === 'update') {
        await context.ext.requestPlmAction('updateItemGridRow', {
          tenant: context.tenant,
          workspaceId: context.workspaceId,
          dmsId: context.dmsId,
          viewId: context.viewId,
          rowId: classification.matchedRowId,
          data
        })
        updateCount += 1
      } else {
        await context.ext.requestPlmAction('addItemGridRow', {
          tenant: context.tenant,
          workspaceId: context.workspaceId,
          dmsId: context.dmsId,
          viewId: context.viewId,
          data
        })
        addCount += 1
      }
      successCount += 1
    } catch (error) {
      failures.push({
        row: entry.csvRowNumber,
        message: error instanceof Error ? error.message : 'Import request failed.'
      })
    }
    onProgress({
      completed: index + 1,
      total: nonEmptyRows.length,
      message: `Imported ${index + 1} of ${nonEmptyRows.length} row(s)...`
    })
  }

  return { successCount, addCount, updateCount, failures }
}
