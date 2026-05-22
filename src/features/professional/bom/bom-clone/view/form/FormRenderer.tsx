import React from 'react'
import { EDIT_PANEL_FORM_FIELDS_ROOT_ID } from './form.constants'
import { CloneFormField } from './FormField'
import { CloneFormSection } from './FormSection'
import type { CloneFormFieldChange, CloneFormSchema } from './model/form.types'

export function CloneFormRenderer(props: {
  schema: CloneFormSchema
  values: Record<string, string>
  displayValues: Record<string, string>
  onFieldChange: (fieldId: string, next: CloneFormFieldChange) => void
}): React.JSX.Element {
  const { schema, values, displayValues, onFieldChange } = props
  let firstFieldAssigned = false
  const resolveFirstFieldIdRoot = (): string | undefined => {
    if (firstFieldAssigned) return undefined
    firstFieldAssigned = true
    return EDIT_PANEL_FORM_FIELDS_ROOT_ID
  }

  if (schema.mode === 'sectioned') {
    return (
      <>
        {schema.sections.map((section) => (
          <CloneFormSection
            key={section.id}
            section={section}
            values={values}
            displayValues={displayValues}
            resolveFieldIdRoot={(fieldIndex) => (fieldIndex === 0 ? resolveFirstFieldIdRoot() : undefined)}
            onFieldChange={onFieldChange}
          />
        ))}
      </>
    )
  }

  return (
    <div id={EDIT_PANEL_FORM_FIELDS_ROOT_ID} className="plm-extension-grid-form-main">
      {schema.fields.map((field) => (
        <CloneFormField
          key={field.fieldId}
          field={field}
          value={values[field.fieldId] ?? ''}
          displayValue={displayValues[field.fieldId] ?? values[field.fieldId] ?? ''}
          onChange={(next) => onFieldChange(field.fieldId, next)}
        />
      ))}
    </div>
  )
}
