export type ColumnMode = 'select' | 'text'

export type ColumnKey =
  | 'status'
  | 'authStatus'
  | 'userName'
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'organization'
  | 'twoFactor'

export type ColumnDef = {
  key: ColumnKey
  label: string
  aliases: string[]
  mode: ColumnMode
}

export type ColumnFilters = Record<ColumnKey, string>

export type ColumnIndexMap = Record<ColumnKey, number>

export type IndexedUserRow = {
  row: HTMLTableRowElement
  searchableText: string
  columns: ColumnFilters
  visible: boolean
}

export type ExportUiState = {
  isExporting: boolean
  processed: number
  total: number
}

export type UsersFilterUiDeps = {
  onDraftChanged: () => void
  onApplyFilters: () => void
  onClearFilters: () => void
  onExportClick: () => void
  getVisibleRowCount: () => number
  isDraftDirty: () => boolean
  hasAppliedFilters: () => boolean
}

export type UsersFilterUi = {
  ensureAttached: () => void
  remove: () => void
  readColumnFilters: () => ColumnFilters
  hasColumnFilter: (filters: ColumnFilters) => boolean
  setResultCount: (visibleCount: number, totalCount: number, hasFilter: boolean) => void
  refreshSelectOptions: (rows: IndexedUserRow[]) => void
  updateExportUi: (state: ExportUiState, visibleCount?: number) => void
  syncActionButtons: () => void
}

export type SecurityUsersFeature = {
  mount: () => void
  unmount: () => void
}
