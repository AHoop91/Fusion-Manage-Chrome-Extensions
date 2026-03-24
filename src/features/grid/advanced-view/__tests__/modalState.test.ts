// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { createModalState } from '../controller/modalState'

describe('grid advanced-view modalState', () => {
  it('clones metadata and preserves encapsulated state updates', () => {
    const sourceRow = document.createElement('tr')
    const state = createModalState({
      metadata: {
        hasApiFieldMetadata: false,
        apiTableColumns: [{ fieldId: 'description', title: 'Description' } as any],
        matchedFields: [],
        apiRows: [],
        selectedRowModels: [],
        sourceRows: [sourceRow]
      }
    })

    const metadata = state.getMetadata()
    metadata.apiTableColumns.push({ fieldId: 'extra', title: 'Extra' } as any)
    metadata.sourceRows.push(document.createElement('tr'))

    expect(state.getMetadata()).toMatchObject({
      hasApiFieldMetadata: false,
      apiTableColumns: [{ fieldId: 'description', title: 'Description' }],
      sourceRows: [sourceRow]
    })

    state.setMetadata({
      hasApiFieldMetadata: true,
      apiRows: [{ rowId: '7' } as any]
    })

    expect(state.getMetadata()).toMatchObject({
      hasApiFieldMetadata: true,
      apiRows: [{ rowId: '7' }]
    })
  })

  it('tracks edit mode, lookup preloads, row ids, widths, and multi-edit seeds', () => {
    const state = createModalState({
      metadata: {
        hasApiFieldMetadata: true,
        apiTableColumns: [],
        matchedFields: [],
        apiRows: [],
        selectedRowModels: [],
        sourceRows: []
      }
    })

    state.setEditMode({ type: 'single', rowIndex: 3 })
    expect(state.getEditMode()).toEqual({ type: 'single', rowIndex: 3 })
    state.clearEditMode()
    expect(state.getEditMode()).toEqual({ type: 'idle' })

    state.markLookupPathPreloaded('/api/v3/lookups/10')
    expect(state.isLookupPathPreloaded('/api/v3/lookups/10')).toBe(true)
    expect(state.getLookupPreloadPaths()).toEqual(['/api/v3/lookups/10'])
    state.clearLookupPreloadPaths()
    expect(state.getLookupPreloadPaths()).toEqual([])

    state.setRowId(2, 'row-2')
    state.setColumnWidth(4, 280)
    expect(state.getRowIdEntries()).toEqual([{ domRowIndex: 2, rowId: 'row-2' }])
    expect(state.getColumnWidthEntries()).toEqual([{ columnIndex: 4, width: 280 }])
    state.clearRowIds()
    expect(state.getRowIdEntries()).toEqual([])

    const initialValues = new Map([['description', 'Widget']])
    const mismatchFieldIds = new Set(['quantity'])
    state.setMultiEditSeed(initialValues, mismatchFieldIds)
    expect(state.getMultiEditSeed()).toEqual({
      initialValues: new Map([['description', 'Widget']]),
      mismatchFieldIds: new Set(['quantity'])
    })
    state.clearMultiEditSeed()
    expect(state.getMultiEditSeed()).toEqual({
      initialValues: new Map(),
      mismatchFieldIds: new Set()
    })
  })

  it('tracks modal lifecycle flags and poll handles', () => {
    const state = createModalState({
      metadata: {
        hasApiFieldMetadata: true,
        apiTableColumns: [],
        matchedFields: [],
        apiRows: [],
        selectedRowModels: [],
        sourceRows: []
      }
    })

    const handle = { cancel: () => undefined }
    expect(state.isRequiredOnly()).toBe(false)
    expect(state.isMetadataHydrationStarted()).toBe(false)
    expect(state.isCommitting()).toBe(false)
    expect(state.hasCommittedOperations()).toBe(false)
    expect(state.isExpanded()).toBe(false)

    state.setRequiredOnly(true)
    state.markMetadataHydrationStarted()
    state.setCommitting(true)
    state.markCommittedOperations()
    state.setExpanded(true)
    state.setMetadataPollHandle(handle)

    expect(state.isRequiredOnly()).toBe(true)
    expect(state.isMetadataHydrationStarted()).toBe(true)
    expect(state.isCommitting()).toBe(true)
    expect(state.hasCommittedOperations()).toBe(true)
    expect(state.isExpanded()).toBe(true)
    expect(state.getMetadataPollHandle()).toBe(handle)
  })
})
