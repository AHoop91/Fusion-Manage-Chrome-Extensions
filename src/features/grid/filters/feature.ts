import {
  CSV_EXPORT_CHUNK_SIZE,
  CSV_EXPORT_YIELD_BUDGET_MS,
  GRID_FILTER_TOGGLE_BUTTON_ID,
  GRID_MASTER_TABLE_SELECTOR,
  GRID_ROW_HIDDEN_CLASS,
  REFRESH_DEBOUNCE_MS,
  REINDEX_DEBOUNCE_MS
} from './constants'
import type { ColumnCondition, ColumnFilterGroup } from './model'
import { getDefaultOperatorForKind, getOperatorsForKind, ruleMatchesValue } from './filterEngine'
import { getActiveGroups, sanitizeMode, serializeGroups } from './groupUtils'
import { buildColumns, buildRowIndex, getGridTable, hasApiMetadataForCurrentGrid, isGridLoading, isStrictGridPage } from './data'
import { csvEscape, downloadCsv, makeTimestamp, nextTick } from '../export/export.service'
import { createGridPanelUi } from './panel'
import type { GridColumnDef, GridColumnKind, IndexedGridRow } from '../grid.types'

export type GridFiltersFeature = {
  mount: () => void
  update: () => void
  unmount: () => void
}

/**
 * Grid page behavior coordinator.
 *
 * Owns:
 * - lifecycle attach/detach
 * - observer/timer management
 * - filtering pipeline state
 */
