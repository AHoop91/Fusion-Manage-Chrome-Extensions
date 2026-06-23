// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createModalState } from '../controller/modalState'
import { createValidationManager, type ValidationManagerDeps } from '../services/validation.service'
import type { ApiRowProjection, ApiTableColumn, SelectedRowModel } from '../types'

function createStagingManagerPort(
  overrides: Pick<
    ValidationManagerDeps['stagingManager'],
    'getSnapshot' | 'getPendingChangesMap' | 'getPendingDisplayMap' | 'getPendingRemovalSet'
  >
): ValidationManagerDeps['stagingManager'] {
  return {
    getQueue: vi.fn(),
    clearAll: vi.fn(),
    getPendingOperationCount: vi.fn(),
    getStagedSummary: vi.fn(),
    getSnapshot: overrides.getSnapshot,
    getInsertDraftAt: vi.fn(),
    getInsertCount: vi.fn(),
    getPendingChangesMap: overrides.getPendingChangesMap,
    getPendingDisplayMap: overrides.getPendingDisplayMap,
    getPendingRemovalSet: overrides.getPendingRemovalSet,
    buildAddDraftFromFields: vi.fn(),
    addInsertDraft: vi.fn(),
    replaceInsertDraft: vi.fn(),
    removeInsertDrafts: vi.fn(),
    buildCloneDraftFromModel: vi.fn(),
    buildCloneDraftFromInsertAt: vi.fn(),
    getDisplayValueForModelField: vi.fn(),
    getPayloadValueForModelField: vi.fn(),
    buildModelByDomRowIndex: vi.fn(),
    toggleRemovalForDomRows: vi.fn(),
    clearStagedNewRows: vi.fn(),
    clearStagedEdits: vi.fn(),
    clearStagedDeletes: vi.fn(),
    revertForDomRows: vi.fn(),
    getSelectedRevertSummary: vi.fn(),
    buildMultiEditSeed: vi.fn(),
    stageDraftFromBindings: vi.fn()
  }
}

function createGridServicePort(
  getApiTableValueForRow: ValidationManagerDeps['gridService']['getApiTableValueForRow'],
  getUniqueInGridFieldIdsForCurrentGrid: ValidationManagerDeps['gridService']['getUniqueInGridFieldIdsForCurrentGrid'] = vi.fn(
    () => []
  )
): ValidationManagerDeps['gridService'] {
  return {
    isGridViewModeActive: vi.fn(),
    parseDateToInputValue: vi.fn(),
    getApiFieldsForCurrentGrid: vi.fn(),
    getGridRowsPayloadForCurrentGrid: vi.fn(),
    buildApiRowProjections: vi.fn(),
    hydrateGridFieldsForCurrentContext: vi.fn(),
    hydrateGridRowsForCurrentContext: vi.fn(),
    clearGridRowsForCurrentContext: vi.fn(),
    clearCaches: vi.fn(),
    buildApiRowModels: vi.fn(),
    resolveFieldValueForSelectedRow: vi.fn(),
    getApiTableValueForRow,
    getTenantFromLocation: vi.fn(),
    toGridPayloadType: vi.fn(),
    getUniqueInGridFieldIdsForCurrentGrid,
    isFieldRequired: vi.fn(() => false),
    hydrateRequiredValidatorsForFields: vi.fn(async () => undefined),
    ensureValidatorsHydratedForCurrentGrid: vi.fn(async () => undefined)
  }
}

function createRequiredColumn(fieldId: string, title: string, defaultValue: string | null = null): ApiTableColumn {
  return createFieldColumn(fieldId, title, true, defaultValue)
}

function createFieldColumn(
  fieldId: string,
  title: string,
  required: boolean,
  defaultValue: string | null = null
): ApiTableColumn {
  return {
    columnIndex: 0,
    field: {
      fieldId,
      title,
      description: null,
      kind: 'text',
      typeId: null,
      picklistPath: null,
      defaultValue,
      defaultPayloadValue: defaultValue,
      fieldLength: null,
      fieldPrecision: null,
      unitOfMeasure: null,
      required,
      editable: true,
      visible: true,
      displayOrder: 0
    }
  }
}

