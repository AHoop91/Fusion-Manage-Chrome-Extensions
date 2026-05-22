import { GRID_ROW_HIDDEN_CLASS } from './constants'
import type { ColumnFilterGroup } from './model'
import { ruleMatchesValue } from './filterEngine'
import { getActiveGroups } from './groupUtils'
import type { GridColumnDef, IndexedGridRow } from '../grid.types'

export type GridFilterRunnerPanelUi = {
  updateCount: (visibleCount: number, totalCount: number, hasFilter: boolean) => void
  updateActionButtons: () => void
  updateFilterToggleButtonState: () => void
}

export type GridFilterRunnerDeps = {
  isFilteringOn: () => boolean
  getActiveColumns: () => GridColumnDef[]
  getIndexedRows: () => IndexedGridRow[]
  getAppliedGroups: () => ColumnFilterGroup[]
  setAppliedGroups: (next: ColumnFilterGroup[]) => void
  getDraftGroups: () => ColumnFilterGroup[]
  setDraftGroups: (next: ColumnFilterGroup[]) => void
  setPanelVisible: (next: boolean) => void
  normalizeGroupsForColumns: (groups: ColumnFilterGroup[]) => ColumnFilterGroup[]
  panelUi: GridFilterRunnerPanelUi
}

export type GridFilterRunner = {
  runFilter: () => void
  stopReflowRaf: () => void
  isSuppressingTableObserver: () => boolean
}

export function createGridFilterRunner(deps: GridFilterRunnerDeps): GridFilterRunner {
  let activeRunId = 0
  let reflowRaf: number | null = null
  let suppressTableObserver = false

  function stopReflowRaf(): void {
    if (reflowRaf === null) return
    window.cancelAnimationFrame(reflowRaf)
    reflowRaf = null
  }

  function applyRowVisibility(nextVisibility: boolean[], runId: number, hasFilter: boolean): void {
    if (runId !== activeRunId) return
    const indexedRows = deps.getIndexedRows()
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

    deps.panelUi.updateCount(visibleCount, indexedRows.length, hasFilter)
    deps.panelUi.updateActionButtons()
    deps.panelUi.updateFilterToggleButtonState()
  }

  function runFilter(): void {
    if (!deps.isFilteringOn()) {
      deps.setAppliedGroups([])
      deps.setDraftGroups([])
      deps.setPanelVisible(false)
    }
    const appliedGroups = deps.normalizeGroupsForColumns(deps.getAppliedGroups())
    deps.setAppliedGroups(appliedGroups)
    const activeAppliedGroups = getActiveGroups(appliedGroups)
    const hasFilter = activeAppliedGroups.length > 0
    const runId = ++activeRunId

    const activeColumns = deps.getActiveColumns()
    const indexedRows = deps.getIndexedRows()
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

  return {
    runFilter,
    stopReflowRaf,
    isSuppressingTableObserver: () => suppressTableObserver
  }
}
