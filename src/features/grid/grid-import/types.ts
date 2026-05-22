import type { CapturedGridFieldDefinition, FormFieldDefinition } from '../grid-advanced-editor/types'

export type GridImportOpenOptions = {
  /** When true, hides Edit (user is already in the advanced editor). */
  fromAdvancedEditor?: boolean
}

export type GridImportFeature = {
  open: (options?: GridImportOpenOptions) => void
  mount: () => void
  update: () => void
  unmount: () => void
}

export type CsvParseResult = {
  headers: string[]
  rows: string[][]
}

export type GridImportField = {
  fieldId: string
  name: string
  field: FormFieldDefinition
  raw: CapturedGridFieldDefinition
  allowedPicklistValues: string[]
}

export type GridImportMapping = {
  fieldId: string
  header: string
}

export type GridImportMappedCell = {
  field: GridImportField
  value: string
}

export type GridImportRowIssue = {
  row: number
  fieldName: string
  message: string
  kind: 'field' | 'picklist'
}

export type GridImportRowValidationTone = 'pass' | 'error' | 'warning'

export type GridImportRowValidationStatus = {
  tone: GridImportRowValidationTone
  messages: string[]
}

export type GridImportValidationResult = {
  valid: boolean
  mappingIssues: string[]
  rowIssues: GridImportRowIssue[]
  warningIssues: GridImportRowIssue[]
  checkedRows: number
  checkedCells: number
}

export type GridImportMatchConfig = {
  fieldIds: string[]
}

export type GridImportSubmitDataEntry = {
  fieldId: string
  type: string
  value: unknown
  display: string
  title: string
  typeId: number | null
  typeLink: string | null
  typeUrn: string | null
  typeTitle: string | null
  fieldSelf: string | null
  fieldUrn: string | null
}

