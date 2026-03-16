import type { FormFieldDefinition } from '../../../services/form/types'

export type CloneFormFieldDefinition = FormFieldDefinition

export type CloneFormFieldChange = {
  value: string
  displayValue?: string
}

export type CloneFormSchemaSection = {
  id: string
  title: string
  expandedByDefault: boolean
  fields: CloneFormFieldDefinition[]
}

export type CloneFormSchema = {
  mode: 'flat' | 'sectioned'
  fields: CloneFormFieldDefinition[]
  sections: CloneFormSchemaSection[]
}

export type CloneFormStateSnapshot = {
  values: Record<string, string>
  displayValues: Record<string, string>
}