export function createGridFiltersFeature(): GridFiltersFeature {
  const NAV_EVENT = 'plm-extension-location-change'
  let activeTable: HTMLTableElement | null = null
  let activeColumns: GridColumnDef[] = []
  let indexedRows: IndexedGridRow[] = []

  let draftGroups: ColumnFilterGroup[] = []
  let appliedGroups: ColumnFilterGroup[] = []

  let tableObserver: MutationObserver | null = null
  let rootObserver: MutationObserver | null = null

  let reindexDebounceTimer: number | null = null
  let refreshDebounceTimer: number | null = null
  let metadataPollTimer: number | null = null
  let reflowRaf: number | null = null

  let activeRunId = 0
  let suppressTableObserver = false
  let panelVisible = false
  let isExportingCsv = false
  let exportProgressProcessed = 0
  let exportProgressTotal = 0
  let groupIdSeed = 0
  let conditionIdSeed = 0
  let isMounted = false
  let lastUrl = window.location.href

  function getNow(): number {
    return window.performance?.now ? window.performance.now() : Date.now()
  }

  function findColumnByKey(columnKey: string): GridColumnDef | null {
    return activeColumns.find((column) => column.key === columnKey) || null
  }

  function getColumnKind(columnKey: string): GridColumnKind {
    return findColumnByKey(columnKey)?.kind || 'text'
  }

  function getColumnOperators(columnKey: string) {
    return getOperatorsForKind(getColumnKind(columnKey))
  }

  function getSelectedColumnKeys(excludeGroupId?: string): Set<string> {
    const selected = new Set<string>()
    for (const group of draftGroups) {
      if (excludeGroupId && group.id === excludeGroupId) continue
      if (group.columnKey) selected.add(group.columnKey)
    }
    return selected
  }

  function ensureConditionOperator(condition: ColumnCondition, columnKey: string): void {
    const available = getColumnOperators(columnKey)
    if (!available.some((item) => item.value === condition.operator)) {
      condition.operator = getDefaultOperatorForKind(getColumnKind(columnKey))
      condition.value = ''
      condition.valueTo = ''
    }
  }

  function createCondition(columnKey: string): ColumnCondition {
    conditionIdSeed += 1
    const kind = getColumnKind(columnKey)
    return {
      id: `cond_${conditionIdSeed}`,
      operator: getDefaultOperatorForKind(kind),
      value: '',
      valueTo: ''
    }
  }

  function createGroup(initialColumnKey?: string): ColumnFilterGroup {
    groupIdSeed += 1
    const columnKey = initialColumnKey || activeColumns[0]?.key || ''
    return {
      id: `grp_${groupIdSeed}`,
      columnKey,
      mode: 'or',
      conditions: [createCondition(columnKey)]
    }
  }

  function normalizeGroupsForColumns(groups: ColumnFilterGroup[]): ColumnFilterGroup[] {
    if (activeColumns.length === 0) return []
    const validColumns = new Set(activeColumns.map((column) => column.key))
    const fallbackColumn = activeColumns[0].key

    return groups
      .map((group) => {
        const normalizedColumnKey = validColumns.has(group.columnKey) ? group.columnKey : fallbackColumn
        return {
          ...group,
          columnKey: normalizedColumnKey,
          mode: sanitizeMode(group.mode),
          conditions: group.conditions.filter(Boolean).map((condition) => {
            const nextCondition: ColumnCondition = {
              id: condition.id,
              operator: condition.operator,
              value: condition.value,
              valueTo: condition.valueTo || ''
            }
            ensureConditionOperator(nextCondition, normalizedColumnKey)
            return nextCondition
          })
        }
      })
      .filter((group) => group.conditions.length > 0)
  }

  function getAppliedActiveGroups(): ColumnFilterGroup[] {
    return getActiveGroups(normalizeGroupsForColumns(appliedGroups))
  }

  function isDraftDirty(): boolean {
    const normalizedDraft = normalizeGroupsForColumns(draftGroups)
    const normalizedApplied = normalizeGroupsForColumns(appliedGroups)
    return serializeGroups(normalizedDraft) !== serializeGroups(normalizedApplied)
  }

  function getVisibleRows(): IndexedGridRow[] {
    return indexedRows.filter((row) => row.visible && row.row.isConnected)
  }

  async function exportVisibleRowsToCsv(): Promise<void> {
    if (isExportingCsv) return

    const visibleRows = getVisibleRows()
    if (activeColumns.length === 0 || visibleRows.length === 0) return

    isExportingCsv = true
    exportProgressProcessed = 0
    exportProgressTotal = visibleRows.length
    panelUi.updateActionButtons()

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
          panelUi.updateActionButtons()

          const now = getNow()
          if (now - startedAt >= CSV_EXPORT_YIELD_BUDGET_MS) {
            await nextTick()
            startedAt = now
          }
        }
      }

      exportProgressProcessed = visibleRows.length
      panelUi.updateActionButtons()
      const filename = `grid-${makeTimestamp()}.csv`
      downloadCsv(filename, csvLines.join('\r\n'))
    } finally {
      isExportingCsv = false
      exportProgressProcessed = 0
      exportProgressTotal = 0
      panelUi.updateActionButtons()
    }
  }

  const panelUi = createGridPanelUi({
    getActiveTable: () => activeTable,
    getActiveColumns: () => activeColumns,
    getDraftGroups: () => draftGroups,
    setDraftGroups: (next) => {
      draftGroups = next
    },
    getAppliedGroups: () => appliedGroups,
    setAppliedGroups: (next) => {
      appliedGroups = next
    },
    getPanelVisible: () => panelVisible,
    setPanelVisible: (next) => {
      panelVisible = next
    },
    getAppliedActiveGroups,
    isDraftDirty,
    normalizeGroupsForColumns,
    createGroup,
    createCondition,
    ensureConditionOperator,
    getSelectedColumnKeys,
    findColumnByKey,
    getColumnOperators,
    runFilter,
    hasApiMetadataForCurrentGrid,
    getVisibleRowCount: () => getVisibleRows().length,
    getTotalRowCount: () => indexedRows.length,
    getExportUiState: () => ({
      isExporting: isExportingCsv,
      processed: exportProgressProcessed,
      total: exportProgressTotal
    }),
    onExportCsv: () => {
      void exportVisibleRowsToCsv()
    }
  })

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

  function stopReflowRaf(): void {
    if (reflowRaf === null) return
    window.cancelAnimationFrame(reflowRaf)
    reflowRaf = null
  }

  function stopTableObserver(): void {
    if (!tableObserver) return
    tableObserver.disconnect()
    tableObserver = null
  }

  function stopRootObserver(): void {
    if (!rootObserver) return
    rootObserver.disconnect()
    rootObserver = null
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
      rebuildAndApply()
    }, Math.max(200, delayMs))
  }

  function applyRowVisibility(nextVisibility: boolean[], runId: number, hasFilter: boolean): void {
    if (runId !== activeRunId) return
    if (nextVisibility.length !== indexedRows.length) return

    let visibleCount = 0
    suppressTableObserver = true
    for (let index = 0; index < indexedRows.length; index += 1) {
      const meta = indexedRows[index]
      const nextVisible = nextVisibility[index]
      if (nextVisible) visibleCount += 1
      if (meta.visible === nextVisible) continue
      meta.visible = nextVisible
      meta.row.classList.toggle(GRID_ROW_HIDDEN_CLASS, !nextVisible)
    }
    suppressTableObserver = false

    panelUi.updateCount(visibleCount, indexedRows.length, hasFilter)
    panelUi.updateActionButtons()
    panelUi.updateFilterToggleButtonState()
  }

  function runFilter(): void {
    appliedGroups = normalizeGroupsForColumns(appliedGroups)
    const activeAppliedGroups = getActiveGroups(appliedGroups)
    const hasFilter = activeAppliedGroups.length > 0
    const runId = ++activeRunId

    const columnIndexByKey = new Map<string, number>()
    for (let index = 0; index < activeColumns.length; index += 1) {
      columnIndexByKey.set(activeColumns[index].key, index)
    }

    const nextVisibility = indexedRows.map((meta) => {
      if (!hasFilter) return true

      for (const group of activeAppliedGroups) {
        const columnIndex = columnIndexByKey.get(group.columnKey)
        if (columnIndex === undefined) continue

        const value = meta.values[columnIndex] || ''
        const columnKind = activeColumns[columnIndex]?.kind || 'text'
        if (group.mode === 'or') {
          let anyMatch = false
          for (const condition of group.conditions) {
            if (ruleMatchesValue(value, condition, columnKind)) {
              anyMatch = true
              break
            }
          }
          if (!anyMatch) return false
          continue
        }

        for (const condition of group.conditions) {
          if (!ruleMatchesValue(value, condition, columnKind)) return false
        }
      }

      return true
    })

    stopReflowRaf()
    reflowRaf = window.requestAnimationFrame(() => {
      reflowRaf = null
      applyRowVisibility(nextVisibility, runId, hasFilter)
    })
  }

  function rebuildAndApply(): void {
    if (!activeTable) return
    if (!panelUi.ensurePanel(activeTable)) return

    activeColumns = buildColumns(activeTable)
    if (activeColumns.length === 0) {
      scheduleMetadataPoll(700)
    } else {
      stopMetadataPoll()
    }

    draftGroups = normalizeGroupsForColumns(draftGroups)
    appliedGroups = normalizeGroupsForColumns(appliedGroups)
    indexedRows = buildRowIndex(activeTable, activeColumns)

    // Keep the toggle mounted to avoid command-bar flicker while metadata/table stabilizes.
    panelUi.ensureFilterToggleButton()

    panelUi.renderRuleBuilder()
    runFilter()
    panelUi.updateActionButtons()
    panelUi.updateFilterToggleButtonState()
  }

  function scheduleReindex(): void {
    stopReindexDebounce()
    reindexDebounceTimer = window.setTimeout(() => {
      reindexDebounceTimer = null
      rebuildAndApply()
    }, REINDEX_DEBOUNCE_MS)
  }

  function ensureTableObserver(table: HTMLTableElement): void {
    if (tableObserver) return
    tableObserver = new MutationObserver(() => {
      if (suppressTableObserver) return
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
    stopReflowRaf()
    stopTableObserver()
    activeColumns = []
    indexedRows = []
    activeTable = null
    panelUi.removePanel()
    panelUi.removeSummaryBar()
    panelUi.updateFilterToggleButtonState()
  }

  function attach(table: HTMLTableElement): void {
    if (activeTable === table) {
      panelUi.ensurePanel(table)
      ensureTableObserver(table)
      panelUi.updateFilterToggleButtonState()
      return
    }

    detach()
    activeTable = table
    panelUi.ensurePanel(table)
    ensureTableObserver(table)
    rebuildAndApply()
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
        scheduleRefreshAttachment(REFRESH_DEBOUNCE_MS)
        return
      }
      detach()
      panelUi.removeFilterToggleButton()
      return
    }

    const table = getGridTable()
    const loading = isGridLoading()

    if (!table) {
      // Keep existing command-bar controls during transient table rebinds.
      scheduleRefreshAttachment(REFRESH_DEBOUNCE_MS)
      return
    }

    // Keep command-bar controls mounted once the table exists.
    // Some refresh paths can report loading longer than expected.
    panelUi.ensureFilterToggleButton()

    if (loading) {
      detach()
      scheduleRefreshAttachment(REFRESH_DEBOUNCE_MS)
      return
    }

    attach(table)
  }

  function ensureRootObserver(): void {
    if (rootObserver) return

    rootObserver = new MutationObserver(() => {
      const hasToggleButton = document.getElementById(GRID_FILTER_TOGGLE_BUTTON_ID)
      const hasActiveTable = activeTable && document.contains(activeTable)
      if (!hasToggleButton || !hasActiveTable || !document.querySelector(GRID_MASTER_TABLE_SELECTOR)) {
        scheduleRefreshAttachment(REFRESH_DEBOUNCE_MS)
      }
    })

    rootObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    })
  }

  function cleanup(): void {
    if (isMounted) {
      isMounted = false
      window.removeEventListener(NAV_EVENT, onUrlMaybeChanged)
      window.removeEventListener('hashchange', onUrlMaybeChanged)
      window.removeEventListener('popstate', onUrlMaybeChanged)
    }
    stopRefreshDebounce()
    stopMetadataPoll()
    stopRootObserver()
    draftGroups = []
    appliedGroups = []
    panelVisible = false
    detach()
    panelUi.removeFilterToggleButton()
  }

  function onUrlMaybeChanged(): void {
    const currentUrl = window.location.href
    if (currentUrl === lastUrl) return
    lastUrl = currentUrl
    refreshAttachment()
  }

  function mount(): void {
    if (!isMounted) {
      isMounted = true
      lastUrl = window.location.href
      window.addEventListener(NAV_EVENT, onUrlMaybeChanged)
      window.addEventListener('hashchange', onUrlMaybeChanged)
      window.addEventListener('popstate', onUrlMaybeChanged)
    }
    ensureRootObserver()
    refreshAttachment()
  }

  function update(): void {
    ensureRootObserver()
    refreshAttachment()
  }

  return {
    mount,
    update,
    unmount: cleanup
  }
}
