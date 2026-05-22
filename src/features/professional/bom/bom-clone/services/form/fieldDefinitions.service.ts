import { inferColumnKindFromTypeId } from './fieldTypes'
import { normalizeApiUrlPath } from './utils'
import { classifyColumnKind } from './filterKind'
import type { FormFieldDefinition } from './types'
import { uniquePositiveIntegers } from './viewDefIds'
import { parseViewDefFieldIdFromLink, parseViewDefIdFromLink } from './viewDefLinks'

/**
 * Service-layer loader for BOM view field metadata used by clone edit flows.
 * Kept in services/ because it performs API-response normalization and field
 * metadata transformation, not rendering.
 */

type BomViewFieldEntry = {
  __self__?: string | { link?: string; urn?: string; [key: string]: unknown }
  fieldId?: string
  displayName?: string
  description?: string | null
  formulaField?: boolean
  derived?: boolean
  required?: boolean
  validations?: unknown
  type?: string | { link?: string; urn?: string; title?: string; id?: number | string }
  editability?: string
  visibility?: string
  fieldTab?: string
  validators?: unknown
  lookups?: string | null
  defaultValue?: string | null
  fieldLength?: number | null
  fieldPrecision?: number | null
  unitOfMeasure?: string | null
  displayOrder?: number | null
}

type BomViewEntry = {
  id?: number | string
  link?: string
  __self__?: { link?: string; urn?: string } | string
}

export type BomViewFieldsResult = {
  fields: FormFieldDefinition[]
  metaLinks: Record<string, string>
  viewDefFieldIdToFieldId: Record<string, string>
  firstViewDefId: number | null
  viewDefIds: number[]
  validatorCount: number
}

export type BomViewFieldsProgress = {
  phase: 'fields'
  current: number
  total: number
}

type LoadBomViewFieldsOptions = {
  onProgress?: (progress: BomViewFieldsProgress) => void
}

type RequestFn = (action: string, payload: Record<string, unknown>) => Promise<unknown>

const NON_EDITABLE_VALUES = new Set(['never', 'readonly', 'read_only', 'read only', 'hidden', 'disabled', 'locked'])

function normalizeFieldTab(value: unknown): string {
  return String(value || '').trim().toUpperCase()
}

function isEditableBomTab(tab: string): boolean {
  return tab === 'CUSTOM_BOM' || tab === 'STANDARD_BOM'
}

function extractTypeId(typeValue: unknown): number | null {
  const readTypeToken = (raw: unknown): string => String(raw || '').trim()

  const parseTypeToken = (token: string): number | null => {
    if (!token) return null
    const normalized = normalizeApiUrlPath(token)
    const match = /\/field-types\/(\d+)(?:[/?#]|$)/i.exec(normalized)
    if (!match) return null
    const id = Number(match[1])
    return Number.isFinite(id) ? id : null
  }

  if (typeof typeValue === 'string') return parseTypeToken(typeValue)
  if (!typeValue || typeof typeValue !== 'object') return null

  const record = typeValue as Record<string, unknown>
  const fromLink = parseTypeToken(readTypeToken(record.link))
  if (fromLink !== null) return fromLink
  const fromUrn = parseTypeToken(readTypeToken(record.urn))
  if (fromUrn !== null) return fromUrn
  const fromId = Number(record.id)
  return Number.isFinite(fromId) ? fromId : null
}

function extractFieldEntries(data: unknown): BomViewFieldEntry[] {
  if (!data) return []
  if (Array.isArray(data)) return data as BomViewFieldEntry[]
  if (typeof data !== 'object') return []
  const record = data as Record<string, unknown>
  const arrayProps = ['viewfields', 'viewFields', 'fields', 'items', 'data', 'results', 'entries']
  for (const prop of arrayProps) {
    if (Array.isArray(record[prop]) && (record[prop] as unknown[]).length > 0) {
      return record[prop] as BomViewFieldEntry[]
    }
  }
  return []
}

function hasRequiredValidator(data: unknown): boolean {
  if (!data) return false
  if (Array.isArray(data)) return data.some((entry) => hasRequiredValidator(entry))
  if (typeof data !== 'object') return String(data).trim().toLowerCase() === 'required'
  const record = data as Record<string, unknown>
  const name = String(record.validatorName || record.name || '').trim().toLowerCase()
  if (name === 'required') return true
  if (Array.isArray(record.validators)) return record.validators.some((entry) => hasRequiredValidator(entry))
  return false
}

function getFieldSelfLink(field: BomViewFieldEntry): string {
  const rawSelf = field.__self__
  if (typeof rawSelf === 'string') return String(rawSelf || '').trim()
  if (rawSelf && typeof rawSelf === 'object') {
    return String((rawSelf as { link?: string }).link || '').trim()
  }
  return ''
}

function resolveViewDefFieldId(field: BomViewFieldEntry): string {
  const selfLink = getFieldSelfLink(field)
  const fromSelf = parseViewDefFieldIdFromLink(selfLink)
  if (fromSelf) return fromSelf
  return String(field.fieldId || '').trim()
}

function resolveLogicalFieldId(field: BomViewFieldEntry): string {
  const direct = String(field.fieldId || '').trim()
  if (direct) return direct
  return resolveViewDefFieldId(field)
}

function parseViewDefIdFromEntry(entry: Record<string, unknown>): number | null {
  const directId = Number(entry.id)
  if (Number.isFinite(directId) && directId > 0) return Math.floor(directId)
  const self = entry.__self__
  if (typeof self === 'string') {
    const fromSelf = parseViewDefIdFromLink(self)
    if (fromSelf !== null) return fromSelf
  }
  if (self && typeof self === 'object') {
    const selfLink = String((self as { link?: string }).link || '')
    const fromSelfLink = parseViewDefIdFromLink(selfLink)
    if (fromSelfLink !== null) return fromSelfLink
  }
  return parseViewDefIdFromLink(entry.link)
}

function resolveValidatorsLink(field: BomViewFieldEntry): string | null {
  if (typeof field.validators === 'string' && field.validators.trim()) {
    return normalizeApiUrlPath(field.validators.trim())
  }
  if (field.validators && typeof field.validators === 'object') {
    const link = String((field.validators as { link?: string }).link || '').trim()
    if (link) return normalizeApiUrlPath(link)
  }
  return null
}

async function throttledAll<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
  onSettled?: (index: number) => void
): Promise<T[]> {
  if (tasks.length === 0) return []
  const results: T[] = new Array(tasks.length)
  let index = 0

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const current = index++
      try {
        results[current] = await tasks[current]()
      } finally {
        if (onSettled) onSettled(current)
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), tasks.length) }, () => worker()))
  return results
}

