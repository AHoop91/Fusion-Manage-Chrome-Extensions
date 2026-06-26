// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { rawField } from '../../../../test/fixtures/gridFields'
import type { CapturedGridFieldsPayload, SelectedRowModel } from '../types'
import { buildImportableFields } from '../../grid-import/mapping.service'
import { buildInsertDraftFromImportRow } from '../import-session-seed'
import { createGridDataRepository } from '../services/gridDataRepository'
import type { GridMetadataCache } from '../services/gridMetadataCache'

const GRID_URL =
  'https://test.autodeskplm360.net/plm/workspaces/42/items/grid?tab=grid&view=full&mode=view&itemId=WS%2C42%2C1001'

function mockMetadataCache(payload: CapturedGridFieldsPayload | null): GridMetadataCache {
  return {
    getGridViewIdCandidates: () => [],
    hydrateFields: async () => false,
    hydrateRows: async () => false,
    getGridFieldsPayloadForCurrentGrid: () => payload,
    getGridRowsPayloadForCurrentGrid: () => null,
    clearGridRowsForCurrentContext: () => {},
    hydrateRequiredValidatorsForFields: async () => {},
    isFieldRequired: () => false,
    clear: () => {},
    getHydratedUniqueInGridFieldIds: () => []
  }
}

function selectedRow(domRowIndex: number): SelectedRowModel {
  return {
    domRow: {} as HTMLTableRowElement,
    domRowIndex,
    identity: `row-${domRowIndex}`,
    apiRow: {
      index: domRowIndex,
      identity: `row-${domRowIndex}`,
      rowId: '1',
      byFieldId: new Map(),
      byFieldLink: new Map(),
      byTitle: new Map(),
      rawByFieldId: new Map()
    }
  }
}

describe('gridDataRepository getApiTableColumns', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: new URL(GRID_URL) })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses API field id from __self__ when definition.name differs', () => {
    const definition = rawField('KEY_PROCESS_STEP_OR_INPUT', 'Key Process Step or Input')
    const repository = createGridDataRepository(mockMetadataCache({ fields: [definition] }))
    const columns = repository.getApiTableColumns()

    expect(columns).toHaveLength(1)
    expect(columns[0]?.field.fieldId).toBe('KEY_PROCESS_STEP_OR_INPUT')
    expect(columns[0]?.field.title).toBe('Key Process Step or Input')
  })

  it('matches importable field ids for the same API field definitions', () => {
    const fields = [
      rawField('KEY_PROCESS_STEP_OR_INPUT', 'Key Process Step or Input', { displayOrder: 1 }),
      rawField('SEV', 'SEV', { displayOrder: 0 })
    ]
    const payload = { fields }
    const importable = buildImportableFields(payload, repositoryColumnsToFormFields(payload))
    const repository = createGridDataRepository(mockMetadataCache(payload))
    const columns = repository.getApiTableColumns()

    const importIds = importable.map((field) => field.fieldId).sort()
    const editorIds = columns.map((column) => column.field.fieldId).sort()
    expect(editorIds).toEqual(importIds)
  })

  it('resolves staged insert and update values keyed by API field id', () => {
    const definition = rawField('KEY_PROCESS_STEP_OR_INPUT', 'Key Process Step or Input')
    const repository = createGridDataRepository(mockMetadataCache({ fields: [definition] }))
    const column = repository.getApiTableColumns()[0]
    expect(column?.field.fieldId).toBe('KEY_PROCESS_STEP_OR_INPUT')

    const draft = buildInsertDraftFromImportRow({
      kind: 'insert',
      csvRowNumber: 2,
      sourceRowLabel: 'CSV row 2',
      fields: [{ fieldId: 'KEY_PROCESS_STEP_OR_INPUT', payload: 'Step A', display: 'Step A' }]
    })
    expect(draft.payload.get(column!.field.fieldId)).toBe('Step A')
    expect(draft.display.get(column!.field.fieldId)).toBe('Step A')

    const model = selectedRow(1)
    const pendingDisplay = new Map<number, Map<string, string>>([
      [1, new Map([['KEY_PROCESS_STEP_OR_INPUT', 'Updated label']])]
    ])
    expect(repository.resolveFieldDisplayValue(model, column!, pendingDisplay)).toBe('Updated label')
  })
})

function repositoryColumnsToFormFields(payload: CapturedGridFieldsPayload) {
  const repository = createGridDataRepository(mockMetadataCache(payload))
  return repository.getApiTableColumns().map((column) => column.field)
}
