import { fetchLookupOptionsByQuery } from '../../../../shared/form/lookupOptions'
import { normalizeText } from '../../../../shared/utils/text'
import type { ApiTableColumn, CapturedGridRowField, SelectedRowModel } from '../types'

export type CommitContext = {
  ext: {
    requestPlmAction: <T = unknown>(action: string, payload?: Record<string, unknown>) => Promise<T>
  }
  tenant: string
  workspaceId: number
  dmsId: number
  viewId: number
  fieldById: Map<string, ApiTableColumn['field']>
  modelByDomRowIndex: Map<number, SelectedRowModel>
  rowIdByDomRowIndex: Map<number, string>
  fullRowPayloadByDomRowIndex?: Map<number, Map<string, string>>
  fullRowDisplayByDomRowIndex?: Map<number, Map<string, string>>
  toGridPayloadType: (field: ApiTableColumn['field']) => string
}

export type GridCommitDataEntry = {
  fieldId: string
  type: string
  value: unknown
  display: string
  title: string
  typeId: number | null
  typeLink: string | null
  typeUrn: string | null
  typeTitle: string | null
  fieldSelf: string | null
  fieldUrn: string | null
}

export type CommitFailure = {
  kind: 'insert' | 'update' | 'remove'
  rowLabel: string
  message: string
  domRowIndex?: number
  insertIndex?: number
}

export type CommitResult = {
  successCount: number
  failures: CommitFailure[]
}

type NumericBounds = {
  min: number | null
  max: number | null
  precision: number
}

export function normalizePayloadValue(type: string, value: unknown): unknown {
  if (value == null) return value
  if (typeof value === 'object') return value

  const normalizedType = String(type || '').trim().toLowerCase()
  const normalizeNumeric = (rawValue: string, integerOnly: boolean): string => {
    let next = String(rawValue || '').trim()
    if (!next) return ''

    // Normalize display-style numbers (currency/grouping/trailing separators) to API-safe numeric strings.
    next = next.replace(/\s+/g, '').replace(/,/g, '').replace(/[^\d.\-]/g, '')
    if (!next || next === '-' || next === '.' || next === '-.') return ''

    const parsed = integerOnly ? Number.parseInt(next, 10) : Number(next)
    if (!Number.isFinite(parsed)) return String(rawValue || '').trim()
    return integerOnly ? String(Math.trunc(parsed)) : String(parsed)
  }

  if (normalizedType === 'multi-select') {
    return String(value || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  if (normalizedType === 'integer') return normalizeNumeric(String(value), true)
  if (normalizedType === 'number' || normalizedType === 'decimal' || normalizedType === 'money') {
    return normalizeNumeric(String(value), false)
  }
  return String(value)
}

export function resolveNumericBounds(field: ApiTableColumn['field']): NumericBounds {
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

export function formatNumericBoundary(value: number, precision: number): string {
  if (precision > 0) return value.toFixed(precision)
  if (Number.isInteger(value)) return String(value)
  return String(value)
}

export function isNumericPayloadType(type: string): boolean {
  const normalizedType = String(type || '').trim().toLowerCase()
  return normalizedType === 'integer' || normalizedType === 'number' || normalizedType === 'decimal' || normalizedType === 'money'
}

export function parseNumericPayloadValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const raw = String(value || '').trim()
  if (!raw || raw === '-' || raw === '.' || raw === '-.') return null
  const normalized = raw.replace(/\s+/g, '').replace(/,/g, '').replace(/[^\d.\-]/g, '')
  if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function isApiPathValue(value: string): boolean {
  return /^\/api\/v3\//i.test(String(value || '').trim())
}

export function isGridLookupSanitizePayloadType(type: string): boolean {
  const normalized = String(type || '').trim().toLowerCase()
  return normalized === 'single-select' || normalized === 'radio' || normalized === 'buom' || normalized === 'multi-select'
}

/**
 * When staged lookup payloads are display text only, resolve `/api/v3/...` paths using the field picklist (same search as the grid form).
 */
export async function resolveGridLookupValueToApiPath(
  field: ApiTableColumn['field'],
  payloadType: string,
  sanitizedValue: string,
  displayValue: string
): Promise<string> {
  const picklistPath = String(field.picklistPath || '').trim()
  if (!picklistPath) return sanitizedValue

  const pt = String(payloadType || '').trim().toLowerCase()

  if (pt === 'single-select' || pt === 'radio' || pt === 'buom') {
    const s = String(sanitizedValue || '').trim()
    if (isApiPathValue(s)) return s
    const query = String(displayValue || s || '').trim()
    if (!query) return sanitizedValue
    try {
      const page = await fetchLookupOptionsByQuery(picklistPath, query, 100, 0, { useCache: true })
      const want = normalizeText(query)
      const exact = page.options.find((option) => normalizeText(option.label) === want)
      return exact?.value && isApiPathValue(exact.value) ? exact.value : sanitizedValue
    } catch {
      return sanitizedValue
    }
  }

  if (pt === 'multi-select') {
    const parts = String(sanitizedValue || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
    if (parts.length === 0) return sanitizedValue
    if (parts.every((part) => isApiPathValue(part))) return sanitizedValue

    const labels = String(displayValue || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)

    const resolved: string[] = []
    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index]!
      if (isApiPathValue(part)) {
        resolved.push(part)
        continue
      }
      const labelQuery = labels[index] || part
      if (!labelQuery) continue
      try {
        const page = await fetchLookupOptionsByQuery(picklistPath, labelQuery, 100, 0, { useCache: true })
        const want = normalizeText(labelQuery)
        const exact = page.options.find((option) => normalizeText(option.label) === want)
        if (exact?.value && isApiPathValue(exact.value)) resolved.push(exact.value)
      } catch {
        // keep resolving other chips
      }
    }
    return resolved.length > 0 ? resolved.join(',') : sanitizedValue
  }

  return sanitizedValue
}

export function sanitizeLookupPayloadValue(type: string, rawValue: string, baseValue = ''): string {
  const normalizedType = String(type || '').trim().toLowerCase()
  const raw = String(rawValue || '').trim()
  const base = String(baseValue || '').trim()

  if (normalizedType === 'multi-select') {
    if (!raw) return ''
    const valid = raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => isApiPathValue(entry))
    if (valid.length > 0) return valid.join(',')

    const baseValid = base
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => isApiPathValue(entry))
    if (baseValid.length > 0) return baseValid.join(',')

    const rawTokens = raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
    if (rawTokens.length > 0) return rawTokens.join(',')

    return ''
  }

  if (normalizedType === 'single-select' || normalizedType === 'radio' || normalizedType === 'buom') {
    if (!raw) return isApiPathValue(base) ? base : ''
    if (isApiPathValue(raw)) return raw
    return raw
  }

  return raw
}

