// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { GridImportEditSession } from '../../grid-staging/grid-import-edit-session'
import { createStagingQueue } from '../services/stagingQueue'
import {
  buildInsertDraftFromImportRow,
  resolveDomRowIndexForImportUpdate,
  resolveExistingRowIndexForDomRow,
  seedImportEditSession
} from '../import-session-seed'
import type { SelectedRowModel } from '../types'

function createSeedStagingHarness() {
  const queue = createStagingQueue()
  const inserts: Array<{ payload: Map<string, string>; display: Map<string, string>; source: 'add' | 'clone' }> = []
  return {
    addInsertDraft: vi.fn((draft) => {
      inserts.push({
        payload: new Map(draft.payload),
        display: new Map(draft.display),
        source: draft.source
      })
      return inserts.length - 1
    }),
    getQueue: () => queue,
    inserts,
    queue
  }
}

function model(domRowIndex: number, rowId: string | null): SelectedRowModel {
  return {
    domRow: {} as HTMLTableRowElement,
    domRowIndex,
    identity: `row-${domRowIndex}`,
    apiRow: rowId
      ? {
          index: domRowIndex,
          identity: `row-${domRowIndex}`,
          rowId,
          byFieldId: new Map(),
          byFieldLink: new Map(),
          byTitle: new Map(),
          rawByFieldId: new Map()
        }
      : null
  }
}

describe('import session seed helpers', () => {
  it('maps staged field values into payload/display maps', () => {
    const draft = buildInsertDraftFromImportRow({
      kind: 'insert',
      csvRowNumber: 2,
      sourceRowLabel: 'CSV row 2',
      fields: [
        { fieldId: 'NAME', payload: 'Widget', display: 'Widget' },
        { fieldId: 'QTY', payload: '7', display: '7' }
      ]
    })
    expect(draft.source).toBe('add')
    expect(draft.payload.get('NAME')).toBe('Widget')
    expect(draft.display.get('QTY')).toBe('7')
  })

  it('resolves dom row index by matched row id', () => {
    const updateRow = {
      kind: 'update' as const,
      csvRowNumber: 2,
      matchedRowId: '42',
      matchedApiRowIndex: 9,
      domRowIndex: null,
      fields: [{ fieldId: 'NAME', payload: 'Widget', display: 'Widget' }]
    }
    const models = [model(3, '42'), model(4, '99')]
    expect(resolveDomRowIndexForImportUpdate(updateRow, models)).toBe(3)
    expect(resolveExistingRowIndexForDomRow(3, models)).toBe(0)
  })

  it('accepts domRowIndex when matchedRowId matches the row at that index', () => {
    const updateRow = {
      kind: 'update' as const,
      csvRowNumber: 2,
      matchedRowId: '42',
      matchedApiRowIndex: 0,
      domRowIndex: 1,
      fields: [{ fieldId: 'NAME', payload: 'Widget', display: 'Widget' }]
    }
    const models = [model(1, '42')]
    expect(resolveDomRowIndexForImportUpdate(updateRow, models)).toBe(1)
  })

  it('rejects stale domRowIndex and falls back to matchedRowId', () => {
    const updateRow = {
      kind: 'update' as const,
      csvRowNumber: 2,
      matchedRowId: '42',
      matchedApiRowIndex: 0,
      domRowIndex: 1,
      fields: [{ fieldId: 'NAME', payload: 'Widget', display: 'Widget' }]
    }
    const models = [model(1, '99'), model(3, '42')]
    expect(resolveDomRowIndexForImportUpdate(updateRow, models)).toBe(3)
  })

  it('returns null when domRowIndex row id mismatches and no fallback row exists', () => {
    const updateRow = {
      kind: 'update' as const,
      csvRowNumber: 2,
      matchedRowId: '42',
      matchedApiRowIndex: 0,
      domRowIndex: 1,
      fields: [{ fieldId: 'NAME', payload: 'Widget', display: 'Widget' }]
    }
    expect(resolveDomRowIndexForImportUpdate(updateRow, [model(1, '99')])).toBeNull()
  })
})

