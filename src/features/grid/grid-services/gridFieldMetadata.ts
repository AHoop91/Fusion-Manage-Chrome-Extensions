import { classifyColumnKind } from '../grid-filters/filterEngine'
import type { CapturedGridFieldDefinition, FormFieldDefinition, GridColumnKind } from '../grid-advanced-editor/types'
import { extractFusionApiPathFromRecord } from '../../../shared/form/lookupOptions'
import { decodeHtmlEntities, stripHtml } from '../../../shared/utils/html'
import { normalizeApiUrlPath } from '../../../shared/url/parse'
import {
  inferColumnKindFromTypeId,
  isDateFieldType,
  isIntegerFieldType,
  isLookupFieldType,
  isLookupPayloadValue,
  isMultiLookupFieldType,
  isNumericFieldType,
  isRadioFieldType
} from '../grid-advanced-editor/services/fieldTypes'

export type GridNumericBounds = {
  min: number | null
  max: number | null
  precision: number
}

export function parseGridFieldIdFromSelf(self: unknown): string {
  const match = /\/fields\/([^/?#]+)/i.exec(String(self || '').trim())
  return match?.[1] ? decodeURIComponent(match[1]).trim().toUpperCase() : ''
}

export function resolveGridFieldId(definition: CapturedGridFieldDefinition): string {
  const fromSelf = parseGridFieldIdFromSelf(definition.__self__)
  if (fromSelf) return fromSelf
  const fromUrn = String(definition.urn || '').split('.').at(-1)
  if (fromUrn) return String(fromUrn).trim().toUpperCase()
  return String(definition.name || '').trim().toUpperCase()
}

export function normalizeGridApiCellValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return stripHtml(decodeHtmlEntities(value)).trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeGridApiCellValue(entry))
      .map((entry) => entry.trim())
      .filter(Boolean)
      .join(', ')
  }
  if (typeof value !== 'object') return String(value)

  const record = value as Record<string, unknown>
  for (const key of ['title', 'label', 'name', 'displayValue', 'display']) {
    const text = normalizeGridApiCellValue(record[key])
    if (text) return text
  }
  for (const key of ['value', 'values', 'items', 'options', 'results', 'selectedValues', 'data']) {
    if (!(key in record)) continue
    const normalized = normalizeGridApiCellValue(record[key])
    if (normalized) return normalized
  }
  for (const [key, entry] of Object.entries(record)) {
    if (/^(?:link|urn|__self__|deleted|type)$/i.test(key)) continue
    const normalized = normalizeGridApiCellValue(entry)
    if (normalized) return normalized
  }
  return ''
}

export function extractGridApiLinkValue(value: unknown): string | null {
  if (!value) return null
  if (Array.isArray(value)) {
    const links = value.map((item) => extractGridApiLinkValue(item)).filter((item): item is string => Boolean(item))
    return links.length > 0 ? links.join(',') : null
  }
  if (typeof value !== 'object') {
    const raw = String(value).trim()
    return raw && isLookupPayloadValue(raw) ? raw : null
  }
  const record = value as Record<string, unknown>
  const directPath = extractFusionApiPathFromRecord(record, 3)
  if (directPath) return directPath
  for (const key of ['value', 'values', 'items', 'options', 'results', 'selectedValues', 'data']) {
    if (!(key in record)) continue
    const nested = extractGridApiLinkValue(record[key])
    if (nested) return nested
  }
  for (const entry of Object.values(record)) {
    const nested = extractGridApiLinkValue(entry)
    if (nested) return nested
  }
  return null
}

export function parseGridFieldLength(value: unknown): number | null {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return Math.floor(numeric)
}

export function parseGridFieldPrecision(value: unknown): number | null {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) return null
  return Math.floor(numeric)
}

export function isGridFieldVisible(definition: CapturedGridFieldDefinition): boolean {
  const visibility = String(definition.visibility || '').toUpperCase().trim()
  return !visibility || visibility === 'ALWAYS'
}

export function isGridFieldEditable(definition: CapturedGridFieldDefinition): boolean {
  const editability = String(definition.editability || '').toUpperCase()
  return (!editability || editability === 'ALWAYS') && definition.derived !== true && definition.formulaField !== true
}

