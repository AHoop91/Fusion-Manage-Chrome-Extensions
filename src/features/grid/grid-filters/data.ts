import { classifyColumnKind } from './filterEngine'
import type { ApiFieldMeta } from './model'
import type { GridColumnDef } from '../grid.types'
import type { CapturedGridFieldsPayload } from '../grid-api-payload.types'
import {
  getGridFieldsPayloadForContext,
  getGridFieldsPayloadForCurrentContext,
  getLatestGridViewIdForContext as getLatestGridViewIdFromApiCache,
  hydrateGridFieldsForCurrentContext
} from '../grid-services/gridApiMetadata'
import { parseGridPageContext } from '../grid-page/grid-page-context'
import { buildTableColumns } from '../grid-page/grid-table-index'
import { normalizeText } from '../../../shared/utils/text'

export {
  parseGridPageContext,
  parseGridRouteContext,
  isGridPage,
  isStrictGridPage,
  isGridEditPage
} from '../grid-page/grid-page-context'

export {
  extractCellValue,
  buildRowIndex,
  getGridTable,
  isGridLoading
} from '../grid-page/grid-table-index'

export function getApiFieldsPayloadForContext(workspaceId: number, dmsId: number): CapturedGridFieldsPayload | null {
  return getGridFieldsPayloadForContext(workspaceId, dmsId)
}

export function getLatestGridViewIdForContext(workspaceId: number, dmsId: number): number | null {
  return getLatestGridViewIdFromApiCache(workspaceId, dmsId)
}

export function buildApiFieldMeta(payload: CapturedGridFieldsPayload | null): ApiFieldMeta[] {
  if (!payload || !Array.isArray(payload.fields) || payload.fields.length === 0) return []

  const map = new Map<string, ApiFieldMeta>()
  for (const field of payload.fields) {
    if (!field || typeof field !== 'object') continue
    if (field.derived === true) continue

    const title = String(field.label || field.name || '').trim()
    const fieldId = String(field.name || '').trim().toUpperCase()
    if (!title || !fieldId || /^row id$/i.test(title) || /^rowid$/i.test(fieldId)) continue

    if (!map.has(fieldId)) {
      map.set(fieldId, {
        fieldId,
        title,
        kind: classifyColumnKind(String(field.type?.title || ''))
      })
    }
  }

  return Array.from(map.values())
}

export function hasApiMetadataForCurrentGrid(): boolean {
  const context = parseGridPageContext(window.location.href)
  if (!context) return true
  return Boolean(getGridFieldsPayloadForCurrentContext())
}

export function buildColumns(table: HTMLTableElement): GridColumnDef[] {
  const tableColumns = buildTableColumns(table)
  if (tableColumns.length === 0) return []

  const context = parseGridPageContext(window.location.href)
  if (!context) return tableColumns

  const payload = getApiFieldsPayloadForContext(context.workspaceId, context.dmsId)
  if (!payload) {
    void hydrateGridFieldsForCurrentContext()
    return []
  }
  const apiFields = buildApiFieldMeta(payload)
  if (apiFields.length === 0) return []

  const fieldsById = new Map(apiFields.map((field) => [field.fieldId.toUpperCase(), field]))
  const fieldsByTitle = new Map(apiFields.map((field) => [normalizeText(field.title), field]))

  const apiDrivenColumns: GridColumnDef[] = []
  for (const column of tableColumns) {
    const fromId = column.fieldId ? fieldsById.get(column.fieldId.toUpperCase()) : null
    const fromTitle = fieldsByTitle.get(normalizeText(column.title))
    const matched = fromId || fromTitle
    if (!matched) continue

    apiDrivenColumns.push({
      ...column,
      title: matched.title || column.title,
      kind: matched.kind,
      fieldId: matched.fieldId
    })
  }

  if (apiDrivenColumns.length === 0) {
    return tableColumns
  }

  return apiDrivenColumns
}
