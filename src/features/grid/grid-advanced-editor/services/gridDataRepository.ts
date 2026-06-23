import { parseGridRouteContext } from '../../grid-page/grid-page-context'
import { normalizeText } from '../../../../shared/utils/text'
import { normalizeFieldToken } from '../../../../shared/utils/text'
import { isLookupFieldType, isLookupPayloadValue } from './fieldTypes'
import {
  buildGridFormFieldDefinition,
  extractGridApiLinkValue,
  isGridFieldVisible,
  normalizeGridApiCellValue,
  resolveGridFieldId
} from '../../grid-services/gridFieldMetadata'
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
import { collectUniqueInGridFieldIdsFromFieldDefinitions } from './uniqueInGridValidators'

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
   * Field IDs that must be unique across visible grid rows (from `uniqueInGrid` validators).
   */
  getUniqueInGridFieldIds: () => string[]
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
  const month = (usMatch[1] ?? '').padStart(2, '0')
  const day = (usMatch[2] ?? '').padStart(2, '0')
  return `${usMatch[3] ?? ''}-${month}-${day}`
}

function resolveApiFieldId(rawField: CapturedGridRowField): string {
  const selfValue = String(rawField.__self__ || '')
  const fromSelf = /\/fields\/([^/?#]+)/i.exec(selfValue)?.[1]
  if (fromSelf) return decodeURIComponent(fromSelf).trim().toUpperCase()

  const urnValue = String(rawField.urn || '')
  const fromUrn = urnValue.split('.').at(-1)
  return String(fromUrn || '').trim().toUpperCase()
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
    const rawByFieldId = new Map<string, CapturedGridRowField>()
    for (const rawField of row.rowData) {
      if (!rawField || rawField.formulaField) continue
      const title = String(rawField.title || '').trim()
      if (/^row id$/i.test(title)) continue

      const fieldId = resolveApiFieldId(rawField)
      const value = normalizeGridApiCellValue(rawField.value)
      const linkValue = extractGridApiLinkValue(rawField.value)
      if (!value && !fieldId && !title) continue

      if (fieldId) byFieldId.set(fieldId, value)
      if (fieldId && linkValue) byFieldLink.set(fieldId, linkValue)
      if (fieldId) rawByFieldId.set(fieldId, rawField)
      if (title) byTitle.set(normalizeFieldToken(title), value)
    }

    projections.push({
      index,
      identity: buildApiRowIdentity(index, byFieldId, row),
      rowId: resolveApiRowId(row),
      byFieldId,
      byFieldLink,
      byTitle,
      rawByFieldId
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

  function getUniqueInGridFieldIds(): string[] {
    const merged = new Set<string>()
    const payload = getGridFieldsPayloadForCurrentGrid()
    if (payload?.fields?.length) {
      for (const id of collectUniqueInGridFieldIdsFromFieldDefinitions(payload.fields)) {
        merged.add(id)
      }
    }
    for (const id of metadataCache.getHydratedUniqueInGridFieldIds()) {
      merged.add(id)
    }
    return Array.from(merged)
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
      if (!isGridFieldVisible(definition)) continue

      const fieldId = resolveGridFieldId(definition)
      if (!fieldId || dedup.has(fieldId)) continue
      dedup.add(fieldId)

      const title = String(definition.label || definition.name || '').trim()
      if (!title || /^row id$/i.test(title)) continue

      const field = buildGridFormFieldDefinition(definition, metadataCache.isFieldRequired(definition), { fieldId, title })
      if (!field) continue

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
    getUniqueInGridFieldIds,
    getGridRowsPayloadForCurrentGrid,
    parseDateToInputValue
  }
}

