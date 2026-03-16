import {
  COLUMN_DEFS,
  CSV_EXPORT_CHUNK_SIZE,
  CSV_EXPORT_TEST_DELAY_MS,
  CSV_EXPORT_YIELD_BUDGET_MS,
  REINDEX_DEBOUNCE_MS,
  ROW_HIDDEN_CLASS,
  USERS_TABLE_SELECTOR,
  createEmptyColumnFilters,
  createEmptyColumnIndexMap
} from './constants'
import { getUsersTable, isUsersContext } from './context'
import { buildRowIndex, getCellDisplayText } from './table'
import type { ColumnFilters, ExportUiState, IndexedUserRow, SecurityUsersFeature, UsersFilterUi } from './types'
import { createUsersFilterUi } from './ui'
import { csvEscape, downloadCsv, makeTimestamp, nextTick } from '../../../../shared/utils/export'

type FeatureState = {
  indexedRows: IndexedUserRow[]
  appliedColumnFilters: ColumnFilters
  columnIndexByKey: ReturnType<typeof createEmptyColumnIndexMap>
  activeTable: HTMLTableElement | null
  tableObserver: MutationObserver | null
  rootObserver: MutationObserver | null
  reindexDebounceTimer: number | null
  refreshDebounceTimer: number | null
  reflowRaf: number | null
  refreshIntervalId: number | null
  activeRunId: number
  suppressTableObserver: boolean
  isExportingCsv: boolean
  exportProgressProcessed: number
  exportProgressTotal: number
  isMounted: boolean
}

function getNow(): number {
  return window.performance?.now ? window.performance.now() : Date.now()
}

