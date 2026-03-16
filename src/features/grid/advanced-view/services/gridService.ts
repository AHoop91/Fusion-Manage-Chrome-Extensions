import type { GridColumnKind } from '../types'
import type { ApiRowProjection, ApiTableColumn, CapturedGridRowsPayload, FormFieldDefinition, SelectedRowModel } from '../types'
import {
  isDateFieldType,
  isIntegerFieldType,
  isLookupFieldType,
  isMultiLookupFieldType,
  isNumericFieldType,
  isRadioFieldType
} from './fieldTypes'
import { createGridDataRepository } from './gridDataRepository'
import { createGridMetadataCache } from './gridMetadataCache'

/**
 * Grid service contract exposed to feature, modal and renderer layers.
 */
export interface GridService {
  isGridViewModeActive: () => boolean
  parseDateToInputValue: (rawValue: string) => string
  getApiFieldsForCurrentGrid: () => FormFieldDefinition[]
  getGridRowsPayloadForCurrentGrid: () => CapturedGridRowsPayload | null
  buildApiRowProjections: (payload: CapturedGridRowsPayload | null) => ApiRowProjection[]
  hydrateGridFieldsForCurrentContext: () => Promise<boolean>
  hydrateGridRowsForCurrentContext: () => Promise<boolean>
  clearCaches: () => void
  buildApiRowModels: (apiRows: ApiRowProjection[]) => SelectedRowModel[]
  resolveFieldValueForSelectedRow: (
    row: SelectedRowModel,
    field: FormFieldDefinition,
    columnIndex: number | null
  ) => string
  getApiTableValueForRow: (
    row: SelectedRowModel,
    column: ApiTableColumn,
    pendingChangesByDomRowIndex?: Map<number, Map<string, string>>
  ) => string
  getTenantFromLocation: (urlString: string) => string | null
  toGridPayloadType: (field: FormFieldDefinition) => string
}

function getTenantFromLocation(urlString: string): string | null {
  try {
    const url = new URL(urlString)
    const hostParts = url.hostname.split('.')
    if (hostParts.length < 3) return null
    return hostParts[0]?.toUpperCase() || null
  } catch {
    return null
  }
}

function toGridPayloadType(field: FormFieldDefinition): string {
  if (isMultiLookupFieldType(field.typeId)) return 'multi-select'
  if (isRadioFieldType(field.typeId)) return 'radio'
  if (field.typeId === 28) return 'buom'
  if (isLookupFieldType(field.typeId)) return 'single-select'
  if (isIntegerFieldType(field.typeId)) return 'integer'
  if (isNumericFieldType(field.typeId) || field.kind === 'number') return 'number'
  if (isDateFieldType(field.typeId)) return 'date'

  switch (field.kind as GridColumnKind) {
    case 'date':
      return 'date'
    default:
      return 'string'
  }
}

/**
 * Creates a composed grid service facade backed by dedicated read/cache adapters.
 */
export function createGridService(): GridService {
  const metadataCache = createGridMetadataCache()
  const repository = createGridDataRepository(metadataCache)

  function isVisibleElement(node: Element | null): node is HTMLElement {
    if (!(node instanceof HTMLElement)) return false
    if (node.getAttribute('aria-hidden') === 'true') return false
    if (node.classList.contains('ng-hide')) return false
    const style = window.getComputedStyle(node)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
    return node.offsetParent !== null || style.position === 'fixed'
  }

  function isGridViewModeActive(): boolean {
    try {
      const url = new URL(window.location.href)
      if (!/^\/plm\/workspaces\/\d+\/items\/grid$/i.test(url.pathname)) return false
      const mode = String(url.searchParams.get('mode') || '').toLowerCase()
      if (mode === 'view') return true
      if (mode && mode !== 'view') return false
    } catch {
      return false
    }

    const saveButton = document.getElementById('grid-save-button') || document.querySelector('#control-data [aria-label="Save"]')
    const cancelButton =
      document.getElementById('grid-cancel-button') || document.querySelector('#control-data [aria-label="Cancel"]')
    if (isVisibleElement(saveButton) || isVisibleElement(cancelButton)) return false

    const editButton =
      document.getElementById('grid-edit-button') || document.querySelector('#transcluded-buttons [aria-label="Edit"]')
    return isVisibleElement(editButton)
  }

  function getApiFieldsForCurrentGrid(): FormFieldDefinition[] {
    return repository.getApiTableColumns().map((column) => column.field)
  }

  function resolveFieldValueForSelectedRow(
    row: SelectedRowModel,
    field: FormFieldDefinition,
    columnIndex: number | null
  ): string {
    return repository.resolveFieldDisplayValue(row, { field, columnIndex })
  }

  return {
    isGridViewModeActive,
    parseDateToInputValue: repository.parseDateToInputValue,
    getApiFieldsForCurrentGrid,
    getGridRowsPayloadForCurrentGrid: repository.getGridRowsPayloadForCurrentGrid,
    buildApiRowProjections: repository.buildApiRowProjections,
    hydrateGridFieldsForCurrentContext: metadataCache.hydrateFields,
    hydrateGridRowsForCurrentContext: metadataCache.hydrateRows,
    clearCaches: metadataCache.clear,
    buildApiRowModels: (apiRows: ApiRowProjection[]) =>
      apiRows.map((apiRow) => ({
        domRow: document.createElement('tr'),
        domRowIndex: apiRow.index,
        identity: apiRow.identity,
        apiRow
      })),
    resolveFieldValueForSelectedRow,
    getApiTableValueForRow: repository.resolveFieldDisplayValue,
    getTenantFromLocation,
    toGridPayloadType
  }
}
