import type {
  GridImportEditRow,
  GridImportEditSession,
  GridImportEditUpdateRow,
  GridStagedFieldValue
} from '../grid-staging/grid-import-edit-session'
import type { PendingInsertDraftLike } from './view/formFieldsRenderer'
import type { SelectedRowModel } from './types'
import type { StagingManager } from './services/staging.service'

export type ImportSessionSeedFocus =
  | { type: 'insert'; insertIndex: number }
  | { type: 'existing'; rowIndex: number }

export type ImportSessionSeedResult = {
  insertCount: number
  updateCount: number
  skippedUpdateCount: number
  focus: ImportSessionSeedFocus | null
}

export function gridStagedFieldValuesToMaps(fields: GridStagedFieldValue[]): {
  payload: Map<string, string>
  display: Map<string, string>
} {
  return {
    payload: new Map(fields.map((field) => [field.fieldId, field.payload])),
    display: new Map(fields.map((field) => [field.fieldId, field.display]))
  }
}

export function buildInsertDraftFromImportRow(row: Extract<GridImportEditRow, { kind: 'insert' }>): PendingInsertDraftLike {
  const maps = gridStagedFieldValuesToMaps(row.fields)
  return {
    payload: maps.payload,
    display: maps.display,
    source: 'add'
  }
}

function apiRowIdMatches(model: SelectedRowModel, matchedRowId: string): boolean {
  return String(model.apiRow?.rowId || '').trim() === matchedRowId
}

/**
 * Resolves a live grid row index for staged update operations.
 * Imported CSV rows are never added to `selectedRowModels`; only existing DOM/API rows are matched.
 */
export function resolveDomRowIndexForImportUpdate(
  row: GridImportEditUpdateRow,
  selectedRowModels: SelectedRowModel[]
): number | null {
  const matchedRowId = String(row.matchedRowId || '').trim()

  if (row.domRowIndex !== null && Number.isFinite(row.domRowIndex)) {
    const matched = selectedRowModels.find((model) => model.domRowIndex === row.domRowIndex)
    if (matched) {
      if (!matchedRowId || apiRowIdMatches(matched, matchedRowId)) {
        return matched.domRowIndex
      }
    }
  }

  if (matchedRowId) {
    const byRowId = selectedRowModels.find((model) => apiRowIdMatches(model, matchedRowId))
    if (byRowId) return byRowId.domRowIndex
  }

  const byApiIndex = selectedRowModels[row.matchedApiRowIndex]
  if (byApiIndex && (!matchedRowId || apiRowIdMatches(byApiIndex, matchedRowId))) {
    return byApiIndex.domRowIndex
  }

  return null
}

export function resolveExistingRowIndexForDomRow(
  domRowIndex: number,
  selectedRowModels: SelectedRowModel[]
): number | null {
  const index = selectedRowModels.findIndex((model) => model.domRowIndex === domRowIndex)
  return index >= 0 ? index : null
}

/**
 * Seeds the advanced editor staging queue from a grid-import handoff session.
 * Insert rows become staged insert drafts; update rows become staged payload/display maps on existing rows.
 */
export function seedImportEditSession(
  staging: StagingManager,
  session: GridImportEditSession,
  selectedRowModels: SelectedRowModel[]
): ImportSessionSeedResult {
  const queue = staging.getQueue()
  let insertCount = 0
  let updateCount = 0
  let skippedUpdateCount = 0
  let focus: ImportSessionSeedFocus | null = null

  for (const row of session.rows) {
    if (row.kind === 'insert') {
      const insertIndex = staging.addInsertDraft(buildInsertDraftFromImportRow(row))
      insertCount += 1
      if (!focus) focus = { type: 'insert', insertIndex }
      continue
    }

    const domRowIndex = resolveDomRowIndexForImportUpdate(row, selectedRowModels)
    if (domRowIndex === null) {
      skippedUpdateCount += 1
      continue
    }

    const maps = gridStagedFieldValuesToMaps(row.fields)
    if (maps.payload.size === 0) continue
    queue.stage({
      kind: 'update',
      domRowIndex,
      payload: maps.payload,
      display: maps.display
    })
    updateCount += 1

    if (!focus) {
      const rowIndex = resolveExistingRowIndexForDomRow(domRowIndex, selectedRowModels)
      if (rowIndex !== null) focus = { type: 'existing', rowIndex }
    }
  }

  return { insertCount, updateCount, skippedUpdateCount, focus }
}
