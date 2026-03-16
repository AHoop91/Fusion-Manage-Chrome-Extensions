import { classifyColumnKind } from '../../filters/filterEngine'
import { parseGridRouteContext } from '../../filters/data'
import { normalizeText } from '../../../../shared/utils/text'
import { decodeHtmlEntities, normalizeApiUrlPath, normalizeFieldToken, stripHtml } from './utils'
import { inferColumnKindFromTypeId, isLookupFieldType, isLookupPayloadValue } from './fieldTypes'
import type {
  ApiRowProjection,
  ApiTableColumn,
  CapturedGridFieldDefinition,
  CapturedGridFieldsPayload,
  CapturedGridRow,
  CapturedGridRowField,
  CapturedGridRowsPayload,
  FormFieldDefinition,
  MatchedFormField,
  SelectedRowModel
} from '../types'
import type { GridMetadataCache } from './gridMetadataCache'

/**
 * Read-only repository for API-backed grid metadata and row value projection.
 */
export interface GridDataRepository {
  /**
   * Returns API table columns for the active grid context.
   */
  getApiTableColumns: () => ApiTableColumn[]
  /**
   * Returns matched form fields from column definitions.
   */
  getMatchedFields: (columns: ApiTableColumn[]) => MatchedFormField[]
  /**
   * Returns projected API row dataset for active context.
   */
  getApiRows: () => ApiRowProjection[]
  /**
   * Projects API row payload into normalized row projections.
   */
  buildApiRowProjections: (payload: CapturedGridRowsPayload | null) => ApiRowProjection[]
  /**
   * Resolves display value for a field in a row model.
   */
  resolveFieldDisplayValue: (
    model: SelectedRowModel,
    column: ApiTableColumn,
    pending?: Map<number, Map<string, string>>
  ) => string
  /**
   * Resolves payload value for a field in a row model.
   */
  resolveFieldPayloadValue: (model: SelectedRowModel, column: ApiTableColumn) => string
  /**
   * Returns raw fields payload for the current grid context.
   */
  getGridFieldsPayloadForCurrentGrid: () => CapturedGridFieldsPayload | null
  /**
   * Returns raw rows payload for the current grid context.
   */
  getGridRowsPayloadForCurrentGrid: () => CapturedGridRowsPayload | null
  /**
   * Converts UI date values to yyyy-mm-dd input format.
   */
  parseDateToInputValue: (rawValue: string) => string
}

function parseDateToInputValue(rawValue: string): string {
  const value = String(rawValue || '').trim()
  if (!value) return ''

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (isoMatch) return value

  const usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value)
  if (!usMatch) return ''
  const month = usMatch[1].padStart(2, '0')
  const day = usMatch[2].padStart(2, '0')
  return `${usMatch[3]}-${month}-${day}`
}

function resolveApiFieldId(rawField: CapturedGridRowField): string {
  const selfValue = String(rawField.__self__ || '')
  const fromSelf = /\/fields\/([^/?#]+)/i.exec(selfValue)?.[1]
  if (fromSelf) return decodeURIComponent(fromSelf).trim().toUpperCase()

  const urnValue = String(rawField.urn || '')
  const fromUrn = urnValue.split('.').at(-1)
  return String(fromUrn || '').trim().toUpperCase()
}

function normalizeApiCellValue(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string') return stripHtml(decodeHtmlEntities(value)).trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeApiCellValue(entry))
      .map((entry) => entry.trim())
      .filter(Boolean)
      .join(', ')
  }

  if (typeof value !== 'object') return String(value)

  const record = value as Record<string, unknown>
  const titleLikeKeys = ['title', 'label', 'name', 'displayValue', 'display']
  for (const key of titleLikeKeys) {
    const text = normalizeApiCellValue(record[key])
    if (text) return text
  }

  const collectionKeys = ['value', 'values', 'items', 'options', 'results', 'selectedValues', 'data']
  for (const key of collectionKeys) {
    if (!(key in record)) continue
    const normalized = normalizeApiCellValue(record[key])
    if (normalized) return normalized
  }

  for (const [key, entry] of Object.entries(record)) {
    if (/^(?:link|urn|__self__|deleted|type)$/i.test(key)) continue
    const normalized = normalizeApiCellValue(entry)
    if (normalized) return normalized
  }

  return ''
}

function extractApiLinkValue(value: unknown): string | null {
  if (!value) return null
  if (Array.isArray(value)) {
    const links: string[] = []
    for (const item of value) {
      const next = extractApiLinkValue(item)
      if (next) links.push(next)
    }
    if (links.length === 0) return null
    return links.join(',')
  }
  if (typeof value !== 'object') {
    const raw = String(value).trim()
    return raw && isLookupPayloadValue(raw) ? raw : null
  }
  const record = value as Record<string, unknown>
  const link = String(record.link || '').trim()
  if (link.startsWith('/api/v3/')) return link

  const collectionKeys = ['value', 'values', 'items', 'options', 'results', 'selectedValues', 'data']
  for (const key of collectionKeys) {
    if (!(key in record)) continue
    const nested = extractApiLinkValue(record[key])
    if (nested) return nested
  }

  for (const entry of Object.values(record)) {
    const nested = extractApiLinkValue(entry)
    if (nested) return nested
  }

  return null
}

function parseFieldLength(value: unknown): number | null {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return Math.floor(numeric)
}

function parseFieldPrecision(value: unknown): number | null {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric < 0) return null
  return Math.floor(numeric)
}

