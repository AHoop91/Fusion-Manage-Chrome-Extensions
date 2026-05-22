import { useMemo } from 'react'
import type { CloneFormSchema, CloneFormSchemaSection } from '../model/form.types'

export function useFieldVisibility(schema: CloneFormSchema | null, requiredOnly: boolean): {
  visibleFields: CloneFormSchema['fields']
  visibleSections: CloneFormSchemaSection[]
  showNoFilteredFields: boolean
} {
  return useMemo(() => {
    if (!schema) {
      return {
        visibleFields: [],
        visibleSections: [],
        showNoFilteredFields: false
      }
    }

    if (schema.mode === 'sectioned') {
      const visibleSections = schema.sections
        .map((section) => ({
          ...section,
          fields: requiredOnly ? section.fields.filter((field) => field.required) : section.fields
        }))
        .filter((section) => section.fields.length > 0)

      return {
        visibleFields: [],
        visibleSections,
        showNoFilteredFields: visibleSections.length === 0
      }
    }

    const visibleFields = requiredOnly ? schema.fields.filter((field) => field.required) : schema.fields
    return {
      visibleFields,
      visibleSections: [],
      showNoFilteredFields: visibleFields.length === 0
    }
  }, [schema, requiredOnly])
}
