import type { FormFieldDefinition } from '../../../services/form/types'
import type { CloneFormSchema, CloneFormSchemaSection } from './form.types'

type CreateCloneFormSchemaOptions = {
  fields: FormFieldDefinition[]
  sections?: Array<{
    title: string
    expandedByDefault: boolean
    fields: FormFieldDefinition[]
  }>
  sectioned: boolean
}

export function createCloneFormSchema(options: CreateCloneFormSchemaOptions): CloneFormSchema {
  const sections: CloneFormSchemaSection[] = options.sectioned
    ? (options.sections || []).map((section, index) => ({
        id: `${index}:${section.title}`,
        title: section.title,
        expandedByDefault: section.expandedByDefault,
        fields: section.fields
      }))
    : []

  return {
    mode: options.sectioned ? 'sectioned' : 'flat',
    fields: options.fields,
    sections
  }
}
