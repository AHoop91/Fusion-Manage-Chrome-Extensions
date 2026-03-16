import type { ApiRowProjection, ApiTableColumn, MatchedFormField, RowBinding, SelectedRowModel } from '../types'

/**
 * Modal edit-mode finite state used to avoid conflicting boolean flags.
 */
export type EditMode =
  | { type: 'idle' }
  | { type: 'single'; rowIndex: number }
  | { type: 'multi'; rowIndexes: Set<number> }
  | { type: 'insert'; insertIndex: number }

/**
 * Poll handle contract for metadata retry loops.
 */
export type MetadataPollHandle = {
  cancel: () => void
}

/**
 * Immutable metadata snapshot used by renderer and validators.
 */
export interface ModalMetadataSnapshot {
  hasApiFieldMetadata: boolean
  apiTableColumns: ApiTableColumn[]
  matchedFields: MatchedFormField[]
  apiRows: ApiRowProjection[]
  selectedRowModels: SelectedRowModel[]
  sourceRows: HTMLTableRowElement[]
}

/**
 * Modal state public API; all mutations go through methods.
 */
export interface ModalState {
  getMetadata: () => ModalMetadataSnapshot
  setMetadata: (snapshot: Partial<ModalMetadataSnapshot>) => void
  getEditMode: () => EditMode
  setEditMode: (mode: EditMode) => void
  clearEditMode: () => void
  getBindings: () => RowBinding[]
  setBindings: (bindings: RowBinding[]) => void
  isRequiredOnly: () => boolean
  setRequiredOnly: (value: boolean) => void
  isMetadataHydrationStarted: () => boolean
  markMetadataHydrationStarted: () => void
  isCommitting: () => boolean
  setCommitting: (value: boolean) => void
  hasCommittedOperations: () => boolean
  markCommittedOperations: () => void
  isExpanded: () => boolean
  setExpanded: (value: boolean) => void
  isLookupPathPreloaded: (path: string) => boolean
  markLookupPathPreloaded: (path: string) => void
  getLookupPreloadPaths: () => string[]
  clearLookupPreloadPaths: () => void
  getMetadataPollHandle: () => MetadataPollHandle | null
  setMetadataPollHandle: (handle: MetadataPollHandle | null) => void
  getRowIdEntries: () => Array<{ domRowIndex: number; rowId: string }>
  setRowId: (domRowIndex: number, rowId: string) => void
  clearRowIds: () => void
  getColumnWidthEntries: () => Array<{ columnIndex: number; width: number }>
  setColumnWidth: (columnIndex: number, width: number) => void
  getMultiEditSeed: () => { initialValues: Map<string, string>; mismatchFieldIds: Set<string> }
  setMultiEditSeed: (initialValues: Map<string, string>, mismatchFieldIds: Set<string>) => void
  clearMultiEditSeed: () => void
}

/**
 * Input shape for modal state initialization.
 */
export interface CreateModalStateInput {
  metadata: ModalMetadataSnapshot
}

/**
 * Creates encapsulated modal state with deterministic edit mode transitions.
 */
