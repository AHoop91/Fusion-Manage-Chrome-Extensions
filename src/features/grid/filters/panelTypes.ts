import type { ColumnCondition, ColumnFilterGroup } from './model'
import type { GridColumnDef, GridFilterOperator } from '../grid.types'
import type { ExportUiState } from '../export/export.service'

export type GridOperatorOption = {
  value: GridFilterOperator
  label: string
}

export type GridPanelUiDeps = {
  getActiveTable: () => HTMLTableElement | null
  getActiveColumns: () => GridColumnDef[]
  getDraftGroups: () => ColumnFilterGroup[]
  setDraftGroups: (next: ColumnFilterGroup[]) => void
  getAppliedGroups: () => ColumnFilterGroup[]
  setAppliedGroups: (next: ColumnFilterGroup[]) => void
  getPanelVisible: () => boolean
  setPanelVisible: (next: boolean) => void
  getAppliedActiveGroups: () => ColumnFilterGroup[]
  isDraftDirty: () => boolean
  normalizeGroupsForColumns: (groups: ColumnFilterGroup[]) => ColumnFilterGroup[]
  createGroup: (initialColumnKey?: string) => ColumnFilterGroup
  createCondition: (columnKey: string) => ColumnCondition
  ensureConditionOperator: (condition: ColumnCondition, columnKey: string) => void
  getSelectedColumnKeys: (excludeGroupId?: string) => Set<string>
  findColumnByKey: (columnKey: string) => GridColumnDef | null
  getColumnOperators: (columnKey: string) => GridOperatorOption[]
  runFilter: () => void
  hasApiMetadataForCurrentGrid: () => boolean
  getVisibleRowCount: () => number
  getTotalRowCount: () => number
  getExportUiState: () => ExportUiState
  onExportCsv: () => void
}

export type GridPanelUi = {
  ensureFilterToggleButton: () => void
  removeFilterToggleButton: () => void
  updateCount: (visibleCount: number, totalCount: number, hasFilter: boolean) => void
  updateActionButtons: () => void
  updateFilterToggleButtonState: () => void
  renderRuleBuilder: () => void
  ensurePanel: (table: HTMLTableElement) => HTMLDivElement | null
  removePanel: () => void
  removeSummaryBar: () => void
}
