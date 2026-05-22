import type { GridImportSubmitFailure } from '../submit.service'
import type {
  CsvParseResult,
  GridImportField,
  GridImportMapping,
  GridImportRowValidationStatus,
  GridImportValidationResult
} from '../types'

export type GridImportDialogState = {
  fileName: string
  parsed: CsvParseResult | null
  fields: GridImportField[]
  mapping: GridImportMapping[]
  matchFieldIds: string[]
  validation: GridImportValidationResult | null
  showValidationColumn: boolean
  rowValidation: Record<number, GridImportRowValidationStatus>
  loading: boolean
  submitting: boolean
  progress: { completed: number; total: number; message: string } | null
  failures: GridImportSubmitFailure[]
  status: string
  enableAdvancedEditor: boolean
  /** Import opened from Advanced Editor: show Confirm instead of Import/Edit. */
  fromAdvancedEditor: boolean
}

export type GridImportDialog = {
  update: (state: GridImportDialogState) => void
  close: () => void
}

export type GridImportDialogCallbacks = {
  onMappingChanged: (mapping: GridImportMapping[]) => void
  onMatchFieldsChanged: (fieldIds: string[]) => void
  onImport: () => void
  onEdit: () => void
  canEditInAdvancedEditor: () => boolean
  onClose: () => void
}

export type GridImportValidationModal = {
  showLoading: (message: string) => void
  showResult: (validation: GridImportValidationResult, onContinue: () => void) => void
  close: () => void
}

export type GridImportValidationIssuesModal = {
  close: () => void
}

export type GridImportEditConfirmModal = {
  close: () => void
}

export type GridImportEditAllSkippedModal = {
  close: () => void
}

export type GridImportEditAllSkippedOptions = {
  skippedRowCount: number
  firstReason: string
  hasAdditionalSkippedRows: boolean
  onClose: () => void
}

export type GridImportEditConfirmOptions = {
  skippedRowCount: number
  stagedRowCount: number
  onContinue: () => void
  onCancel: () => void
}

export type GridImportValidationIssuesModalOptions = {
  intent?: 'import' | 'edit'
}
