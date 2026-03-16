import { inferColumnKindFromTypeId } from './fieldTypes'
import { classifyColumnKind } from './filterKind'
import { normalizeApiUrlPath } from './utils'
import type { BomCloneFormSection, BomCloneItemDetailSection, FormFieldDefinition } from '../../clone.types'

type WorkspaceFieldEntry = {
  __self__?: string
  urn?: string
  name?: string
  label?: string | null
  description?: string | null
  defaultValue?: unknown
  fieldLength?: number | null
  fieldPrecision?: number | null
  displayOrder?: number | null
  editability?: string
  visibility?: string
  formulaField?: boolean
  derived?: boolean
  unitOfMeasure?: string | null
  validators?: unknown
  fieldValidators?: unknown
  picklist?: string | null
  type?: {
    link?: string
    urn?: string
    title?: string
    id?: number | string
    deleted?: boolean
  } | string
}

type WorkspaceSectionFieldRef = {
  link?: string
  urn?: string
  type?: string
}

type WorkspaceSectionMatrix = {
  __self__?: string
  urn?: string
  fields?: WorkspaceSectionFieldRef[][]
}

type WorkspaceSectionEntry = {
  name?: string
  title?: string
  displayOrder?: number
  collapsed?: boolean
  fields?: WorkspaceSectionFieldRef[]
  matrices?: WorkspaceSectionMatrix[]
}

type OperationFormModel = {
  fields: FormFieldDefinition[]
  metaLinks: Record<string, string>
  sections: BomCloneFormSection[]
}

export type DescriptorFieldInference = {
  fieldId: string
  fieldTitle: string
  sampleValue: string
  position: number
}

const NON_EDITABLE_VALUES = new Set(['never', 'readonly', 'read_only', 'read only', 'hidden', 'disabled', 'locked'])

function extractArrayEntries<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is T => Boolean(entry && typeof entry === 'object'))
}

function extractFieldsPayload(payload: unknown): WorkspaceFieldEntry[] {
  if (Array.isArray(payload)) return extractArrayEntries<WorkspaceFieldEntry>(payload)
  if (!payload || typeof payload !== 'object') return []
  const record = payload as Record<string, unknown>
  if (Array.isArray(record.fields)) return extractArrayEntries<WorkspaceFieldEntry>(record.fields)
  return []
}

function extractSectionsPayload(payload: unknown): WorkspaceSectionEntry[] {
  if (Array.isArray(payload)) return extractArrayEntries<WorkspaceSectionEntry>(payload)
  if (!payload || typeof payload !== 'object') return []
  const record = payload as Record<string, unknown>
  if (Array.isArray(record.sections)) return extractArrayEntries<WorkspaceSectionEntry>(record.sections)
  return []
}