export async function loadBomViewFields(
  workspaceId: number,
  tenant: string,
  requestFn: RequestFn,
  options: LoadBomViewFieldsOptions = {}
): Promise<BomViewFieldsResult> {
  let firstViewDefId: number | null = null
  const rawFieldsByViewDef: BomViewFieldEntry[][] = []
  const discoveredViewDefIds: number[] = []
  try {
    const viewsResponse = await requestFn('getBomViews', { tenant, wsId: workspaceId })
    const viewsRecord = viewsResponse && typeof viewsResponse === 'object'
      ? (viewsResponse as Record<string, unknown>)
      : {}
    const dataRecord = viewsRecord.data && typeof viewsRecord.data === 'object'
      ? (viewsRecord.data as Record<string, unknown>)
      : {}
    const rawViews = Array.isArray(dataRecord.bomViews)
      ? (dataRecord.bomViews as BomViewEntry[])
      : Array.isArray((viewsRecord as Record<string, unknown>).bomViews)
        ? ((viewsRecord as Record<string, unknown>).bomViews as BomViewEntry[])
        : []

    const viewDefIds = uniquePositiveIntegers(
      rawViews
        .map((entry) => parseViewDefIdFromEntry(entry as unknown as Record<string, unknown>))
        .filter((value): value is number => value !== null)
    )

    if (firstViewDefId === null && viewDefIds.length > 0) firstViewDefId = viewDefIds[0]

    const total = Math.max(1, viewDefIds.length)
    if (options.onProgress) options.onProgress({ phase: 'fields', current: 1, total })
    let completed = 0
    const fallbackFields = await throttledAll(
      viewDefIds.map((viewDefId) => async (): Promise<BomViewFieldEntry[]> => {
        try {
          const fieldResponse = await requestFn('getBomViewFields', {
            tenant,
            wsId: workspaceId,
            viewId: viewDefId
          })
          return extractFieldEntries(fieldResponse)
        } catch {
          return []
        }
      }),
      10,
      () => {
        completed += 1
        if (options.onProgress) options.onProgress({ phase: 'fields', current: Math.max(1, completed), total })
      }
    )

    for (let index = 0; index < fallbackFields.length; index += 1) {
      const fields = fallbackFields[index]
      const viewDefId = viewDefIds[index]
      if (fields.length > 0) rawFieldsByViewDef.push(fields)
      if (fields.length > 0) discoveredViewDefIds.push(viewDefId)
    }
  } catch {
    // Fallback to combined endpoint if per-view loading fails.
    try {
      const response = await requestFn('getBomViewsAndFields', { tenant, wsId: workspaceId })
      const record = response && typeof response === 'object' ? (response as Record<string, unknown>) : {}
      const viewdefs = Array.isArray(record.data) ? (record.data as Record<string, unknown>[]) : []

      for (const entry of viewdefs) {
        const detail = entry.data && typeof entry.data === 'object' ? (entry.data as Record<string, unknown>) : entry
        const entryViewDefId = parseViewDefIdFromEntry(detail)
        if (entryViewDefId !== null) discoveredViewDefIds.push(entryViewDefId)

        const fieldsWrapper = entry.fields && typeof entry.fields === 'object'
          ? (entry.fields as Record<string, unknown>)
          : {}
        const fields = extractFieldEntries(fieldsWrapper.data ?? entry.fields)
        if (fields.length > 0) rawFieldsByViewDef.push(fields)
        if (entryViewDefId !== null && firstViewDefId === null) firstViewDefId = entryViewDefId
      }
      if (options.onProgress) options.onProgress({ phase: 'fields', current: 1, total: 1 })
    } catch {
      // Ignore; caller can handle empty field list.
    }
  }

  const fieldMap = new Map<string, BomViewFieldEntry>()
  const viewDefFieldIdToFieldId: Record<string, string> = {}
  for (const fields of rawFieldsByViewDef) {
    for (const field of fields) {
      const viewDefFieldId = resolveViewDefFieldId(field)
      const logicalFieldId = resolveLogicalFieldId(field)
      if (viewDefFieldId && logicalFieldId) viewDefFieldIdToFieldId[viewDefFieldId] = logicalFieldId
      const fieldId = logicalFieldId || viewDefFieldId
      if (!fieldId) continue

      const existing = fieldMap.get(fieldId)
      if (!existing) {
        fieldMap.set(fieldId, field)
        continue
      }

      const existingIsEditableTab = isEditableBomTab(normalizeFieldTab(existing.fieldTab))
      const candidateIsEditableTab = isEditableBomTab(normalizeFieldTab(field.fieldTab))
      if (!existingIsEditableTab && candidateIsEditableTab) fieldMap.set(fieldId, field)
    }
  }

  const uniqueFields = Array.from(fieldMap.values())
  const validatorLinks = new Set<string>()
  for (const fields of rawFieldsByViewDef) {
    for (const field of fields) {
      const validatorsLink = resolveValidatorsLink(field)
      if (validatorsLink) validatorLinks.add(validatorsLink)
    }
  }

  const definitions: FormFieldDefinition[] = []
  const metaLinks: Record<string, string> = {}
  let fallbackOrder = 0

  for (const field of uniqueFields) {
    const tab = normalizeFieldTab(field.fieldTab)
    const editableTab = isEditableBomTab(tab)

    const fieldId = resolveLogicalFieldId(field)
    const title = String(field.displayName || '').trim()
    if (!fieldId || !title) continue

    const typeId = extractTypeId(field.type)
    const typeTitle = String(
      field.type && typeof field.type === 'object'
        ? ((field.type as { title?: string }).title || '')
        : ''
    ).trim()
    const kindFromTypeId = inferColumnKindFromTypeId(typeId)
    const kindFromTypeTitle = typeTitle ? classifyColumnKind(typeTitle) : null
    const kind = kindFromTypeTitle === 'boolean'
      ? 'boolean'
      : kindFromTypeId || kindFromTypeTitle || 'text'
    const editability = String(field.editability || '').toLowerCase().trim()
    const visibility = String(field.visibility || '').toLowerCase().trim()
    const editable = editableTab && !NON_EDITABLE_VALUES.has(editability)
    const visible = visibility !== 'hidden'
    const picklistPath = field.lookups ? normalizeApiUrlPath(field.lookups) : null

    const required =
      editability === 'required' ||
      field.required === true ||
      hasRequiredValidator(field.validators) ||
      hasRequiredValidator(field.validations)

    const selfLink = getFieldSelfLink(field)
    if (selfLink) metaLinks[fieldId] = normalizeApiUrlPath(selfLink)

    definitions.push({
      fieldId,
      title,
      description: field.description ?? null,
      formulaField: field.formulaField === true || field.derived === true,
      kind,
      typeId,
      picklistPath,
      defaultValue: field.defaultValue ?? null,
      defaultPayloadValue: null,
      fieldLength: field.fieldLength ?? null,
      fieldPrecision: field.fieldPrecision ?? null,
      unitOfMeasure: field.unitOfMeasure ?? null,
      required,
      editable,
      visible,
      displayOrder: typeof field.displayOrder === 'number' ? field.displayOrder : fallbackOrder,
      typeLink: field.type
        ? normalizeApiUrlPath(String(typeof field.type === 'string' ? field.type : field.type.link || ''))
        : null,
      typeUrn: field.type && typeof field.type === 'object' ? String(field.type.urn || '').trim() || null : null,
      typeTitle: typeTitle || null
    })

    fallbackOrder += 1
  }

  definitions.sort((left, right) => left.displayOrder - right.displayOrder)
  const viewDefIds = uniquePositiveIntegers(discoveredViewDefIds)
  return {
    fields: definitions,
    metaLinks,
    viewDefFieldIdToFieldId,
    firstViewDefId: firstViewDefId ?? (viewDefIds[0] ?? null),
    viewDefIds,
    validatorCount: validatorLinks.size
  }
}


