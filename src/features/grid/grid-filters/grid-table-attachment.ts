import {
  GRID_EXPORT_BUTTON_ID,
  GRID_IMPORT_BUTTON_ID,
  GRID_FILTER_TOGGLE_BUTTON_ID,
  GRID_MASTER_TABLE_SELECTOR,
  REFRESH_DEBOUNCE_MS,
  REINDEX_DEBOUNCE_MS
} from './constants'
import { isStrictGridPage } from '../grid-page/grid-page-context'
import { subscribeGridPageRootObserver } from '../grid-page/grid-page-root-observer'
import { getGridTable, isGridLoading } from '../grid-page/grid-table-index'

export type GridTableAttachmentPanelUi = {
  ensureToolbarButtons: () => void
  removeFilterExportButtons: () => void
  removePanel: () => void
  removeSummaryBar: () => void
  updateFilterToggleButtonState: () => void
}

export type GridTableAttachmentDeps = {
  isFilteringOn: () => boolean
  isExportOn: () => boolean
  isImportOn: () => boolean
  getActiveTable: () => HTMLTableElement | null
  setActiveTable: (table: HTMLTableElement | null) => void
  clearActiveColumns: () => void
  clearIndexedRows: () => void
  isSuppressingTableObserver: () => boolean
  onReindex: () => void
  onRebuildAndApply: () => void
  stopReflowRaf: () => void
  panelUi: GridTableAttachmentPanelUi
}

export type GridTableAttachment = {
  attach: (table: HTMLTableElement) => void
  detach: () => void
  refreshAttachment: () => void
  ensureRootObserver: () => void
  scheduleMetadataPoll: (delayMs: number) => void
  stopMetadataPoll: () => void
  stopRefreshDebounce: () => void
  stopRootObserver: () => void
}

export function createGridTableAttachment(deps: GridTableAttachmentDeps): GridTableAttachment {
  let tableObserver: MutationObserver | null = null
  let unsubscribeRootObserver: (() => void) | null = null
  let reindexDebounceTimer: number | null = null
  let refreshDebounceTimer: number | null = null
  let metadataPollTimer: number | null = null

  function stopReindexDebounce(): void {
    if (reindexDebounceTimer === null) return
    window.clearTimeout(reindexDebounceTimer)
    reindexDebounceTimer = null
  }

  function stopRefreshDebounce(): void {
    if (refreshDebounceTimer === null) return
    window.clearTimeout(refreshDebounceTimer)
    refreshDebounceTimer = null
  }

  function stopMetadataPoll(): void {
    if (metadataPollTimer === null) return
    window.clearTimeout(metadataPollTimer)
    metadataPollTimer = null
  }

  function stopTableObserver(): void {
    if (!tableObserver) return
    tableObserver.disconnect()
    tableObserver = null
  }

  function stopRootObserver(): void {
    if (!unsubscribeRootObserver) return
    unsubscribeRootObserver()
    unsubscribeRootObserver = null
  }

  function onRootDocumentMutation(): void {
    const activeTable = deps.getActiveTable()
    const hasActiveTable = activeTable && document.contains(activeTable)
    const hasMasterTable = Boolean(document.querySelector(GRID_MASTER_TABLE_SELECTOR))
    if (!hasActiveTable || !hasMasterTable) {
      scheduleRefreshAttachment(REFRESH_DEBOUNCE_MS)
      return
    }

    const needFilterToggle = deps.isFilteringOn()
    const needExportToggle = deps.isExportOn()
    const needImportToggle = deps.isImportOn()
    const hasFilterInDom = Boolean(document.getElementById(GRID_FILTER_TOGGLE_BUTTON_ID))
    const hasExportInDom = Boolean(document.getElementById(GRID_EXPORT_BUTTON_ID))
    const hasImportInDom = Boolean(document.getElementById(GRID_IMPORT_BUTTON_ID))

    if ((needFilterToggle && !hasFilterInDom) || (needExportToggle && !hasExportInDom) || (needImportToggle && !hasImportInDom)) {
      scheduleRefreshAttachment(REFRESH_DEBOUNCE_MS)
    }
  }

  function scheduleRefreshAttachment(delayMs: number): void {
    stopRefreshDebounce()
    refreshDebounceTimer = window.setTimeout(() => {
      refreshDebounceTimer = null
      refreshAttachment()
    }, Math.max(0, delayMs))
  }

  function scheduleMetadataPoll(delayMs: number): void {
    if (metadataPollTimer !== null) return
    metadataPollTimer = window.setTimeout(() => {
      metadataPollTimer = null
      deps.onRebuildAndApply()
    }, Math.max(200, delayMs))
  }

  function scheduleReindex(): void {
    stopReindexDebounce()
    reindexDebounceTimer = window.setTimeout(() => {
      reindexDebounceTimer = null
      deps.onReindex()
    }, REINDEX_DEBOUNCE_MS)
  }

  function ensureTableObserver(table: HTMLTableElement): void {
    if (tableObserver) return
    tableObserver = new MutationObserver(() => {
      if (deps.isSuppressingTableObserver()) return
      scheduleReindex()
    })
    tableObserver.observe(table, {
      childList: true,
      subtree: true
    })
  }

  function detach(): void {
    stopReindexDebounce()
    stopMetadataPoll()
    deps.stopReflowRaf()
    stopTableObserver()
    deps.clearActiveColumns()
    deps.clearIndexedRows()
    deps.setActiveTable(null)
    deps.panelUi.removePanel()
    deps.panelUi.removeSummaryBar()
    deps.panelUi.updateFilterToggleButtonState()
  }

  function attach(table: HTMLTableElement): void {
    const activeTable = deps.getActiveTable()
    if (activeTable === table) {
      ensureTableObserver(table)
      deps.onRebuildAndApply()
      return
    }

    detach()
    deps.setActiveTable(table)
    ensureTableObserver(table)
    deps.onRebuildAndApply()
  }

  function isGridPathOnly(urlString: string): boolean {
    try {
      const url = new URL(urlString)
      return /^\/plm\/workspaces\/\d+\/items\/grid$/i.test(url.pathname)
    } catch {
      return false
    }
  }

  function refreshAttachment(): void {
    if (!isStrictGridPage(window.location.href)) {
      // SPA transitions can temporarily strip query params while staying on the same grid path.
      // Avoid tearing down command-bar controls during this transient state.
      if (isGridPathOnly(window.location.href)) {
        deps.panelUi.ensureToolbarButtons()
        scheduleRefreshAttachment(REFRESH_DEBOUNCE_MS)
        return
      }
      detach()
      deps.panelUi.removeFilterExportButtons()
      return
    }

    const table = getGridTable()
    const loading = isGridLoading()

    // Keep command-bar buttons in sync even while Fusion temporarily detaches the table.
    deps.panelUi.ensureToolbarButtons()

    if (!table) {
      // Keep existing command-bar controls during transient table rebinds.
      scheduleRefreshAttachment(REFRESH_DEBOUNCE_MS)
      return
    }

    if (loading) {
      // Keep the last indexed table/columns while Fusion shows the spreadsheet loader.
      scheduleRefreshAttachment(REFRESH_DEBOUNCE_MS)
      return
    }

    attach(table)
  }

  function ensureRootObserver(): void {
    if (unsubscribeRootObserver) return
    unsubscribeRootObserver = subscribeGridPageRootObserver(onRootDocumentMutation)
  }

  return {
    attach,
    detach,
    refreshAttachment,
    ensureRootObserver,
    scheduleMetadataPoll,
    stopMetadataPoll,
    stopRefreshDebounce,
    stopRootObserver
  }
}
