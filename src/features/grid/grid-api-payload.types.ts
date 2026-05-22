/**
 * Grid API capture shapes shared across filters, services, import, and advanced editor.
 */
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
  formulaField?: boolean
  unitOfMeasure?: string | null
  validators?: unknown
  fieldValidators?: unknown
  picklist?: string | null
  picklistFieldDefinition?: unknown
  type?: {
    link?: string
    urn?: string
    title?: string
    deleted?: boolean
  }
}

export type CapturedGridFieldsPayload = {
  __self__?: string
  fields?: CapturedGridFieldDefinition[]
}

export type CapturedGridRowField = {
  __self__?: string
  urn?: string
  title?: string
  formulaField?: boolean
  type?: {
    link?: string
    urn?: string
    title?: string
    deleted?: boolean
  }
  value?: unknown
}

export type CapturedGridRow = {
  rowData?: CapturedGridRowField[]
  rowID?: string | number
}

export type CapturedGridRowsPayload = {
  rows?: CapturedGridRow[]
}
