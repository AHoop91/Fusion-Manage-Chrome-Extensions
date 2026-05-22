import type { GridService } from '../grid-advanced-editor/services/gridService'

/**
 * Maps API row ids to advanced-editor `domRowIndex` values after grid rows are hydrated.
 */
export function buildDomRowIndexByRowId(gridService: GridService): Map<string, number> {
  const apiRows = gridService.buildApiRowProjections(gridService.getGridRowsPayloadForCurrentGrid())
  const models = gridService.buildApiRowModels(apiRows)
  const domRowIndexByRowId = new Map<string, number>()
  for (const model of models) {
    const rowId = String(model.apiRow?.rowId || '').trim()
    if (!rowId) continue
    domRowIndexByRowId.set(rowId, model.domRowIndex)
  }
  return domRowIndexByRowId
}