describe('seedImportEditSession', () => {
  it('seeds insert drafts and staged updates without mutating selected row models', () => {
    const harness = createSeedStagingHarness()
    const selectedRowModels = [model(1, '42')]
    const session: GridImportEditSession = {
      source: 'grid-import',
      fileName: 'rows.csv',
      rows: [
        {
          kind: 'insert',
          csvRowNumber: 2,
          sourceRowLabel: 'CSV row 2',
          fields: [{ fieldId: 'NAME', payload: 'New', display: 'New' }]
        },
        {
          kind: 'update',
          csvRowNumber: 3,
          matchedRowId: '42',
          matchedApiRowIndex: 0,
          domRowIndex: 1,
          fields: [{ fieldId: 'NAME', payload: 'Changed', display: 'Changed' }]
        }
      ],
      validationHints: { rowValidationByCsvRow: {}, blockingCsvRowNumbers: [] },
      skippedRows: []
    }

    const result = seedImportEditSession(
      harness as unknown as Parameters<typeof seedImportEditSession>[0],
      session,
      selectedRowModels
    )

    expect(result).toEqual({
      insertCount: 1,
      updateCount: 1,
      skippedUpdateCount: 0,
      focus: { type: 'insert', insertIndex: 0 }
    })
    expect(harness.addInsertDraft).toHaveBeenCalledTimes(1)
    expect(harness.inserts[0]?.payload.get('NAME')).toBe('New')
    const updateOp = harness.queue.getByDomRowIndex(1)
    expect(updateOp).toMatchObject({
      kind: 'update',
      domRowIndex: 1,
      payload: new Map([['NAME', 'Changed']]),
      display: new Map([['NAME', 'Changed']])
    })
    expect(selectedRowModels).toHaveLength(1)
  })

  it('focuses the first successfully staged existing row in updates-only sessions', () => {
    const harness = createSeedStagingHarness()
    const selectedRowModels = [model(0, '10'), model(1, '20')]
    const session: GridImportEditSession = {
      source: 'grid-import',
      fileName: 'updates.csv',
      rows: [
        {
          kind: 'update',
          csvRowNumber: 2,
          matchedRowId: 'missing',
          matchedApiRowIndex: 0,
          domRowIndex: 0,
          fields: [{ fieldId: 'NAME', payload: 'Skip', display: 'Skip' }]
        },
        {
          kind: 'update',
          csvRowNumber: 3,
          matchedRowId: '10',
          matchedApiRowIndex: 0,
          domRowIndex: 0,
          fields: [{ fieldId: 'NAME', payload: 'Ok', display: 'Ok' }]
        },
        {
          kind: 'update',
          csvRowNumber: 4,
          matchedRowId: '20',
          matchedApiRowIndex: 1,
          domRowIndex: 1,
          fields: [{ fieldId: 'NAME', payload: 'Also', display: 'Also' }]
        }
      ],
      validationHints: { rowValidationByCsvRow: {}, blockingCsvRowNumbers: [] },
      skippedRows: []
    }

    const result = seedImportEditSession(
      harness as unknown as Parameters<typeof seedImportEditSession>[0],
      session,
      selectedRowModels
    )

    expect(result).toEqual({
      insertCount: 0,
      updateCount: 2,
      skippedUpdateCount: 1,
      focus: { type: 'existing', rowIndex: 0 }
    })
    expect(harness.queue.getByDomRowIndex(0)).toMatchObject({
      kind: 'update',
      payload: new Map([['NAME', 'Ok']])
    })
  })

  it('does not stage update rows with no field payloads', () => {
    const harness = createSeedStagingHarness()
    const session: GridImportEditSession = {
      source: 'grid-import',
      fileName: 'rows.csv',
      rows: [
        {
          kind: 'update',
          csvRowNumber: 2,
          matchedRowId: '42',
          matchedApiRowIndex: 0,
          domRowIndex: 1,
          fields: []
        }
      ],
      validationHints: { rowValidationByCsvRow: {}, blockingCsvRowNumbers: [] },
      skippedRows: []
    }

    const result = seedImportEditSession(
      harness as unknown as Parameters<typeof seedImportEditSession>[0],
      session,
      [model(1, '42')]
    )

    expect(result.updateCount).toBe(0)
    expect(harness.queue.count()).toBe(0)
  })

  it('skips update rows when the target grid row cannot be resolved', () => {
    const harness = createSeedStagingHarness()
    const session: GridImportEditSession = {
      source: 'grid-import',
      fileName: 'rows.csv',
      rows: [
        {
          kind: 'update',
          csvRowNumber: 2,
          matchedRowId: 'missing',
          matchedApiRowIndex: 0,
          domRowIndex: null,
          fields: [{ fieldId: 'NAME', payload: 'X', display: 'X' }]
        }
      ],
      validationHints: { rowValidationByCsvRow: {}, blockingCsvRowNumbers: [] },
      skippedRows: []
    }

    const result = seedImportEditSession(
      harness as unknown as Parameters<typeof seedImportEditSession>[0],
      session,
      []
    )

    expect(result.updateCount).toBe(0)
    expect(result.skippedUpdateCount).toBe(1)
    expect(harness.queue.count()).toBe(0)
  })
})