export function createSecurityUsersFeature(): SecurityUsersFeature {
  const state: FeatureState = {
    indexedRows: [],
    appliedColumnFilters: createEmptyColumnFilters(),
    columnIndexByKey: createEmptyColumnIndexMap(),
    activeTable: null,
    tableObserver: null,
    rootObserver: null,
    reindexDebounceTimer: null,
    refreshDebounceTimer: null,
    reflowRaf: null,
    refreshIntervalId: null,
    activeRunId: 0,
    suppressTableObserver: false,
    isExportingCsv: false,
    exportProgressProcessed: 0,
    exportProgressTotal: 0,
    isMounted: false
  }

  function getVisibleRowMeta(): IndexedUserRow[] {
    return state.indexedRows.filter((meta) => meta.visible && meta.row.isConnected)
  }

  function getExportUiState(): ExportUiState {
    return {
      isExporting: state.isExportingCsv,
      processed: state.exportProgressProcessed,
      total: state.exportProgressTotal
    }
  }

  function areColumnFiltersEqual(left: ColumnFilters, right: ColumnFilters): boolean {
    return COLUMN_DEFS.every((definition) => left[definition.key] === right[definition.key])
  }

  function hasAppliedFilters(): boolean {
    return ui.hasColumnFilter(state.appliedColumnFilters)
  }

  function isDraftDirty(): boolean {
    const draftFilters = ui.readColumnFilters()
    return !areColumnFiltersEqual(draftFilters, state.appliedColumnFilters)
  }

  function applyDraftFilters(): void {
    state.appliedColumnFilters = ui.readColumnFilters()
    runFilter()
    ui.syncActionButtons()
  }

  function clearFilters(): void {
    state.appliedColumnFilters = createEmptyColumnFilters()
    runFilter()
    ui.syncActionButtons()
  }

  let ui: UsersFilterUi = createUsersFilterUi({
    onDraftChanged: () => {
      ui.syncActionButtons()
    },
    onApplyFilters: applyDraftFilters,
    onClearFilters: clearFilters,
    onExportClick: () => {
      void exportVisibleRowsToCsv()
    },
    getVisibleRowCount: () => getVisibleRowMeta().length,
    isDraftDirty,
    hasAppliedFilters
  })

  function stopReindexDebounce(): void {
    if (state.reindexDebounceTimer === null) return
    window.clearTimeout(state.reindexDebounceTimer)
    state.reindexDebounceTimer = null
  }

  function stopRefreshDebounce(): void {
    if (state.refreshDebounceTimer === null) return
    window.clearTimeout(state.refreshDebounceTimer)
    state.refreshDebounceTimer = null
  }

  function stopReflowRaf(): void {
    if (state.reflowRaf === null) return
    window.cancelAnimationFrame(state.reflowRaf)
    state.reflowRaf = null
  }

  function stopTableObserver(): void {
    if (!state.tableObserver) return
    state.tableObserver.disconnect()
    state.tableObserver = null
  }

  function stopRootObserver(): void {
    if (!state.rootObserver) return
    state.rootObserver.disconnect()
    state.rootObserver = null
  }

  function updateExportUi(visibleCount?: number): void {
    ui.updateExportUi(getExportUiState(), visibleCount)
  }

  function scheduleRefreshAttachment(delayMs: number): void {
    stopRefreshDebounce()
    state.refreshDebounceTimer = window.setTimeout(() => {
      state.refreshDebounceTimer = null
      refreshAttachment()
    }, Math.max(0, delayMs))
  }

  function applyRowVisibility(nextVisibility: boolean[], runId: number, hasFilter: boolean): void {
    if (runId !== state.activeRunId) return
    if (nextVisibility.length !== state.indexedRows.length) return

    let visibleCount = 0
    state.suppressTableObserver = true

    for (let index = 0; index < state.indexedRows.length; index += 1) {
      const meta = state.indexedRows[index]
      const nextVisible = nextVisibility[index]
      if (nextVisible) visibleCount += 1
      if (meta.visible === nextVisible) continue

      meta.visible = nextVisible
      meta.row.classList.toggle(ROW_HIDDEN_CLASS, !nextVisible)
    }

    state.suppressTableObserver = false
    ui.setResultCount(visibleCount, state.indexedRows.length, hasFilter)
    updateExportUi(visibleCount)
  }

  /**
   * Two-stage filter pipeline:
   * 1) compute matches in memory
   * 2) apply DOM diffs in a single animation frame
   */
  function runFilter(): void {
    const runId = ++state.activeRunId
    const appliedFilters = state.appliedColumnFilters
    const hasFilter = ui.hasColumnFilter(appliedFilters)

    const nextVisibility = state.indexedRows.map((meta) => {
      if (hasFilter) {
        for (const definition of COLUMN_DEFS) {
          const filterValue = appliedFilters[definition.key]
          if (!filterValue) continue
          if (!(meta.columns[definition.key] || '').includes(filterValue)) return false
        }
      }

      return true
    })

    stopReflowRaf()
    state.reflowRaf = window.requestAnimationFrame(() => {
      state.reflowRaf = null
      applyRowVisibility(nextVisibility, runId, hasFilter)
    })
  }

  function rebuildIndexAndReapply(): void {
    if (!state.activeTable) return

    const next = buildRowIndex(state.activeTable)
    state.indexedRows = next.indexedRows
    state.columnIndexByKey = next.columnIndexByKey

    ui.refreshSelectOptions(state.indexedRows)
    runFilter()
  }

  function scheduleReindex(): void {
    stopReindexDebounce()
    state.reindexDebounceTimer = window.setTimeout(() => {
      state.reindexDebounceTimer = null
      rebuildIndexAndReapply()
    }, REINDEX_DEBOUNCE_MS)
  }

  function ensureTableObserver(table: HTMLTableElement): void {
    const tbody = table.tBodies?.[0]
    if (!tbody || state.tableObserver) return

    state.tableObserver = new MutationObserver(() => {
      if (state.suppressTableObserver) return
      scheduleReindex()
    })

    state.tableObserver.observe(tbody, {
      childList: true,
      subtree: true,
      characterData: true
    })
  }

  function detach(): void {
    stopReindexDebounce()
    stopReflowRaf()
    stopTableObserver()

    state.indexedRows = []
    state.appliedColumnFilters = createEmptyColumnFilters()
    state.columnIndexByKey = createEmptyColumnIndexMap()
    state.activeTable = null

    ui.remove()
  }

  function attach(table: HTMLTableElement): void {
    if (state.activeTable === table) {
      ui.ensureAttached()
      ensureTableObserver(table)
      updateExportUi()
      return
    }

    detach()
    state.activeTable = table

    ui.ensureAttached()
    ensureTableObserver(table)
    rebuildIndexAndReapply()
  }

  function refreshAttachment(): void {
    if (!isUsersContext()) {
      detach()
      return
    }

    const table = getUsersTable()
    if (!table) {
      detach()
      return
    }

    attach(table)
  }

  function ensureRootObserver(): void {
    if (state.rootObserver) return

    state.rootObserver = new MutationObserver(() => {
      const hasActiveTable = state.activeTable && document.contains(state.activeTable)
      if (!hasActiveTable) {
        scheduleRefreshAttachment(60)
        return
      }

      // In-table mutations are handled by table observer; only refresh when table/root is replaced.
      if (!document.querySelector(USERS_TABLE_SELECTOR)) {
        scheduleRefreshAttachment(60)
      }
    })

    state.rootObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    })
  }

  /**
   * Export only currently visible rows to CSV.
   *
   * Work is chunked so large datasets keep the UI responsive and
   * progress feedback can update during generation.
   */
  async function exportVisibleRowsToCsv(): Promise<void> {
    if (!state.activeTable || state.isExportingCsv) return

    const visibleRows = getVisibleRowMeta()
    if (visibleRows.length === 0) return

    state.isExportingCsv = true
    state.exportProgressProcessed = 0
    state.exportProgressTotal = visibleRows.length
    updateExportUi(visibleRows.length)

    const headers = COLUMN_DEFS.map((definition) => definition.label)

    try {
      await nextTick()

      const csvLines = new Array<string>(visibleRows.length + 1)
      csvLines[0] = headers.map(csvEscape).join(',')

      let startedAt = getNow()

      for (let rowIndex = 0; rowIndex < visibleRows.length; rowIndex += 1) {
        const row = visibleRows[rowIndex].row
        const cells = row.cells
        const values = new Array<string>(COLUMN_DEFS.length)

        for (let columnPosition = 0; columnPosition < COLUMN_DEFS.length; columnPosition += 1) {
          const definition = COLUMN_DEFS[columnPosition]
          const cellIndex = state.columnIndexByKey[definition.key]
          const cell = cellIndex >= 0 && cellIndex < cells.length ? (cells[cellIndex] as HTMLTableCellElement) : null
          values[columnPosition] = getCellDisplayText(cell, definition.key)
        }

        csvLines[rowIndex + 1] = values.map(csvEscape).join(',')

        if ((rowIndex + 1) % CSV_EXPORT_CHUNK_SIZE === 0) {
          state.exportProgressProcessed = rowIndex + 1
          updateExportUi(visibleRows.length)

          if (CSV_EXPORT_TEST_DELAY_MS > 0) {
            await new Promise<void>((resolve) => {
              window.setTimeout(resolve, CSV_EXPORT_TEST_DELAY_MS)
            })
          }

          const now = getNow()
          if (now - startedAt >= CSV_EXPORT_YIELD_BUDGET_MS) {
            await nextTick()
            startedAt = now
          }
        }
      }

      state.exportProgressProcessed = visibleRows.length
      updateExportUi(visibleRows.length)

      const csvContent = csvLines.join('\r\n')
      downloadCsv(`users-${makeTimestamp()}.csv`, csvContent)
    } finally {
      state.isExportingCsv = false
      state.exportProgressProcessed = 0
      state.exportProgressTotal = 0
      updateExportUi()
    }
  }

  const onHashOrPopState = (): void => {
    scheduleRefreshAttachment(0)
  }

  function mount(): void {
    ui.ensureAttached()
    ensureRootObserver()
    refreshAttachment()

    if (!state.isMounted) {
      state.isMounted = true
      window.addEventListener('hashchange', onHashOrPopState)
      window.addEventListener('popstate', onHashOrPopState)

      state.refreshIntervalId = window.setInterval(() => {
        if (!state.activeTable || !document.contains(state.activeTable)) {
          scheduleRefreshAttachment(0)
        }
      }, 1500)
    }
  }

  function unmount(): void {
    if (state.isMounted) {
      state.isMounted = false
      window.removeEventListener('hashchange', onHashOrPopState)
      window.removeEventListener('popstate', onHashOrPopState)
    }

    if (state.refreshIntervalId !== null) {
      window.clearInterval(state.refreshIntervalId)
      state.refreshIntervalId = null
    }

    stopRefreshDebounce()
    stopRootObserver()
    detach()
  }

  return {
    mount,
    unmount
  }
}

export const createUsersFilterFeature = createSecurityUsersFeature

