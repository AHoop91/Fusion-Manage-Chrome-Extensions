import React, { useMemo } from 'react'
import { applyMaxLength } from '../../../../../../shared/form/controls'
import {
  isBooleanFieldType,
  isDateFieldType,
  isDecimalFieldType,
  isEmailFieldType,
  isIntegerFieldType,
  isLookupFieldType,
  isMoneyFieldType,
  isParagraphFieldType,
  isRadioFieldType,
  isUrlFieldType
} from '../../../services/form/fieldTypes'
import type { FormFieldDefinition } from '../../../services/form/types'
import { decodeHtmlEntities, sanitizeRichHtml } from '../../../services/form/utils'
import { LookupField } from './LookupField'
import { RadioField } from './RadioField'

type FieldChange = {
  value: string
  displayValue?: string
}

export type FieldRendererProps = {
  field: FormFieldDefinition
  value: string
  displayValue: string
  idRoot?: string
  onChange: (next: FieldChange) => void
}

function parseDateToInputValue(rawValue: string): string {
  const value = String(rawValue || '').trim()
  if (!value) return ''
  const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(value)
  if (isoDateMatch) return `${isoDateMatch[1]}-${isoDateMatch[2]}-${isoDateMatch[3]}`
  const slashOrDashMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(value)
  if (!slashOrDashMatch) return ''
  const first = Number(slashOrDashMatch[1])
  const second = Number(slashOrDashMatch[2])
  const year = slashOrDashMatch[3]
  if (!Number.isFinite(first) || !Number.isFinite(second)) return ''
  let day = first
  let month = second
  if (first <= 12 && second > 12) {
    month = first
    day = second
  } else if (first <= 12 && second <= 12) {
    const locale = String(globalThis.navigator?.language || '').toLowerCase()
    if (locale.startsWith('en-us')) {
      month = first
      day = second
    }
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return ''
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getNumericRangeMessage(field: FormFieldDefinition, rawValue: string): string {
  const precision = typeof field.fieldPrecision === 'number' && Number.isFinite(field.fieldPrecision) && field.fieldPrecision > 0
    ? Math.floor(field.fieldPrecision)
    : 0
  const length = typeof field.fieldLength === 'number' && Number.isFinite(field.fieldLength) && field.fieldLength > 0
    ? Math.floor(field.fieldLength)
    : null
  if (length === null) return ''
  const unit = precision > 0 ? Math.pow(10, -precision) : 1
  const maxAbs = Math.pow(10, length) - unit
  if (!Number.isFinite(maxAbs) || maxAbs < 0) return ''
  const minValue = -maxAbs
  const maxValue = maxAbs
  const text = String(rawValue || '').trim()
  if (!text || text === '-' || text === '.' || text === '-.') return ''
  const parsed = Number(text)
  if (!Number.isFinite(parsed)) return ''
  const formatBoundary = (value: number): string => (precision > 0 ? value.toFixed(precision) : String(value))
  if (parsed < minValue || parsed > maxValue) {
    return `Out of range. Allowed range: ${formatBoundary(minValue)} to ${formatBoundary(maxValue)}.`
  }
  return ''
}

export function FieldRenderer(props: FieldRendererProps): React.JSX.Element {
  const { field, value, displayValue, idRoot, onChange } = props
  const rangeError = useMemo(() => getNumericRangeMessage(field, value), [field, value])
  const isLookupLike = isLookupFieldType(field.typeId) || isRadioFieldType(field.typeId)
  const decodedFormulaValue = decodeHtmlEntities(String(displayValue || value || ''))
  const looksLikeHtml = /<[^>]+>/.test(decodedFormulaValue)

  let control: React.JSX.Element
  if (field.formulaField) {
    control = (
      <fieldset className="plm-extension-grid-form-control--formula" aria-readonly="true">
        {looksLikeHtml ? (
          <span dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(decodedFormulaValue) }} />
        ) : (
          decodedFormulaValue
        )}
      </fieldset>
    )
  } else if (isRadioFieldType(field.typeId)) {
    control = <RadioField field={field} value={value} displayValue={displayValue} onChange={onChange} />
  } else if (isLookupFieldType(field.typeId)) {
    control = <LookupField field={field} value={value} displayValue={displayValue} onChange={onChange} />
  } else if (field.kind === 'boolean' || isBooleanFieldType(field.typeId)) {
    control = (
      <input
        type="checkbox"
        className="plm-extension-grid-form-control--checkbox"
        checked={String(value || '').trim().toLowerCase() === 'true' || String(value || '').trim() === '1'}
        disabled={!field.editable}
        onChange={(event) => onChange({ value: event.target.checked ? 'true' : 'false', displayValue: event.target.checked ? 'true' : 'false' })}
      />
    )
  } else if (isParagraphFieldType(field.typeId)) {
    control = (
      <textarea
        className="plm-extension-grid-form-control plm-extension-grid-form-control--textarea"
        value={displayValue}
        disabled={!field.editable}
        placeholder="Enter text..."
        onChange={(event) => onChange({ value: event.target.value, displayValue: event.target.value })}
        ref={(node) => {
          if (node) applyMaxLength(node, field)
        }}
      />
    )
  } else if (field.kind === 'date' || isDateFieldType(field.typeId)) {
    control = (
      <input
        type="date"
        className="plm-extension-grid-form-control"
        value={parseDateToInputValue(displayValue)}
        disabled={!field.editable}
        onChange={(event) => onChange({ value: event.target.value, displayValue: event.target.value })}
      />
    )
  } else if (
    field.kind === 'number'
    || isIntegerFieldType(field.typeId)
    || isDecimalFieldType(field.typeId)
    || isMoneyFieldType(field.typeId)
  ) {
    control = (
      <input
        type="number"
        className="plm-extension-grid-form-control"
        value={displayValue}
        disabled={!field.editable}
        step={isIntegerFieldType(field.typeId) ? '1' : 'any'}
        inputMode="decimal"
        onChange={(event) => onChange({ value: event.target.value, displayValue: event.target.value })}
      />
    )
  } else if (isEmailFieldType(field.typeId)) {
    control = (
      <input
        type="email"
        className="plm-extension-grid-form-control"
        value={displayValue}
        disabled={!field.editable}
        onChange={(event) => onChange({ value: event.target.value, displayValue: event.target.value })}
        ref={(node) => {
          if (node) applyMaxLength(node, field)
        }}
      />
    )
  } else if (isUrlFieldType(field.typeId)) {
    control = (
      <input
        type="url"
        className="plm-extension-grid-form-control"
        value={displayValue}
        disabled={!field.editable}
        onChange={(event) => onChange({ value: event.target.value, displayValue: event.target.value })}
        ref={(node) => {
          if (node) applyMaxLength(node, field)
        }}
      />
    )
  } else {
    control = (
      <input
        type="text"
        className="plm-extension-grid-form-control"
        value={displayValue}
        disabled={!field.editable}
        onChange={(event) => onChange({ value: event.target.value, displayValue: event.target.value })}
        ref={(node) => {
          if (node) applyMaxLength(node, field)
        }}
      />
    )
  }

  const valueNode = field.unitOfMeasure && !isLookupLike && !field.formulaField && !isDateFieldType(field.typeId) && !(field.kind === 'boolean' || isBooleanFieldType(field.typeId))
    ? (
      <div className="plm-extension-grid-form-control-wrap with-prefix">
        <span className="plm-extension-grid-form-control-prefix">{field.unitOfMeasure}</span>
        {control}
      </div>
    )
    : control

  return (
    <div id={idRoot} className="plm-extension-grid-form-row">
      <div className="plm-extension-grid-form-label" title={field.title}>
        <div className="plm-extension-grid-form-label-main" title={field.title}>
          <span className="plm-extension-grid-form-label-text" title={field.title}>{field.title}</span>
          {field.required ? <span className="plm-extension-grid-form-required-mark" title="Required">*</span> : null}
        </div>
        {field.description ? <div className="plm-extension-grid-form-label-description">{field.description}</div> : null}
      </div>
      <div className="plm-extension-grid-form-value">{valueNode}</div>
      <div className={`plm-extension-grid-form-field-error${rangeError ? ' is-visible' : ''}`} aria-live="polite">
        {rangeError}
      </div>
    </div>
  )
}
