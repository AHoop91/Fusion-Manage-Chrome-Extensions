import { el } from './domBuilder'
import { isLookupFieldType, isLookupPayloadValue, isMultiLookupFieldType, isRadioFieldType, shouldPreloadLookupOptions } from '../services/fieldTypes'
import type { FormRenderer } from './formRenderer'
import type { ApiTableColumn, MatchedFormField, RowBinding, SelectedRowModel } from '../types'

/**
 * Insert draft data consumed by form rendering when active row is staged insert.
 */
export interface PendingInsertDraftLike {
  payload: Map<string, string>
  display: Map<string, string>
  source: 'add' | 'clone'
}

/**
 * Dependencies required to render field controls for current row/edit context.
 */
export interface FormFieldsRenderArgs {
  fieldsRoot: HTMLDivElement
  matchedFields: MatchedFormField[]
  requiredOnly: boolean
  isMultiEditMode: boolean
  activeModel: SelectedRowModel | null
  activeInsertDraft: PendingInsertDraftLike | null
  pendingChangesByDomRowIndex: Map<number, Map<string, string>>
  pendingDisplayByDomRowIndex: Map<number, Map<string, string>>
  multiEditInitialDisplayByFieldId: Map<string, string>
  multiEditMismatchFieldIds: Set<string>
  formRenderer: FormRenderer
  resolveFieldValueForSelectedRow: (
    row: SelectedRowModel,
    field: ApiTableColumn['field'],
    columnIndex: number | null
  ) => string
  onFieldChange: () => void
}

/**
 * Renders all form field rows and returns active row bindings for value collection.
 */
