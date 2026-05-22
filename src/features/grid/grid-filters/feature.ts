import type { ColumnCondition, ColumnFilterGroup } from './model'
import { getDefaultOperatorForKind, getOperatorsForKind } from './filterEngine'
import { getActiveGroups, sanitizeMode, serializeGroups } from './groupUtils'
import { buildColumns, hasApiMetadataForCurrentGrid } from './data'
import { hydrateGridFieldsForCurrentContext } from '../grid-services/gridApiMetadata'
import { buildRowIndex } from '../grid-page/grid-table-index'
import { createGridPanelUi } from './panel'
import type { GridColumnDef, GridColumnKind, IndexedGridRow } from '../grid.types'
import { createGridFilterRunner, type GridFilterRunner } from './grid-filter-runner'
import { createGridCsvExportRunner, type GridCsvExportRunner } from './grid-csv-export-runner'
import { createGridTableAttachment, type GridTableAttachment } from './grid-table-attachment'

export type CreateGridFiltersFeatureOptions = {
  getToolbarFlags: () => { enableFiltering: boolean; enableCsvExport: boolean; enableGridImport: boolean; enableAdvancedEditor: boolean }
  onImportCsv: () => void
}

export type GridFiltersFeature = {
  mount: () => void
  update: () => void
  unmount: () => void
}

/**
 * Grid page behavior coordinator.
 *
 * Composes table attachment, filter runner, CSV export, and panel UI.
 */