export function getGridFieldTypeId(definition: CapturedGridFieldDefinition): number | null {
  const link = String(definition.type?.link || '')
  const match = /\/field-types\/(\d+)(?:[/?#]|$)/i.exec(link)
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

export function buildGridFormFieldDefinition(
  definition: CapturedGridFieldDefinition,
  required: boolean,
  options: { fieldId?: string; title?: string } = {}
): FormFieldDefinition | null {
  if (!definition || definition.derived || !isGridFieldVisible(definition)) return null
  const fieldId = (options.fieldId || String(definition.name || '').trim().toUpperCase()).trim()
  const title = (options.title || String(definition.label || definition.name || '').trim()).trim()
  if (!fieldId || !title || /^row id$/i.test(title)) return null
  const typeId = getGridFieldTypeId(definition)
  return {
    fieldId,
    title,
    description: String(definition.description || '').trim() || null,
    kind: inferColumnKindFromTypeId(typeId) || classifyColumnKind(definition.type?.title || title),
    typeId,
    picklistPath: definition.picklist ? normalizeApiUrlPath(String(definition.picklist)) : null,
    defaultValue: normalizeGridApiCellValue(definition.defaultValue) || null,
    defaultPayloadValue: extractGridApiLinkValue(definition.defaultValue) || null,
    fieldLength: parseGridFieldLength(definition.fieldLength),
    fieldPrecision: parseGridFieldPrecision(definition.fieldPrecision),
    unitOfMeasure: String(definition.unitOfMeasure || '').trim() || null,
    required,
    editable: isGridFieldEditable(definition),
    visible: true,
    displayOrder: Number.isFinite(Number(definition.displayOrder)) ? Number(definition.displayOrder) : Number.MAX_SAFE_INTEGER,
    fieldSelf: String(definition.__self__ || '').trim() || null,
    fieldUrn: String(definition.urn || '').trim() || null,
    typeLink: definition.type?.link ? normalizeApiUrlPath(String(definition.type.link)) : null,
    typeUrn: String(definition.type?.urn || '').trim() || null,
    typeTitle: String(definition.type?.title || '').trim() || null
  }
}

export function toGridPayloadType(field: FormFieldDefinition): string {
  if (isMultiLookupFieldType(field.typeId)) return 'multi-select'
  if (isRadioFieldType(field.typeId)) return 'radio'
  if (field.typeId === 28) return 'buom'
  if (isLookupFieldType(field.typeId)) return 'single-select'
  if (isIntegerFieldType(field.typeId)) return 'integer'
  if (isNumericFieldType(field.typeId) || field.kind === 'number') return 'number'
  if (isDateFieldType(field.typeId)) return 'date'
  return (field.kind as GridColumnKind) === 'date' ? 'date' : 'string'
}

export function resolveGridNumericBounds(field: FormFieldDefinition): GridNumericBounds {
  const precision =
    typeof field.fieldPrecision === 'number' && Number.isFinite(field.fieldPrecision) && field.fieldPrecision > 0
      ? Math.floor(field.fieldPrecision)
      : 0
  const length =
    typeof field.fieldLength === 'number' && Number.isFinite(field.fieldLength) && field.fieldLength > 0
      ? Math.floor(field.fieldLength)
      : null
  if (length === null) return { min: null, max: null, precision }
  const unit = precision > 0 ? Math.pow(10, -precision) : 1
  const maxAbs = Math.pow(10, Math.max(0, length)) - unit
  if (!Number.isFinite(maxAbs) || maxAbs < 0) return { min: null, max: null, precision }
  return { min: -maxAbs, max: maxAbs, precision }
}

export function normalizeGridPayloadValue(type: string, value: unknown): unknown {
  if (value == null || typeof value === 'object') return value
  const normalizedType = String(type || '').trim().toLowerCase()
  const normalizeNumeric = (rawValue: string, integerOnly: boolean): string => {
    let next = String(rawValue || '').trim()
    if (!next) return ''
    next = next.replace(/\s+/g, '').replace(/,/g, '').replace(/[^\d.\-]/g, '')
    if (!next || next === '-' || next === '.' || next === '-.') return ''
    const parsed = integerOnly ? Number.parseInt(next, 10) : Number(next)
    if (!Number.isFinite(parsed)) return String(rawValue || '').trim()
    return integerOnly ? String(Math.trunc(parsed)) : String(parsed)
  }
  if (normalizedType === 'multi-select') {
    return String(value || '').split(',').map((entry) => entry.trim()).filter(Boolean)
  }
  if (normalizedType === 'integer') return normalizeNumeric(String(value), true)
  if (normalizedType === 'number' || normalizedType === 'decimal' || normalizedType === 'money') return normalizeNumeric(String(value), false)
  return String(value)
}

export function isGridNumericPayloadType(type: string): boolean {
  const normalizedType = String(type || '').trim().toLowerCase()
  return normalizedType === 'integer' || normalizedType === 'number' || normalizedType === 'decimal' || normalizedType === 'money'
}