function fieldTokenFromPath(path: unknown): string | null {
  const text = String(path || '').trim()
  if (!text) return null
  const normalized = normalizeApiUrlPath(text)
  const match = /\/fields\/([^/?#]+)/i.exec(normalized)
  if (!match?.[1]) return null
  return decodeURIComponent(match[1]).trim()
}

function fieldTokenFromUrn(urn: unknown): string | null {
  const text = String(urn || '').trim()
  if (!text) return null
  const match = /\.([^.]+)$/.exec(text)
  if (!match?.[1]) return null
  return match[1].trim()
}

function resolveFieldId(field: WorkspaceFieldEntry): string {
  return (
    fieldTokenFromPath(field.__self__)
    || fieldTokenFromUrn(field.urn)
    || String(field.name || '').trim().toUpperCase().replace(/\s+/g, '_')
  )
}

function resolveTypeId(typeValue: unknown): number | null {
  if (!typeValue) return null
  if (typeof typeValue === 'string') {
    const fromLink = /\/field-types\/(\d+)(?:[/?#]|$)/i.exec(normalizeApiUrlPath(typeValue))
    const parsedFromLink = Number(fromLink?.[1] || '')
    return Number.isFinite(parsedFromLink) ? parsedFromLink : null
  }
  if (typeof typeValue !== 'object') return null
  const record = typeValue as Record<string, unknown>
  const link = String(record.link || '').trim()
  if (link) {
    const fromLink = /\/field-types\/(\d+)(?:[/?#]|$)/i.exec(normalizeApiUrlPath(link))
    const parsedFromLink = Number(fromLink?.[1] || '')
    if (Number.isFinite(parsedFromLink)) return parsedFromLink
  }
  const fromId = Number(record.id)
  return Number.isFinite(fromId) ? fromId : null
}

function stringifyDefaultValue(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => stringifyDefaultValue(entry))
      .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    return parts.length > 0 ? parts.join(', ') : null
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const preferred = record.title ?? record.name ?? record.value
    if (typeof preferred === 'string' && preferred.trim()) return preferred.trim()
    return null
  }
  return null
}

function extractDefaultPayloadValue(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const link = String(record.link || '').trim()
  if (!link) return null
  return normalizeApiUrlPath(link)
}

function hasRequiredValidator(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((entry) => hasRequiredValidator(entry))
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  const validatorName = String(record.validatorName || record.name || '').trim().toLowerCase()
  if (validatorName === 'required') return true
  return false
}

function toFormFieldDefinition(field: WorkspaceFieldEntry, fallbackOrder: number): FormFieldDefinition | null {
  const fieldId = resolveFieldId(field)
  const title = String(field.label || field.name || '').trim()
  if (!fieldId || !title) return null

  const typeId = resolveTypeId(field.type)
  const typeTitle = String(
    typeof field.type === 'object' && field.type
      ? field.type.title || ''
      : ''
  ).trim()
  const kind = inferColumnKindFromTypeId(typeId) || classifyColumnKind(typeTitle || 'text')
  const formulaField = field.formulaField === true || field.derived === true
  const editability = String(field.editability || '').trim().toLowerCase()
  const visibility = String(field.visibility || '').trim().toUpperCase()
  const selfLink = String(field.__self__ || '').trim()

  return {
    fieldId,
    title,
    description: field.description ?? null,
    formulaField,
    kind,
    typeId,
    picklistPath: field.picklist ? normalizeApiUrlPath(field.picklist) : null,
    defaultValue: stringifyDefaultValue(field.defaultValue),
    defaultPayloadValue: extractDefaultPayloadValue(field.defaultValue),
    fieldLength: typeof field.fieldLength === 'number' ? field.fieldLength : null,
    fieldPrecision: typeof field.fieldPrecision === 'number' ? field.fieldPrecision : null,
    unitOfMeasure: typeof field.unitOfMeasure === 'string' ? field.unitOfMeasure : null,
    required: hasRequiredValidator(field.fieldValidators) || hasRequiredValidator(field.validators),
    editable: !formulaField && !NON_EDITABLE_VALUES.has(editability),
    visible: visibility !== 'NEVER',
    displayOrder: typeof field.displayOrder === 'number' ? field.displayOrder : fallbackOrder,
    fieldSelf: selfLink ? normalizeApiUrlPath(selfLink) : null,
    fieldUrn: String(field.urn || '').trim() || null,
    typeLink: typeof field.type === 'object' ? normalizeApiUrlPath(String(field.type?.link || '')) || null : null,
    typeUrn: typeof field.type === 'object' ? String(field.type?.urn || '').trim() || null : null,
    typeTitle: typeTitle || null
  }
}

function parseMatrixId(value: unknown): string {
  const text = String(value || '').trim()
  if (!text) return ''
  const normalized = normalizeApiUrlPath(text)
  const match = /\/matrices\/([^/?#]+)/i.exec(normalized)
  return match?.[1] ? decodeURIComponent(match[1]).trim() : ''
}

function collectSectionFieldIdsInOrder(section: WorkspaceSectionEntry): string[] {
  const matrixById = new Map<string, WorkspaceSectionMatrix>()
  for (const matrix of extractArrayEntries<WorkspaceSectionMatrix>(section.matrices)) {
    const matrixId = parseMatrixId(matrix.__self__) || parseMatrixId(matrix.urn)
    if (matrixId) matrixById.set(matrixId, matrix)
  }

  const ordered: string[] = []
  const seen = new Set<string>()
  const pushFieldId = (fieldId: string | null): void => {
    if (!fieldId || seen.has(fieldId)) return
    seen.add(fieldId)
    ordered.push(fieldId)
  }

  for (const fieldRef of extractArrayEntries<WorkspaceSectionFieldRef>(section.fields)) {
    const refType = String(fieldRef.type || '').trim().toUpperCase()
    if (refType === 'FIELD') {
      pushFieldId(fieldTokenFromPath(fieldRef.link) || fieldTokenFromUrn(fieldRef.urn))
      continue
    }

    if (refType === 'MATRIX') {
      const matrixId = parseMatrixId(fieldRef.link) || parseMatrixId(fieldRef.urn)
      const matrix = matrixById.get(matrixId)
      if (!matrix) continue
      const rows = Array.isArray(matrix.fields) ? matrix.fields : []
      for (const row of rows) {
        const cells = Array.isArray(row) ? row : []
        for (const cell of cells) {
          if (!cell || typeof cell !== 'object') continue
          const typedCell = cell as WorkspaceSectionFieldRef
          pushFieldId(fieldTokenFromPath(typedCell.link) || fieldTokenFromUrn(typedCell.urn))
        }
      }
    }
  }

  return ordered
}

function buildSectionLayout(
  sections: WorkspaceSectionEntry[],
  knownFieldIds: Set<string>
): BomCloneFormSection[] {
  const sortedSections = [...sections].sort((left, right) => {
    const leftOrder = Number.isFinite(left.displayOrder) ? Number(left.displayOrder) : Number.MAX_SAFE_INTEGER
    const rightOrder = Number.isFinite(right.displayOrder) ? Number(right.displayOrder) : Number.MAX_SAFE_INTEGER
    return leftOrder - rightOrder
  })

  const normalized: BomCloneFormSection[] = []
  for (const section of sortedSections) {
    const title = String(section.title || section.name || 'Section').trim() || 'Section'
    const fieldIds = collectSectionFieldIdsInOrder(section).filter((fieldId) => knownFieldIds.has(fieldId))
    if (fieldIds.length === 0) continue
    normalized.push({
      title,
      expandedByDefault: section.collapsed !== true,
      fieldIds
    })
  }
  return normalized
}

export function buildOperationFormModel(
  fieldsPayload: unknown,
  sectionsPayload: unknown
): OperationFormModel {
  const fieldEntries = extractFieldsPayload(fieldsPayload)
  const definitions: FormFieldDefinition[] = []
  const metaLinks: Record<string, string> = {}
  let fallbackOrder = 0
  for (const entry of fieldEntries) {
    const definition = toFormFieldDefinition(entry, fallbackOrder)
    fallbackOrder += 1
    if (!definition) continue
    definitions.push(definition)
    if (definition.fieldSelf) metaLinks[definition.fieldId] = definition.fieldSelf
  }

  definitions.sort((left, right) => left.displayOrder - right.displayOrder)
  const sections = buildSectionLayout(extractSectionsPayload(sectionsPayload), new Set(definitions.map((field) => field.fieldId)))

  return {
    fields: definitions,
    metaLinks,
    sections
  }
}

function normalizeDescriptorSeed(value: string): string {
  return String(value || '')
    .replace(/\s*\[REV:[^\]]+\]\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeLabelToken(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .trim()
}

function getDetailRowValueByLabel(sections: BomCloneItemDetailSection[]): Map<string, string> {
  const valueByLabel = new Map<string, string>()
  for (const section of sections) {
    for (const row of section.rows) {
      const normalizedLabel = normalizeLabelToken(row.label)
      const normalizedValue = String(row.value || '').trim()
      if (!normalizedLabel || !normalizedValue || normalizedValue === '-') continue
      if (!valueByLabel.has(normalizedLabel)) valueByLabel.set(normalizedLabel, normalizedValue)
    }
  }
  return valueByLabel
}

export function inferDescriptorFieldsFromSelectedItem(params: {
  descriptorTitle: string
  detailSections: BomCloneItemDetailSection[]
  fields: FormFieldDefinition[]
}): DescriptorFieldInference[] {
  const descriptorTitle = normalizeDescriptorSeed(params.descriptorTitle)
  if (!descriptorTitle) return []

  const descriptorLower = descriptorTitle.toLowerCase()
  const detailsByLabel = getDetailRowValueByLabel(params.detailSections)
  const result: DescriptorFieldInference[] = []
  const seenFieldIds = new Set<string>()

  for (const field of params.fields) {
    if (field.formulaField) continue
    const titleKey = normalizeLabelToken(field.title)
    const idKey = normalizeLabelToken(field.fieldId)
    const detailValue = detailsByLabel.get(titleKey) || detailsByLabel.get(idKey) || ''
    if (!detailValue) continue
    const valueLower = detailValue.toLowerCase()
    const position = descriptorLower.indexOf(valueLower)
    if (position < 0) continue
    if (seenFieldIds.has(field.fieldId)) continue
    seenFieldIds.add(field.fieldId)
    result.push({
      fieldId: field.fieldId,
      fieldTitle: field.title,
      sampleValue: detailValue,
      position
    })
  }

  result.sort((left, right) => left.position - right.position || right.sampleValue.length - left.sampleValue.length)
  return result
}


