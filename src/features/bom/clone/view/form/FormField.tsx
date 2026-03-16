import React from 'react'
import type { CloneFormFieldChange, CloneFormFieldDefinition } from './model/form.types'
import { FieldRenderer } from './fields/FieldRenderer'

export function CloneFormField(props: {
  field: CloneFormFieldDefinition
  value: string
  displayValue: string
  idRoot?: string
  onChange: (next: CloneFormFieldChange) => void
}): React.JSX.Element {
  const { field, value, displayValue, idRoot, onChange } = props
  return (
    <FieldRenderer
      field={field}
      value={value}
      displayValue={displayValue}
      idRoot={idRoot}
      onChange={onChange}
    />
  )
}