export function createGridFiltersFeature(options: CreateGridFiltersFeatureOptions): GridFiltersFeature {
  function isFilteringOn(): boolean {
    return options.getToolbarFlags().enableFiltering
  }

  function isExportOn(): boolean {
    return options.getToolbarFlags().enableCsvExport
  }

  function isImportOn(): boolean {
    return options.getToolbarFlags().enableGridImport
  }

  const NAV_EVENT = 'plm-extension-location-change'
  let activeTable: HTMLTableElement | null = null
  let activeColumns: GridColumnDef[] = []
  let indexedRows: IndexedGridRow[] = []

  let draftGroups: ColumnFilterGroup[] = []
  let appliedGroups: ColumnFilterGroup[] = []

  let panelVisible = false
  let groupIdSeed = 0
  let conditionIdSeed = 0
  let isMounted = false
  let lastUrl = window.location.href
  let lastFilterExportShellKey: 'exportOnly' | 'full' | null = null

  let filterRunner!: GridFilterRunner
  let csvExportRunner!: GridCsvExportRunner
  let tableAttachment!: GridTableAttachment

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

  async function rebuildAndApply(): Promise<void> {
    if (!activeTable) return
    const panelReady = panelUi.ensurePanel(activeTable)
    if (!panelReady && (isFilteringOn() || isExportOn())) return

    activeColumns = buildColumns(activeTable)
    if (activeColumns.length === 0) {
      await hydrateGridFieldsForCurrentContext()
      activeColumns = buildColumns(activeTable)
      panelUi.ensureToolbarButtons()
      if (activeColumns.length === 0) {
        tableAttachment.scheduleMetadataPoll(700)
      } else {
        tableAttachment.stopMetadataPoll()
      }
    } else {
      tableAttachment.stopMetadataPoll()
    }

    draftGroups = normalizeGroupsForColumns(draftGroups)
    appliedGroups = normalizeGroupsForColumns(appliedGroups)
    indexedRows = buildRowIndex(activeTable, activeColumns)

    panelUi.ensureToolbarButtons()

    if (isFilteringOn()) {
      panelUi.renderRuleBuilder()
    }
    filterRunner.runFilter()
    panelUi.updateActionButtons()
    panelUi.updateFilterToggleButtonState()
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
    runFilter: () => filterRunner.runFilter(),
    hasApiMetadataForCurrentGrid,
    getVisibleRowCount: () => getVisibleRows().length,
    getTotalRowCount: () => indexedRows.length,
    getExportUiState: () => csvExportRunner.getExportUiState(),
    getToolbarFlags: options.getToolbarFlags,
    onExportCsv: () => {
      if (!isExportOn()) return
      void csvExportRunner.exportVisibleRowsToCsv()
    },
    onImportCsv: options.onImportCsv
  })

  filterRunner = createGridFilterRunner({
    isFilteringOn,
    getActiveColumns: () => activeColumns,
    getIndexedRows: () => indexedRows,
    getAppliedGroups: () => appliedGroups,
    setAppliedGroups: (next) => {
      appliedGroups = next
    },
    getDraftGroups: () => draftGroups,
    setDraftGroups: (next) => {
      draftGroups = next
    },
    setPanelVisible: (next) => {
      panelVisible = next
    },
    normalizeGroupsForColumns,
    panelUi
  })

  csvExportRunner = createGridCsvExportRunner({
    isExportOn,
    getActiveColumns: () => activeColumns,
    getVisibleRows,
    panelUi
  })

  tableAttachment = createGridTableAttachment({
    isFilteringOn,
    isExportOn,
    isImportOn,
    getActiveTable: () => activeTable,
    setActiveTable: (table) => {
      activeTable = table
    },
    clearActiveColumns: () => {
      activeColumns = []
    },
    clearIndexedRows: () => {
      indexedRows = []
    },
    isSuppressingTableObserver: () => filterRunner.isSuppressingTableObserver(),
    onReindex: rebuildAndApply,
    onRebuildAndApply: rebuildAndApply,
    stopReflowRaf: () => filterRunner.stopReflowRaf(),
    panelUi
  })

  function filterExportShellKey(): 'exportOnly' | 'full' {
    return isFilteringOn() ? 'full' : 'exportOnly'
  }

  function reconcileFilterExportShell(): void {
    if (!isFilteringOn() && !isExportOn() && !isImportOn()) return
    const next = filterExportShellKey()
    if (lastFilterExportShellKey === null) {
      lastFilterExportShellKey = next
      return
    }
    if (next === lastFilterExportShellKey) return
    lastFilterExportShellKey = next
    draftGroups = []
    appliedGroups = []
    panelVisible = false
    panelUi.removeFilterExportButtons()
    tableAttachment.detach()
  }

  function cleanup(): void {
    if (isMounted) {
      isMounted = false
      window.removeEventListener(NAV_EVENT, onUrlMaybeChanged)
      window.removeEventListener('hashchange', onUrlMaybeChanged)
      window.removeEventListener('popstate', onUrlMaybeChanged)
    }
    tableAttachment.stopRefreshDebounce()
    tableAttachment.stopMetadataPoll()
    tableAttachment.stopRootObserver()
    draftGroups = []
    appliedGroups = []
    panelVisible = false
    lastFilterExportShellKey = null
    tableAttachment.detach()
    panelUi.removeFilterExportButtons()
  }

  function onUrlMaybeChanged(): void {
    const currentUrl = window.location.href
    if (currentUrl === lastUrl) return
    lastUrl = currentUrl
    tableAttachment.refreshAttachment()
  }

  function mount(): void {
    if (!isMounted) {
      isMounted = true
      lastUrl = window.location.href
      window.addEventListener(NAV_EVENT, onUrlMaybeChanged)
      window.addEventListener('hashchange', onUrlMaybeChanged)
      window.addEventListener('popstate', onUrlMaybeChanged)
    }
    // Toolbar buttons can render while the grid is still loading; prime styles before first paint.
    panelUi.ensureToolbarButtons()
    tableAttachment.ensureRootObserver()
    tableAttachment.refreshAttachment()
    if (lastFilterExportShellKey === null) {
      lastFilterExportShellKey = filterExportShellKey()
    }
  }

  function update(): void {
    reconcileFilterExportShell()
    tableAttachment.ensureRootObserver()
    tableAttachment.refreshAttachment()
  }

  return {
    mount,
    update,
    unmount: cleanup
  }
}
