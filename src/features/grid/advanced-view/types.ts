import type { GridColumnKind } from '../grid.types'
export type { GridColumnKind } from '../grid.types'

export type GridFormFeature = {
  mount: () => void
  update: () => void
  unmount: () => void
}

export type CapturedGridFieldDefinition = {
  __self__?: string
  urn?: string
  name?: string
  label?: string | null
  description?: string | null
  defaultValue?: unknown
  fieldLength?: number | null
  fieldPrecision?: number | null
  displayOrder?: number | null
  editability?: string
  visibility?: string
  derived?: boolean
  unitOfMeasure?: string | null
  validators?: unknown
  fieldValidators?: unknown
  picklist?: string | null
  type?: {
    link?: string
    urn?: string
    title?: string
    deleted?: boolean
  }
}

export type CapturedGridFieldsPayload = {
  fields?: CapturedGridFieldDefinition[]
}

export type CapturedGridRowField = {
  __self__?: string
  urn?: string
  title?: string
  formulaField?: boolean
  value?: unknown
}

export type CapturedGridRow = {
  rowData?: CapturedGridRowField[]
  rowID?: string | number
}

export type CapturedGridRowsPayload = {
  rows?: CapturedGridRow[]
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
}

export type ApiRowProjection = {
  index: number
  identity: string
  rowId: string | null
  byFieldId: Map<string, string>
  byFieldLink: Map<string, string>
  byTitle: Map<string, string>
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
