import React from 'react'
import type { CloneFormFieldChange, CloneFormSchemaSection } from './model/form.types'
import { CloneFormField } from './FormField'

export function CloneFormSection(props: {
  section: CloneFormSchemaSection
  values: Record<string, string>
  displayValues: Record<string, string>
  resolveFieldIdRoot?: (fieldIndex: number) => string | undefined
  onFieldChange: (fieldId: string, next: CloneFormFieldChange) => void
}): React.JSX.Element {
  const { section, values, displayValues, resolveFieldIdRoot, onFieldChange } = props
  return (
    <details className="plm-extension-bom-clone-details-section" open={section.expandedByDefault}>
      <summary className="plm-extension-bom-clone-details-section-title">{section.title}</summary>
      <div className="plm-extension-bom-clone-edit-table-head"><span>Field</span><span>Value</span></div>
      <div className="plm-extension-grid-form-main">
        {section.fields.map((field, index) => (
          <CloneFormField
            key={field.fieldId}
            idRoot={resolveFieldIdRoot?.(index)}
            field={field}
            value={values[field.fieldId] ?? ''}
            displayValue={displayValues[field.fieldId] ?? values[field.fieldId] ?? ''}
            onChange={(next) => onFieldChange(field.fieldId, next)}
          />
        ))}
      </div>
    </details>
  )
}
