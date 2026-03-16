import type { GridColumnKind, GridFilterJoinMode, GridFilterOperator } from '../grid.types'

export type HeaderMeta = {
  key: string
  title: string
  fieldId: string
  syntheticTitle: boolean
}

export type ColumnCondition = {
  id: string
  operator: GridFilterOperator
  value: string
  valueTo: string
}

export type ColumnFilterGroup = {
  id: string
  columnKey: string
  mode: GridFilterJoinMode
  conditions: ColumnCondition[]
}

export type GridRowsApiField = {
  __self__?: string
  urn?: string
  title?: string
  formulaField?: boolean
  type?: {
    title?: string
    link?: string
  }
}

export type GridRowsApiPayload = {
  rows?: Array<{
    rowData?: GridRowsApiField[]
  }>
}

export type ApiFieldMeta = {
  fieldId: string
  title: string
  kind: GridColumnKind
}

export const GRID_SUMMARY_ID = 'plm-extension-grid-filter-summary'
export const GRID_SUMMARY_COUNT_ID = 'plm-extension-grid-filter-summary-count'
export const GRID_SUMMARY_LIST_ID = 'plm-extension-grid-filter-summary-list'
export const GRID_COMMAND_RIGHT_HOST_ID = 'plm-extension-grid-command-right-host'