export function renderFormFields(args: FormFieldsRenderArgs): RowBinding[] {
  const {
    fieldsRoot,
    matchedFields,
    requiredOnly,
    isMultiEditMode,
    activeModel,
    activeInsertDraft,
    pendingChangesByDomRowIndex,
    pendingDisplayByDomRowIndex,
    multiEditInitialDisplayByFieldId,
    multiEditMismatchFieldIds,
    formRenderer,
    resolveFieldValueForSelectedRow,
    onFieldChange
  } = args

  const bindings: RowBinding[] = []
  fieldsRoot.textContent = ''

  const toFiniteNumber = (value: unknown): number | null => {
    const parsed = typeof value === 'string' ? Number(value.trim()) : Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }

  const getNumericBoundsFromField = (
    field: RowBinding['field']
  ): { min: number | null; max: number | null; precision: number } => {
    const precision =
      typeof field.fieldPrecision === 'number' && Number.isFinite(field.fieldPrecision) && field.fieldPrecision > 0
        ? Math.floor(field.fieldPrecision)
        : 0
    const length =
      typeof field.fieldLength === 'number' && Number.isFinite(field.fieldLength) && field.fieldLength > 0
        ? Math.floor(field.fieldLength)
        : null
    if (length === null) return { min: null, max: null, precision }

    // In Fusion metadata, fieldLength is the allowed integer-digit width.
    const integerDigits = Math.max(0, length)
    const unit = precision > 0 ? Math.pow(10, -precision) : 1
    const maxAbs = Math.pow(10, integerDigits) - unit
    if (!Number.isFinite(maxAbs) || maxAbs < 0) return { min: null, max: null, precision }
    return { min: -maxAbs, max: maxAbs, precision }
  }

  for (const matchedField of matchedFields) {
    const { field, columnIndex } = matchedField
    if (requiredOnly && !field.required) continue

    const labelText = el('span').cls('plm-extension-grid-form-label-text').text(field.title).build()
    const labelMain = el('div').cls('plm-extension-grid-form-label-main').append(labelText).build()
    if (field.required) {
      labelMain.appendChild(el('span').cls('plm-extension-grid-form-required-mark').text('*').title('Required').build())
    }

    const label = el('div').cls('plm-extension-grid-form-label').append(labelMain).build()
    if (field.description) {
      label.appendChild(el('div').cls('plm-extension-grid-form-label-description').text(field.description).build())
    }

    const pendingForRow = activeModel ? pendingChangesByDomRowIndex.get(activeModel.domRowIndex) : null
    const pendingDisplayForRow = activeModel ? pendingDisplayByDomRowIndex.get(activeModel.domRowIndex) : null
    const pendingValue = pendingForRow?.get(field.fieldId)
    const pendingDisplayValue = pendingDisplayForRow?.get(field.fieldId)
    const insertedPayloadValue = activeInsertDraft?.payload.get(field.fieldId)
    const insertedDisplayValue = activeInsertDraft?.display.get(field.fieldId)
    const fieldUsesLookup = isLookupFieldType(field.typeId) || Boolean(field.picklistPath)

    const rawCurrentValue = isMultiEditMode
      ? multiEditInitialDisplayByFieldId.get(field.fieldId) || ''
      : activeModel
        ? typeof pendingDisplayValue === 'string'
          ? pendingDisplayValue
          : typeof pendingValue === 'string' && !(fieldUsesLookup && isLookupPayloadValue(pendingValue))
            ? pendingValue
            : resolveFieldValueForSelectedRow(activeModel, field, columnIndex)
        : typeof insertedDisplayValue === 'string'
          ? insertedDisplayValue
          : typeof insertedPayloadValue === 'string' && !(fieldUsesLookup && isLookupPayloadValue(insertedPayloadValue))
            ? insertedPayloadValue
            : ''

    const currentValue =
      rawCurrentValue ||
      (!activeModel && !isMultiEditMode
        ? field.defaultValue || ''
        : '')
    const currentLinkValue = isMultiEditMode
      ? ''
      : activeModel
        ? typeof pendingValue === 'string' && isLookupPayloadValue(pendingValue)
          ? pendingValue
          : ''
        : typeof insertedPayloadValue === 'string' && isLookupPayloadValue(insertedPayloadValue)
          ? insertedPayloadValue
          : ''

    const control = formRenderer.createControl(field, currentValue)
    control.disabled = !field.editable
    if (isMultiEditMode && multiEditMismatchFieldIds.has(field.fieldId)) {
      labelText.classList.add('is-mismatch')
      control.dataset.plmMultiMismatch = 'true'
    }

    if (fieldUsesLookup && control instanceof HTMLInputElement) {
      const currentLink = activeModel
        ? currentLinkValue || activeModel.apiRow?.byFieldLink.get(field.fieldId) || ''
        : currentLinkValue || field.defaultPayloadValue || ''
      const defaultLabel = String(field.defaultValue || '').trim()
      const defaultLink = String(field.defaultPayloadValue || '').trim()
      control.dataset.plmLookupCurrentLink = currentLink
      control.dataset.plmLookupCurrentLabel = currentValue
      control.dataset.plmLookupDefaultLabel = defaultLabel
      control.dataset.plmLookupDefaultLink = defaultLink
    } else if (fieldUsesLookup && control instanceof HTMLFieldSetElement && isRadioFieldType(field.typeId)) {
      const currentLink = activeModel
        ? currentLinkValue || activeModel.apiRow?.byFieldLink.get(field.fieldId) || ''
        : currentLinkValue || field.defaultPayloadValue || ''
      const defaultLabel = String(field.defaultValue || '').trim()
      const defaultLink = String(field.defaultPayloadValue || '').trim()
      control.dataset.plmLookupCurrentLabel = currentValue
      control.dataset.plmLookupCurrentValue = currentValue
      control.dataset.plmLookupCurrentLink = currentLink
      control.dataset.plmLookupDefaultLabel = defaultLabel
      control.dataset.plmLookupDefaultLink = defaultLink
    }

    if (control instanceof HTMLInputElement && control.type === 'checkbox') {
      control.dataset.plmInitialDisplay = control.checked ? 'true' : 'false'
      control.dataset.plmInitialPayload = control.checked ? 'true' : 'false'
    } else if (control instanceof HTMLFieldSetElement && isRadioFieldType(field.typeId)) {
      const initialPayload = String(control.dataset.plmLookupCurrentLink || control.dataset.plmLookupCurrentValue || '').trim()
      const initialDisplay = String(control.dataset.plmLookupCurrentLabel || currentValue || '').trim()
      control.dataset.plmInitialDisplay = initialDisplay
      control.dataset.plmInitialPayload = initialPayload
    } else {
      const initialDisplay = String(currentValue || '').trim()
      const controlValue =
        control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement
          ? control.value
          : ''
      const initialPayload =
        fieldUsesLookup && control instanceof HTMLInputElement
          ? String(control.dataset.plmLookupCurrentLink || controlValue || '').trim()
          : String(controlValue || '').trim()
      control.dataset.plmInitialDisplay = initialDisplay
      control.dataset.plmInitialPayload = initialPayload
    }

    const wrapper = el('div').cls('plm-extension-grid-form-row').append(label).build()
    const valueWrap = el('div').cls('plm-extension-grid-form-value').build()
    const fieldError = el('div').cls('plm-extension-grid-form-field-error').build()
    fieldError.setAttribute('aria-live', 'polite')

    if (fieldUsesLookup && field.picklistPath && control instanceof HTMLInputElement) {
      const lookupMenu = el('div').cls('plm-extension-grid-form-lookup-menu').build()
      const lookupClear = !isMultiLookupFieldType(field.typeId)
        ? el('button')
            .type('button')
            .cls('plm-extension-grid-form-lookup-clear')
            .attr('aria-label', `Clear ${field.title}`)
            .text('×')
            .build()
        : null
      const lookupWrap = el('div').cls('plm-extension-grid-form-lookup-wrap').append(control, lookupClear, lookupMenu).build()
      if (lookupClear) lookupWrap.classList.add('has-clear')
      valueWrap.appendChild(lookupWrap)
      formRenderer.wireLookupSearchInput(
        control,
        lookupMenu,
        field.picklistPath,
        isMultiLookupFieldType(field.typeId),
        shouldPreloadLookupOptions(field.typeId)
      )
    } else if (control instanceof HTMLInputElement && control.type === 'checkbox') {
      valueWrap.appendChild(control)
    } else if (field.unitOfMeasure && control instanceof HTMLInputElement && control.type !== 'checkbox' && control.type !== 'date') {
      const unitWrap = el('div')
        .cls('plm-extension-grid-form-control-wrap', 'with-prefix')
        .append(
          el('span').cls('plm-extension-grid-form-control-prefix').text(field.unitOfMeasure),
          control
        )
        .build()
      valueWrap.appendChild(unitWrap)
    } else {
      valueWrap.appendChild(control)
    }

    wrapper.appendChild(valueWrap)
    wrapper.appendChild(fieldError)
    fieldsRoot.appendChild(wrapper)

    bindings.push({
      field,
      columnIndex,
      control
    })

    const maybeAttachNumericRangeValidation = (): void => {
      if (!(control instanceof HTMLInputElement) || control.type !== 'number') return
      const bounds = getNumericBoundsFromField(field)
      const minValue = bounds.min
      const maxValue = bounds.max
      if (minValue === null && maxValue === null) {
        fieldError.textContent = ''
        fieldError.classList.remove('is-visible')
        return
      }

      const formatBoundary = (value: number): string => {
        if (bounds.precision > 0) return value.toFixed(bounds.precision)
        if (Number.isInteger(value)) return String(value)
        return String(value)
      }

      const getOutOfRangeMessage = (): string => {
        const raw = String(control.value || '').trim()
        if (!raw || raw === '-' || raw === '.' || raw === '-.') return ''
        const parsed = Number(raw)
        if (!Number.isFinite(parsed)) return ''
        if (minValue !== null && parsed < minValue) {
          if (maxValue !== null) {
            return `Out of range. Allowed range: ${formatBoundary(minValue)} to ${formatBoundary(maxValue)}.`
          }
          return `Out of range. Minimum allowed value is ${formatBoundary(minValue)}.`
        }
        if (maxValue !== null && parsed > maxValue) {
          if (minValue !== null) {
            return `Out of range. Allowed range: ${formatBoundary(minValue)} to ${formatBoundary(maxValue)}.`
          }
          return `Out of range. Maximum allowed value is ${formatBoundary(maxValue)}.`
        }
        return ''
      }

      const syncRangeError = (): void => {
        const message = getOutOfRangeMessage()
        fieldError.textContent = message
        fieldError.classList.toggle('is-visible', Boolean(message))
      }

      control.addEventListener('input', syncRangeError)
      control.addEventListener('blur', syncRangeError)
      syncRangeError()
    }

    maybeAttachNumericRangeValidation()

    const notifyFieldChange = (): void => {
      control.dataset.plmTouched = 'true'
      if (control instanceof HTMLInputElement && control.type === 'number') {
        const message = fieldError.textContent || ''
        fieldError.classList.toggle('is-visible', Boolean(message))
      }
      onFieldChange()
    }

    control.addEventListener('change', notifyFieldChange)
    if (
      control instanceof HTMLInputElement ||
      control instanceof HTMLTextAreaElement
    ) {
      const inputType = control instanceof HTMLInputElement ? control.type : 'textarea'
      if (inputType !== 'checkbox' && inputType !== 'radio') {
        control.addEventListener('input', notifyFieldChange)
      }
    }
  }

  return bindings
}
