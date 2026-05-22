import type { GridColumnKind } from '../grid.types'
import type { CapturedGridRowField } from '../grid-api-payload.types'
export type { GridColumnKind } from '../grid.types'
export type {
  CapturedGridFieldDefinition,
  CapturedGridFieldsPayload,
  CapturedGridRow,
  CapturedGridRowField,
  CapturedGridRowsPayload
} from '../grid-api-payload.types'

import type { GridImportEditOpenResult, GridImportEditSession } from '../grid-staging/grid-import-edit-session'

export type GridFormFeature = {
  mount: () => void
  update: () => void
  unmount: () => void
  openForTableWithImportSession: (session: GridImportEditSession) => Promise<GridImportEditOpenResult>
}

export type FormFieldDefinition = {
  fieldId: string
  title: string
  description: string | null
  kind: GridColumnKind
  typeId: number | null
  picklistPath: string | null
  defaultValue: string | null
  defaultPayloadValue: string | null
  fieldLength: number | null
  fieldPrecision: number | null
  unitOfMeasure: string | null
  required: boolean
  editable: boolean
  visible: boolean
  displayOrder: number
  fieldSelf?: string | null
  fieldUrn?: string | null
  typeLink?: string | null
  typeUrn?: string | null
  typeTitle?: string | null
}

export type RowBinding = {
  field: FormFieldDefinition
  columnIndex: number | null
  control: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLFieldSetElement
}

export type MatchedFormField = {
  field: FormFieldDefinition
  columnIndex: number | null
}

export type LookupOption = {
  value: string
  label: string
  urn?: string
}

export type ApiRowProjection = {
  index: number
  identity: string
  rowId: string | null
  byFieldId: Map<string, string>
  byFieldLink: Map<string, string>
  byTitle: Map<string, string>
  rawByFieldId: Map<string, CapturedGridRowField>
}

export type SelectedRowModel = {
  domRow: HTMLTableRowElement
  domRowIndex: number
  identity: string
  apiRow: ApiRowProjection | null
}

export type ApiTableColumn = {
  field: FormFieldDefinition
  columnIndex: number | null
}