function createRowModel(domRowIndex: number, apiRow: ApiRowProjection | null): SelectedRowModel {
  return {
    domRow: {} as HTMLTableRowElement,
    domRowIndex,
    identity: `row-${domRowIndex}`,
    apiRow
  }
}

describe('createValidationManager', () => {
  it('reports required issues for unresolved existing rows and new inserts', () => {
    const nameColumn = createRequiredColumn('name', 'Name')
    const codeColumn = createRequiredColumn('code', 'Code', 'AUTO')
    const apiRow: ApiRowProjection = {
      index: 0,
      identity: 'api-1',
      rowId: '1001',
      byFieldId: new Map([
        ['name', ''],
        ['code', '']
      ]),
      byFieldLink: new Map(),
      byTitle: new Map(),
      rawByFieldId: new Map()
    }

    const rowModel = createRowModel(0, apiRow)
    const state = createModalState({
      metadata: {
        hasApiFieldMetadata: true,
        apiTableColumns: [nameColumn, codeColumn],
        matchedFields: [],
        apiRows: [apiRow],
        selectedRowModels: [rowModel],
        sourceRows: []
      }
    })

    const stagingManager = {
      getSnapshot: () => ({
        updates: [],
        removals: [],
        inserts: [
          {
            index: 0,
            source: 'add' as const,
            payload: [{ fieldId: 'name', value: '' }],
            display: [{ fieldId: 'name', value: '' }]
          }
        ]
      }),
      getPendingChangesMap: () => new Map<number, Map<string, string>>(),
      getPendingDisplayMap: () => new Map<number, Map<string, string>>(),
      getPendingRemovalSet: () => new Set<number>()
    }

    const gridService = {
      getApiTableValueForRow: vi.fn(() => '')
    }

    const manager = createValidationManager({
      state,
      stagingManager: createStagingManagerPort(stagingManager),
      gridService: createGridServicePort(gridService.getApiTableValueForRow)
    })

    expect(manager.getRequiredValidationIssues(new Map([[0, rowModel]]))).toEqual([
      { rowLabel: 'Row 1001', fieldTitle: 'Name' },
      { rowLabel: 'New Row 1', fieldTitle: 'Name' }
    ])
    expect(manager.getUniqueRequiredFieldTitles([
      { rowLabel: 'Row 1001', fieldTitle: ' Name ' },
      { rowLabel: 'New Row 1', fieldTitle: 'Name' },
      { rowLabel: 'New Row 1', fieldTitle: 'Code' }
    ])).toEqual(['Name', 'Code'])
  })

  it('respects pending display values and skips rows staged for removal', () => {
    const nameColumn = createRequiredColumn('name', 'Name')
    const apiRowA: ApiRowProjection = {
      index: 0,
      identity: 'api-a',
      rowId: '10',
      byFieldId: new Map([['name', '']]),
      byFieldLink: new Map(),
      byTitle: new Map(),
      rawByFieldId: new Map()
    }
    const apiRowB: ApiRowProjection = {
      index: 1,
      identity: 'api-b',
      rowId: '11',
      byFieldId: new Map([['name', '']]),
      byFieldLink: new Map(),
      byTitle: new Map(),
      rawByFieldId: new Map()
    }

    const rowModelA = createRowModel(0, apiRowA)
    const rowModelB = createRowModel(1, apiRowB)
    const state = createModalState({
      metadata: {
        hasApiFieldMetadata: true,
        apiTableColumns: [nameColumn],
        matchedFields: [],
        apiRows: [apiRowA, apiRowB],
        selectedRowModels: [rowModelA, rowModelB],
        sourceRows: []
      }
    })

    const manager = createValidationManager({
      state,
      stagingManager: createStagingManagerPort({
        getSnapshot: () => ({ updates: [], removals: [], inserts: [] }),
        getPendingChangesMap: () => new Map<number, Map<string, string>>(),
        getPendingDisplayMap: () => new Map<number, Map<string, string>>([
          [0, new Map([['name', 'Filled in UI']])]
        ]),
        getPendingRemovalSet: () => new Set<number>([1])
      }),
      gridService: createGridServicePort(vi.fn(() => ''))
    })

    expect(manager.getRequiredValidationIssues(new Map([
      [0, rowModelA],
      [1, rowModelB]
    ]))).toEqual([])
  })

  it('validates without api rows by using selected row models, pending changes, and placeholder filtering', () => {
    const requiredColumn = createRequiredColumn('name', 'Name')
    const optionalByDefaultColumn = createRequiredColumn('code', 'Code', 'AUTO')
    const rowModel = createRowModel(0, null)
    const state = createModalState({
      metadata: {
        hasApiFieldMetadata: true,
        apiTableColumns: [requiredColumn, optionalByDefaultColumn],
        matchedFields: [],
        apiRows: [],
        selectedRowModels: [rowModel],
        sourceRows: []
      }
    })

    const manager = createValidationManager({
      state,
      stagingManager: createStagingManagerPort({
        getSnapshot: () => ({ updates: [], removals: [], inserts: [] }),
        getPendingChangesMap: () => new Map<number, Map<string, string>>([
          [0, new Map([['name', ' - ']])]
        ]),
        getPendingDisplayMap: () => new Map<number, Map<string, string>>(),
        getPendingRemovalSet: () => new Set<number>()
      }),
      gridService: createGridServicePort(vi.fn((model, column) => (column.field.fieldId === 'code' ? '' : 'ignored')))
    })

    expect(manager.getRequiredValidationIssues(new Map([[0, rowModel]]))).toEqual([
      { rowLabel: 'Row 1', fieldTitle: 'Name' }
    ])
  })

  it('prefers pending display or payload values for inserted rows and ignores blank unique titles', () => {
    const state = createModalState({
      metadata: {
        hasApiFieldMetadata: true,
        apiTableColumns: [
          createRequiredColumn('name', 'Name'),
          createRequiredColumn('code', 'Code')
        ],
        matchedFields: [],
        apiRows: [],
        selectedRowModels: [],
        sourceRows: []
      }
    })

    const manager = createValidationManager({
      state,
      stagingManager: createStagingManagerPort({
        getSnapshot: () => ({
          updates: [],
          removals: [],
          inserts: [
            {
              index: 0,
              source: 'add' as const,
              payload: [{ fieldId: 'code', value: 'PAYLOAD-CODE' }],
              display: [{ fieldId: 'name', value: 'Visible Name' }]
            }
          ]
        }),
        getPendingChangesMap: () => new Map<number, Map<string, string>>(),
        getPendingDisplayMap: () => new Map<number, Map<string, string>>(),
        getPendingRemovalSet: () => new Set<number>()
      }),
      gridService: createGridServicePort(vi.fn(() => ''))
    })

    expect(manager.getRequiredValidationIssues(new Map())).toEqual([])
    expect(manager.getUniqueRequiredFieldTitles([
      { rowLabel: 'Row 1', fieldTitle: '  ' },
      { rowLabel: 'Row 2', fieldTitle: 'Name' },
      { rowLabel: 'Row 3', fieldTitle: 'Name' }
    ])).toEqual(['Name'])
  })

  it('reports uniqueInGrid issues when the same non-empty value appears on multiple rows', () => {
    const idColumn = createFieldColumn('ID', 'Item Number', false)
    const apiRowA: ApiRowProjection = {
      index: 0,
      identity: 'api-a',
      rowId: '10',
      byFieldId: new Map([['ID', 'PART-1']]),
      byFieldLink: new Map(),
      byTitle: new Map(),
      rawByFieldId: new Map()
    }
    const apiRowB: ApiRowProjection = {
      index: 1,
      identity: 'api-b',
      rowId: '11',
      byFieldId: new Map([['ID', 'PART-1']]),
      byFieldLink: new Map(),
      byTitle: new Map(),
      rawByFieldId: new Map()
    }
    const rowModelA = createRowModel(0, apiRowA)
    const rowModelB = createRowModel(1, apiRowB)
    const state = createModalState({
      metadata: {
        hasApiFieldMetadata: true,
        apiTableColumns: [idColumn],
        matchedFields: [],
        apiRows: [apiRowA, apiRowB],
        selectedRowModels: [rowModelA, rowModelB],
        sourceRows: []
      }
    })

    const manager = createValidationManager({
      state,
      stagingManager: createStagingManagerPort({
        getSnapshot: () => ({ updates: [], removals: [], inserts: [] }),
        getPendingChangesMap: () => new Map<number, Map<string, string>>(),
        getPendingDisplayMap: () => new Map<number, Map<string, string>>(),
        getPendingRemovalSet: () => new Set<number>()
      }),
      gridService: createGridServicePort(
        vi.fn((model, column) => String(model.apiRow?.byFieldId.get(column.field.fieldId) ?? '')),
        vi.fn(() => ['ID'])
      )
    })

    const uniqueIssues = manager.getUniqueInGridValidationIssues(new Map([
      [0, rowModelA],
      [1, rowModelB]
    ]))
    expect(uniqueIssues).toEqual([
      {
        rowLabel: 'Row 11',
        fieldTitle: 'Item Number',
        duplicateValue: 'PART-1',
        fieldId: 'ID',
        duplicateCell: { kind: 'existing', domRowIndex: 1 }
      }
    ])
    expect(manager.getUniqueDuplicateFieldTitles(uniqueIssues)).toEqual(['Item Number'])
  })

  it('ignores blank values for uniqueInGrid duplicate detection', () => {
    const idColumn = createFieldColumn('ID', 'Item Number', false)
    const apiRowA: ApiRowProjection = {
      index: 0,
      identity: 'api-a',
      rowId: '10',
      byFieldId: new Map([['ID', '']]),
      byFieldLink: new Map(),
      byTitle: new Map(),
      rawByFieldId: new Map()
    }
    const apiRowB: ApiRowProjection = {
      index: 1,
      identity: 'api-b',
      rowId: '11',
      byFieldId: new Map([['ID', '   ']]),
      byFieldLink: new Map(),
      byTitle: new Map(),
      rawByFieldId: new Map()
    }
    const rowModelA = createRowModel(0, apiRowA)
    const rowModelB = createRowModel(1, apiRowB)
    const state = createModalState({
      metadata: {
        hasApiFieldMetadata: true,
        apiTableColumns: [idColumn],
        matchedFields: [],
        apiRows: [apiRowA, apiRowB],
        selectedRowModels: [rowModelA, rowModelB],
        sourceRows: []
      }
    })

    const manager = createValidationManager({
      state,
      stagingManager: createStagingManagerPort({
        getSnapshot: () => ({ updates: [], removals: [], inserts: [] }),
        getPendingChangesMap: () => new Map<number, Map<string, string>>(),
        getPendingDisplayMap: () => new Map<number, Map<string, string>>(),
        getPendingRemovalSet: () => new Set<number>()
      }),
      gridService: createGridServicePort(
        vi.fn((model, column) => String(model.apiRow?.byFieldId.get(column.field.fieldId) ?? '')),
        vi.fn(() => ['ID'])
      )
    })

    expect(manager.getUniqueInGridValidationIssues(new Map([
      [0, rowModelA],
      [1, rowModelB]
    ]))).toEqual([])
  })
})
