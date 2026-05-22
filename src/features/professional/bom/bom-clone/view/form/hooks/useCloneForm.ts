import { useCallback, useEffect, useRef, useState } from 'react'
import type { CloneFormFieldChange, CloneFormStateSnapshot } from '../model/form.types'

type UseCloneFormOptions = {
  initialValues: Record<string, string>
  initialDisplayValues: Record<string, string>
}

export function useCloneForm(options: UseCloneFormOptions): CloneFormStateSnapshot & {
  updateField: (fieldId: string, next: CloneFormFieldChange) => CloneFormStateSnapshot
} {
  const { initialValues, initialDisplayValues } = options
  const [values, setValues] = useState<Record<string, string>>(initialValues)
  const [displayValues, setDisplayValues] = useState<Record<string, string>>(initialDisplayValues)
  const valuesRef = useRef(values)
  const displayValuesRef = useRef(displayValues)

  useEffect(() => {
    valuesRef.current = values
  }, [values])

  useEffect(() => {
    displayValuesRef.current = displayValues
  }, [displayValues])

  useEffect(() => {
    valuesRef.current = initialValues
    displayValuesRef.current = initialDisplayValues
    setValues(initialValues)
    setDisplayValues(initialDisplayValues)
  }, [initialValues, initialDisplayValues])

  const updateField = useCallback((fieldId: string, next: CloneFormFieldChange): CloneFormStateSnapshot => {
    const nextValues = {
      ...valuesRef.current,
      [fieldId]: next.value
    }
    const nextDisplayValues = {
      ...displayValuesRef.current,
      [fieldId]: next.displayValue ?? next.value
    }
    valuesRef.current = nextValues
    displayValuesRef.current = nextDisplayValues
    setValues(nextValues)
    setDisplayValues(nextDisplayValues)
    return {
      values: nextValues,
      displayValues: nextDisplayValues
    }
  }, [])

  return {
    values,
    displayValues,
    updateField
  }
}