export function normalizeOriginalFieldDisplayValue(rawField: CapturedGridRowField, model: SelectedRowModel, fieldId: string): string {
  const fromProjection = model.apiRow?.byFieldId.get(fieldId)
  if (typeof fromProjection === 'string' && fromProjection.trim()) return fromProjection.trim()

  const value = Object.prototype.hasOwnProperty.call(rawField, 'value') ? rawField.value : null
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return String(entry || '').trim()
        const record = entry as Record<string, unknown>
        return String(record.title || record.label || record.name || '').trim()
      })
      .filter(Boolean)
      .join(', ')
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record.title || record.label || record.name || record.displayValue || record.display || '').trim()
  }
  return String(value).trim()
}

export function parseTypeIdFromLink(typeLink: string | null | undefined): number | null {
  const match = /\/field-types\/(\d+)(?:[/?#]|$)/i.exec(String(typeLink || '').trim())
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

export function buildOriginalRowCommitEntry(
  fieldId: string,
  field: ApiTableColumn['field'] | undefined,
  model: SelectedRowModel
): GridCommitDataEntry | null {
  const rawField = model.apiRow?.rawByFieldId.get(fieldId)
  if (!rawField) return null

  const rawTypeLink = String(rawField.type?.link || '').trim() || null
  const rawTypeUrn = String(rawField.type?.urn || '').trim() || null
  const rawTypeTitle = String(rawField.type?.title || '').trim() || null
  const rawFieldSelf = String(rawField.__self__ || '').trim() || null
  const rawFieldUrn = String(rawField.urn || '').trim() || null
  const typeId = field?.typeId ?? parseTypeIdFromLink(rawTypeLink)
  const title = String(field?.title || rawField.title || '').trim()

  return {
    fieldId,
    type: '',
    value: Object.prototype.hasOwnProperty.call(rawField, 'value') ? rawField.value : null,
    display: normalizeOriginalFieldDisplayValue(rawField, model, fieldId),
    title,
    typeId: typeId ?? null,
    typeLink: field?.typeLink ?? rawTypeLink,
    typeUrn: field?.typeUrn ?? rawTypeUrn,
    typeTitle: field?.typeTitle ?? rawTypeTitle,
    fieldSelf: field?.fieldSelf ?? rawFieldSelf,
    fieldUrn: field?.fieldUrn ?? rawFieldUrn
  }
}