function isFieldVisible(definition: CapturedGridFieldDefinition): boolean {
  const visibility = String(definition.visibility || '').toUpperCase().trim()
  return !visibility || visibility === 'ALWAYS'
}

function isFieldEditable(definition: CapturedGridFieldDefinition): boolean {
  const editability = String(definition.editability || '').toUpperCase()
  return !editability || editability === 'ALWAYS'
}

function getFieldTypeId(definition: CapturedGridFieldDefinition): number | null {
  const link = String(definition.type?.link || '')
  const match = /\/field-types\/(\d+)(?:[/?#]|$)/i.exec(link)
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

function buildApiRowIdentity(index: number, byFieldId: Map<string, string>, row: CapturedGridRow): string {
  const rowId = String(row.rowID ?? '').trim()
  if (rowId) return `row-id:${rowId}`
  const numberValue = String(byFieldId.get('NUMBER') || '').trim()
  if (numberValue) return `number:${normalizeText(numberValue)}`
  const titleValue = String(byFieldId.get('TITLE') || '').trim()
  if (titleValue) return `title:${normalizeText(titleValue)}`
  return `index:${index}`
}

function resolveApiRowId(row: CapturedGridRow): string | null {
  const rowData = Array.isArray(row.rowData) ? row.rowData : []
  for (const rawField of rowData) {
    const selfValue = String(rawField.__self__ || '')
    const fromSelf = /\/rows\/(\d+)(?:[/?#]|$)/i.exec(selfValue)?.[1]
    if (fromSelf) return fromSelf
  }

  const rawRowId = String(row.rowID ?? '').trim()
  if (/^\d+$/.test(rawRowId)) return rawRowId
  return null
}

function buildApiRowProjections(payload: CapturedGridRowsPayload | null): ApiRowProjection[] {
  if (!payload || !Array.isArray(payload.rows)) return []
  const projections: ApiRowProjection[] = []

  for (let index = 0; index < payload.rows.length; index += 1) {
    const row = payload.rows[index]
    if (!row || !Array.isArray(row.rowData)) continue

    const byFieldId = new Map<string, string>()
    const byFieldLink = new Map<string, string>()
    const byTitle = new Map<string, string>()
    for (const rawField of row.rowData) {
      if (!rawField || rawField.formulaField) continue
      const title = String(rawField.title || '').trim()
      if (/^row id$/i.test(title)) continue

      const fieldId = resolveApiFieldId(rawField)
      const value = normalizeApiCellValue(rawField.value)
      const linkValue = extractApiLinkValue(rawField.value)
      if (!value && !fieldId && !title) continue

      if (fieldId) byFieldId.set(fieldId, value)
      if (fieldId && linkValue) byFieldLink.set(fieldId, linkValue)
      if (title) byTitle.set(normalizeFieldToken(title), value)
    }

    projections.push({
      index,
      identity: buildApiRowIdentity(index, byFieldId, row),
      rowId: resolveApiRowId(row),
      byFieldId,
      byFieldLink,
      byTitle
    })
  }

  return projections
}

/**
 * Creates read-only repository abstractions for grid fields and rows.
 */
export function createGridDataRepository(metadataCache: GridMetadataCache): GridDataRepository {
  function getGridFieldsPayloadForCurrentGrid(): CapturedGridFieldsPayload | null {
    const route = parseGridRouteContext(window.location.href)
    if (!route) return null
    return metadataCache.getGridFieldsPayloadForCurrentGrid()
  }

  function getGridRowsPayloadForCurrentGrid(): CapturedGridRowsPayload | null {
    const route = parseGridRouteContext(window.location.href)
    if (!route) return null
    return metadataCache.getGridRowsPayloadForCurrentGrid()
  }

  function getApiTableColumns(): ApiTableColumn[] {
    const payload = getGridFieldsPayloadForCurrentGrid()
    if (!payload || !Array.isArray(payload.fields)) return []
    void metadataCache.hydrateRequiredValidatorsForFields(payload.fields)
    const dedup = new Set<string>()
    const columns: ApiTableColumn[] = []
    for (const definition of payload.fields) {
      if (!definition || definition.derived) continue
      if (!isFieldVisible(definition)) continue

      const fieldId = String(definition.name || '').trim().toUpperCase()
      if (!fieldId || dedup.has(fieldId)) continue
      dedup.add(fieldId)

      const title = String(definition.label || definition.name || '').trim()
      if (!title || /^row id$/i.test(title)) continue

      const field: FormFieldDefinition = {
        fieldId,
        title,
        description: String(definition.description || '').trim() || null,
        kind: inferColumnKindFromTypeId(getFieldTypeId(definition)) || classifyColumnKind(definition.type?.title || title),
        typeId: getFieldTypeId(definition),
        picklistPath: definition.picklist ? normalizeApiUrlPath(String(definition.picklist)) : null,
        defaultValue: normalizeApiCellValue(definition.defaultValue) || null,
        defaultPayloadValue: extractApiLinkValue(definition.defaultValue) || null,
        fieldLength: parseFieldLength(definition.fieldLength),
        fieldPrecision: parseFieldPrecision(definition.fieldPrecision),
        unitOfMeasure: String(definition.unitOfMeasure || '').trim() || null,
        required: metadataCache.isFieldRequired(definition),
        editable: isFieldEditable(definition),
        visible: true,
        displayOrder: Number.isFinite(Number(definition.displayOrder))
          ? Number(definition.displayOrder)
          : Number.MAX_SAFE_INTEGER,
        fieldSelf: String(definition.__self__ || '').trim() || null,
        fieldUrn: String(definition.urn || '').trim() || null,
        typeLink: definition.type?.link ? normalizeApiUrlPath(String(definition.type.link)) : null,
        typeUrn: String(definition.type?.urn || '').trim() || null,
        typeTitle: String(definition.type?.title || '').trim() || null
      }

      columns.push({
        field,
        columnIndex: null
      })
    }

    columns.sort((left, right) => left.field.displayOrder - right.field.displayOrder || left.field.title.localeCompare(right.field.title))
    return columns
  }

  function getMatchedFields(columns: ApiTableColumn[]): MatchedFormField[] {
    return columns.map((column) => ({
      field: column.field,
      columnIndex: Number.isFinite(column.columnIndex) ? Number(column.columnIndex) : null
    }))
  }

  function getApiRows(): ApiRowProjection[] {
    return buildApiRowProjections(getGridRowsPayloadForCurrentGrid())
  }

  function resolveFieldValueForSelectedRow(row: SelectedRowModel, field: FormFieldDefinition, columnIndex: number | null): string {
    void columnIndex
    const fieldUsesLookup = isLookupFieldType(field.typeId) || Boolean(field.picklistPath)

    if (row.apiRow) {
      const fromField = row.apiRow.byFieldId.get(field.fieldId)
      if (typeof fromField === 'string') {
        if (!(fieldUsesLookup && isLookupPayloadValue(fromField))) {
          return fromField
        }
      }
      const fromTitle = row.apiRow.byTitle.get(normalizeFieldToken(field.title))
      if (typeof fromTitle === 'string') {
        if (!(fieldUsesLookup && isLookupPayloadValue(fromTitle))) {
          return fromTitle
        }
      }
    }
    return ''
  }

  function resolveFieldDisplayValue(
    model: SelectedRowModel,
    column: ApiTableColumn,
    pending?: Map<number, Map<string, string>>
  ): string {
    const pendingValue = pending?.get(model.domRowIndex)?.get(column.field.fieldId)
    const fieldUsesLookup = isLookupFieldType(column.field.typeId) || Boolean(column.field.picklistPath)
    if (typeof pendingValue === 'string' && !(fieldUsesLookup && isLookupPayloadValue(pendingValue))) return pendingValue
    return resolveFieldValueForSelectedRow(model, column.field, column.columnIndex)
  }

  function resolveFieldPayloadValue(model: SelectedRowModel, column: ApiTableColumn): string {
    const link = model.apiRow?.byFieldLink.get(column.field.fieldId)
    if (typeof link === 'string' && link) return link
    const display = resolveFieldValueForSelectedRow(model, column.field, column.columnIndex)
    return display || column.field.defaultPayloadValue || column.field.defaultValue || ''
  }

  return {
    getApiTableColumns,
    getMatchedFields,
    getApiRows,
    buildApiRowProjections,
    resolveFieldDisplayValue,
    resolveFieldPayloadValue,
    getGridFieldsPayloadForCurrentGrid,
    getGridRowsPayloadForCurrentGrid,
    parseDateToInputValue
  }
}