export function createModalState(input: CreateModalStateInput): ModalState {
  let metadata: ModalMetadataSnapshot = {
    hasApiFieldMetadata: input.metadata.hasApiFieldMetadata,
    apiTableColumns: [...input.metadata.apiTableColumns],
    matchedFields: [...input.metadata.matchedFields],
    apiRows: [...input.metadata.apiRows],
    selectedRowModels: [...input.metadata.selectedRowModels],
    sourceRows: [...input.metadata.sourceRows]
  }
  let editMode: EditMode = { type: 'idle' }
  let bindings: RowBinding[] = []
  let requiredOnly = false
  let metadataHydrationStarted = false
  let committing = false
  let committedOperations = false
  let expanded = false
  let metadataPollHandle: MetadataPollHandle | null = null
  const preloadedLookupPaths = new Set<string>()
  const rowIdByDomRowIndex = new Map<number, string>()
  const columnWidthByIndex = new Map<number, number>()
  const multiEditInitialDisplayByFieldId = new Map<string, string>()
  const multiEditMismatchFieldIds = new Set<string>()

  function getMetadata(): ModalMetadataSnapshot {
    return {
      hasApiFieldMetadata: metadata.hasApiFieldMetadata,
      apiTableColumns: [...metadata.apiTableColumns],
      matchedFields: [...metadata.matchedFields],
      apiRows: [...metadata.apiRows],
      selectedRowModels: [...metadata.selectedRowModels],
      sourceRows: [...metadata.sourceRows]
    }
  }

  function setMetadata(snapshot: Partial<ModalMetadataSnapshot>): void {
    metadata = {
      hasApiFieldMetadata: snapshot.hasApiFieldMetadata ?? metadata.hasApiFieldMetadata,
      apiTableColumns: snapshot.apiTableColumns ? [...snapshot.apiTableColumns] : metadata.apiTableColumns,
      matchedFields: snapshot.matchedFields ? [...snapshot.matchedFields] : metadata.matchedFields,
      apiRows: snapshot.apiRows ? [...snapshot.apiRows] : metadata.apiRows,
      selectedRowModels: snapshot.selectedRowModels ? [...snapshot.selectedRowModels] : metadata.selectedRowModels,
      sourceRows: snapshot.sourceRows ? [...snapshot.sourceRows] : metadata.sourceRows
    }
  }

  return {
    getMetadata,
    setMetadata,
    getEditMode: () => editMode,
    setEditMode: (mode) => {
      editMode = mode
    },
    clearEditMode: () => {
      editMode = { type: 'idle' }
    },
    getBindings: () => [...bindings],
    setBindings: (nextBindings) => {
      bindings = [...nextBindings]
    },
    isRequiredOnly: () => requiredOnly,
    setRequiredOnly: (value) => {
      requiredOnly = value
    },
    isMetadataHydrationStarted: () => metadataHydrationStarted,
    markMetadataHydrationStarted: () => {
      metadataHydrationStarted = true
    },
    isCommitting: () => committing,
    setCommitting: (value) => {
      committing = value
    },
    hasCommittedOperations: () => committedOperations,
    markCommittedOperations: () => {
      committedOperations = true
    },
    isExpanded: () => expanded,
    setExpanded: (value) => {
      expanded = value
    },
    isLookupPathPreloaded: (path) => preloadedLookupPaths.has(path),
    markLookupPathPreloaded: (path) => {
      preloadedLookupPaths.add(path)
    },
    getLookupPreloadPaths: () => Array.from(preloadedLookupPaths),
    clearLookupPreloadPaths: () => {
      preloadedLookupPaths.clear()
    },
    getMetadataPollHandle: () => metadataPollHandle,
    setMetadataPollHandle: (handle) => {
      metadataPollHandle = handle
    },
    getRowIdEntries: () =>
      Array.from(rowIdByDomRowIndex.entries()).map(([domRowIndex, rowId]) => ({ domRowIndex, rowId })),
    setRowId: (domRowIndex, rowId) => {
      rowIdByDomRowIndex.set(domRowIndex, rowId)
    },
    clearRowIds: () => {
      rowIdByDomRowIndex.clear()
    },
    getColumnWidthEntries: () =>
      Array.from(columnWidthByIndex.entries()).map(([columnIndex, width]) => ({ columnIndex, width })),
    setColumnWidth: (columnIndex, width) => {
      columnWidthByIndex.set(columnIndex, width)
    },
    getMultiEditSeed: () => ({
      initialValues: new Map(multiEditInitialDisplayByFieldId),
      mismatchFieldIds: new Set(multiEditMismatchFieldIds)
    }),
    setMultiEditSeed: (initialValues, mismatchFieldIds) => {
      multiEditInitialDisplayByFieldId.clear()
      multiEditMismatchFieldIds.clear()
      for (const [fieldId, value] of initialValues.entries()) {
        multiEditInitialDisplayByFieldId.set(fieldId, value)
      }
      for (const fieldId of mismatchFieldIds.values()) {
        multiEditMismatchFieldIds.add(fieldId)
      }
    },
    clearMultiEditSeed: () => {
      multiEditInitialDisplayByFieldId.clear()
      multiEditMismatchFieldIds.clear()
    }
  }
}
