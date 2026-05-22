import {
  CSV_EXPORT_CHUNK_SIZE,
  CSV_EXPORT_YIELD_BUDGET_MS
} from './constants'
import { csvEscape, downloadCsv, makeTimestamp, nextTick } from '../grid-export/export.service'
import type { ExportUiState } from '../grid-export/export.service'
import type { GridColumnDef, IndexedGridRow } from '../grid.types'

export type GridCsvExportRunnerPanelUi = {
  updateActionButtons: () => void
}

export type GridCsvExportRunnerDeps = {
  isExportOn: () => boolean
  getActiveColumns: () => GridColumnDef[]
  getVisibleRows: () => IndexedGridRow[]
  panelUi: GridCsvExportRunnerPanelUi
}

export type GridCsvExportRunner = {
  exportVisibleRowsToCsv: () => Promise<void>
  getExportUiState: () => ExportUiState
}

function getNow(): number {
  return window.performance?.now ? window.performance.now() : Date.now()
}

export function createGridCsvExportRunner(deps: GridCsvExportRunnerDeps): GridCsvExportRunner {
  let isExportingCsv = false
  let exportProgressProcessed = 0
  let exportProgressTotal = 0

  async function exportVisibleRowsToCsv(): Promise<void> {
    if (!deps.isExportOn()) return
    if (isExportingCsv) return

    const visibleRows = deps.getVisibleRows()
    const activeColumns = deps.getActiveColumns()
    if (activeColumns.length === 0 || visibleRows.length === 0) return

    isExportingCsv = true
    exportProgressProcessed = 0
    exportProgressTotal = visibleRows.length
    deps.panelUi.updateActionButtons()

    try {
      await nextTick()

      const csvLines = new Array(visibleRows.length + 1)
      csvLines[0] = activeColumns.map((column) => csvEscape(column.title)).join(',')
      let startedAt = getNow()

      for (let index = 0; index < visibleRows.length; index += 1) {
        const row = visibleRows[index]
        csvLines[index + 1] = activeColumns.map((_, columnIndex) => csvEscape(row.values[columnIndex] || '')).join(',')

        if ((index + 1) % CSV_EXPORT_CHUNK_SIZE === 0) {
          exportProgressProcessed = index + 1
          deps.panelUi.updateActionButtons()

          const now = getNow()
          if (now - startedAt >= CSV_EXPORT_YIELD_BUDGET_MS) {
            await nextTick()
            startedAt = now
          }
        }
      }

      exportProgressProcessed = visibleRows.length
      deps.panelUi.updateActionButtons()
      const filename = `grid-${makeTimestamp()}.csv`
      downloadCsv(filename, csvLines.join('\r\n'))
    } finally {
      isExportingCsv = false
      exportProgressProcessed = 0
      exportProgressTotal = 0
      deps.panelUi.updateActionButtons()
    }
  }

  return {
    exportVisibleRowsToCsv,
    getExportUiState: () => ({
      isExporting: isExportingCsv,
      processed: exportProgressProcessed,
      total: exportProgressTotal
    })
  }
}
