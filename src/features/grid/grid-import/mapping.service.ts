import type { CapturedGridFieldDefinition, CapturedGridFieldsPayload, FormFieldDefinition } from '../grid-advanced-editor/types'
import {
  buildGridFormFieldDefinition,
  isGridFieldEditable,
  isGridFieldVisible,
  normalizeGridApiCellValue,
  resolveGridFieldId
} from '../grid-services/gridFieldMetadata'
import type { GridImportField, GridImportMapping } from './types'

function normalizeHeader(value: string): string {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
}

function collectPicklistValues(source: unknown, values: Set<string>): void {
  if (!source) return
  if (Array.isArray(source)) {
    for (const entry of source) collectPicklistValues(entry, values)
    return
  }
  if (typeof source !== 'object') return
  const record = source as Record<string, unknown>
  for (const key of ['title', 'label', 'name', 'displayValue', 'value']) {
    const value = normalizeGridApiCellValue(record[key])
    if (value && !/^\/api\/v3\//i.test(value)) values.add(value)
  }
  for (const key of ['options', 'values', 'items', 'data', 'results', 'picklistValues']) {
    collectPicklistValues(record[key], values)
  }
}

export function buildImportableFields(
  payload: CapturedGridFieldsPayload | null,
  formFields: FormFieldDefinition[] = [],
  isRequired: (definition: CapturedGridFieldDefinition) => boolean = () => false
): GridImportField[] {
  const formFieldById = new Map(formFields.map((field) => [field.fieldId.toUpperCase(), field]))
  const formFieldByTitle = new Map(formFields.map((field) => [String(field.title || '').trim().toLowerCase(), field]))
  const importable: GridImportField[] = []
  const fields = Array.isArray(payload?.fields) ? payload.fields : []

  for (const raw of fields) {
    if (!raw || !isGridFieldVisible(raw) || !isGridFieldEditable(raw)) continue
    const fieldId = resolveGridFieldId(raw)
    if (!fieldId) continue
    const matchedField = formFieldById.get(fieldId) || formFieldByTitle.get(String(raw.name || raw.label || '').trim().toLowerCase())
    const field = matchedField
      ? {
          ...matchedField,
          fieldId,
          fieldSelf: String(raw.__self__ || matchedField.fieldSelf || '').trim() || null,
          fieldUrn: String(raw.urn || matchedField.fieldUrn || '').trim() || null
        }
      : buildGridFormFieldDefinition(raw, isRequired(raw), {
        fieldId,
        title: String(raw.name || raw.label || '').trim()
      })
    if (!field || !field.editable || !field.visible) continue
    const name = String(raw.name || field.title || '').trim()
    if (!name) continue
    const allowedPicklistValues = new Set<string>()
    collectPicklistValues(raw.picklistFieldDefinition, allowedPicklistValues)
    importable.push({
      fieldId,
      name,
      field,
      raw,
      allowedPicklistValues: Array.from(allowedPicklistValues.values()).sort((a, b) => a.localeCompare(b))
    })
  }

  importable.sort((left, right) => left.field.displayOrder - right.field.displayOrder || left.name.localeCompare(right.name))
  return importable
}

export function createAutoMapping(headers: string[], fields: GridImportField[]): GridImportMapping[] {
  const headerByNormalized = new Map<string, string>()
  for (const header of headers) {
    const normalized = normalizeHeader(header)
    if (!normalized || headerByNormalized.has(normalized)) continue
    headerByNormalized.set(normalized, header)
  }
  return fields.map((field) => ({
    fieldId: field.fieldId,
    header: headerByNormalized.get(normalizeHeader(field.name)) || ''
  }))
}

export function validateImportMapping(headers: string[], fields: GridImportField[], mapping: GridImportMapping[]): string[] {
  const issues: string[] = []
  const headerCounts = new Map<string, number>()
  const headerSet = new Set(headers)
  for (const header of headers) {
    const normalized = normalizeHeader(header)
    if (!normalized) continue
    headerCounts.set(normalized, (headerCounts.get(normalized) || 0) + 1)
  }
  for (const [header, count] of headerCounts.entries()) {
    if (count > 1) issues.push(`Duplicate CSV header: ${header}`)
  }

  const fieldById = new Map(fields.map((field) => [field.fieldId, field]))
  const mappedHeaders = new Map<string, string>()
  for (const entry of mapping) {
    const field = fieldById.get(entry.fieldId)
    if (!field) continue
    const header = String(entry.header || '').trim()
    if (!header) {
      if (field.field.required) issues.push(`Required field is not mapped: ${field.name}`)
      continue
    }
    if (!headerSet.has(header)) {
      issues.push(`Mapped header does not exist: ${header}`)
      continue
    }
    const normalized = normalizeHeader(header)
    const existingField = mappedHeaders.get(normalized)
    if (existingField) issues.push(`CSV header "${header}" is mapped to multiple fields: ${existingField}, ${field.name}`)
    else mappedHeaders.set(normalized, field.name)
  }

  return issues
}

export function getMappedFieldForHeader(
  fields: GridImportField[],
  mapping: GridImportMapping[],
  header: string
): GridImportField | null {
  const fieldById = new Map(fields.map((field) => [field.fieldId, field]))
  const entry = mapping.find((item) => item.header === header)
  return entry ? fieldById.get(entry.fieldId) || null : null
}

