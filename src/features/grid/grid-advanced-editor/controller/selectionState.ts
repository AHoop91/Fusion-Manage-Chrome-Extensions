import type { SelectedRowModel } from '../types'

/**
 * Selection state summary exposed to controller and action handlers.
 */
export interface SelectionSummary {
  existingRowIndexes: number[]
  insertIndexes: number[]
  existingCount: number
  insertCount: number
  count: number
}

/**
 * Selection manager contract owning all modal row selection behavior.
 */
export interface SelectionManager {
  initializeFromSelectedRows: (
    selectedRows: HTMLTableRowElement[],
    selectedRowModels: SelectedRowModel[],
    sourceRows: HTMLTableRowElement[]
  ) => number | null
  selectRow: (rowIndex: number) => void
  deselectRow: (rowIndex: number) => void
  toggleRow: (rowIndex: number, checked: boolean) => void
  selectInsert: (insertIndex: number) => void
  deselectInsert: (insertIndex: number) => void
  toggleInsert: (insertIndex: number, checked: boolean) => void
  selectAll: (existingCount: number, insertCount: number) => void
  clearSelection: () => void
  shiftInsertSelectionAfterRemoval: (removedInsertIndexes: number[]) => void
  getSelectionSummary: () => SelectionSummary
  hasSelection: () => boolean
  selectionCountText: () => string
}

/**
 * Creates a selection manager with private row and insert selections.
 */
export function createSelectionManager(): SelectionManager {
  const selectedExistingRowIndexes = new Set<number>()
  const selectedInsertIndexes = new Set<number>()

  function initializeFromSelectedRows(
    selectedRows: HTMLTableRowElement[],
    selectedRowModels: SelectedRowModel[],
    sourceRows: HTMLTableRowElement[]
  ): number | null {
    selectedExistingRowIndexes.clear()
    selectedInsertIndexes.clear()

    if (selectedRows.length > 0 && selectedRowModels.length > 0) {
      const selectedRowSet = new Set<HTMLTableRowElement>(selectedRows)
      for (let index = 0; index < selectedRowModels.length; index += 1) {
        if (selectedRowSet.has(selectedRowModels[index].domRow)) selectedExistingRowIndexes.add(index)
      }
    }

    if (selectedRows.length > 0 && sourceRows.length > 0) {
      const firstSelectedIndex = sourceRows.indexOf(selectedRows[0])
      if (firstSelectedIndex >= 0) return firstSelectedIndex
    }
    return null
  }

  function selectRow(rowIndex: number): void {
    selectedExistingRowIndexes.add(rowIndex)
  }

  function deselectRow(rowIndex: number): void {
    selectedExistingRowIndexes.delete(rowIndex)
  }

  function toggleRow(rowIndex: number, checked: boolean): void {
    if (checked) selectRow(rowIndex)
    else deselectRow(rowIndex)
  }

  function selectInsert(insertIndex: number): void {
    selectedInsertIndexes.add(insertIndex)
  }

  function deselectInsert(insertIndex: number): void {
    selectedInsertIndexes.delete(insertIndex)
  }

  function toggleInsert(insertIndex: number, checked: boolean): void {
    if (checked) selectInsert(insertIndex)
    else deselectInsert(insertIndex)
  }

  function selectAll(existingCount: number, insertCount: number): void {
    selectedExistingRowIndexes.clear()
    selectedInsertIndexes.clear()
    for (let index = 0; index < existingCount; index += 1) selectedExistingRowIndexes.add(index)
    for (let index = 0; index < insertCount; index += 1) selectedInsertIndexes.add(index)
  }

  function clearSelection(): void {
    selectedExistingRowIndexes.clear()
    selectedInsertIndexes.clear()
  }

  function shiftInsertSelectionAfterRemoval(removedInsertIndexes: number[]): void {
    if (removedInsertIndexes.length === 0) return
    const sortedRemoved = [...removedInsertIndexes].sort((a, b) => a - b)
    const nextSelected = new Set<number>()
    for (const index of selectedInsertIndexes.values()) {
      if (sortedRemoved.includes(index)) continue
      const shift = sortedRemoved.filter((removedIndex) => removedIndex < index).length
      nextSelected.add(index - shift)
    }
    selectedInsertIndexes.clear()
    for (const index of nextSelected.values()) selectedInsertIndexes.add(index)
  }

  function getSelectionSummary(): SelectionSummary {
    const existingRowIndexes = Array.from(selectedExistingRowIndexes.values()).sort((a, b) => a - b)
    const insertIndexes = Array.from(selectedInsertIndexes.values()).sort((a, b) => a - b)
    const existingCount = existingRowIndexes.length
    const insertCount = insertIndexes.length
    return {
      existingRowIndexes,
      insertIndexes,
      existingCount,
      insertCount,
      count: existingCount + insertCount
    }
  }

  function hasSelection(): boolean {
    return selectedExistingRowIndexes.size > 0 || selectedInsertIndexes.size > 0
  }

  function selectionCountText(): string {
    return `${getSelectionSummary().count} selected`
  }

  return {
    initializeFromSelectedRows,
    selectRow,
    deselectRow,
    toggleRow,
    selectInsert,
    deselectInsert,
    toggleInsert,
    selectAll,
    clearSelection,
    shiftInsertSelectionAfterRemoval,
    getSelectionSummary,
    hasSelection,
    selectionCountText
  }
}
