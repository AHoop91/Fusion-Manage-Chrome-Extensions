import { isLookupFieldType, isLookupPayloadValue, isMultiLookupFieldType, isRadioFieldType } from './fieldTypes'
import type { FormRenderer } from '../view/formRenderer'
import type { GridService } from '../services/gridService'
import type { ApiTableColumn, RowBinding, SelectedRowModel } from '../types'
import type { SelectedRevertSummary } from '../view/dialogs/GridDialogs'
import type { PendingInsertDraftLike } from '../view/formFieldsRenderer'
import { createStagingQueue, type InternalStagingQueue } from './stagingQueue'
import { createStagedSummary, type StagedSummary } from '../view/summaryView'
import type { EditMode } from '../controller/modalState'

/**
 * Flat field/value pair used by renderer-facing snapshots.
 */
export interface PendingFieldValue {
  fieldId: string
  value: string
}

/**
 * Pure row update snapshot exposed to controller/view.
 */
export interface PendingRowUpdateView {
  domRowIndex: number
  payload: PendingFieldValue[]
  display: PendingFieldValue[]
}

/**
 * Pure insert draft snapshot exposed to controller/view.
 */
export interface PendingInsertDraftView {
  index: number
  source: 'add' | 'clone'
  payload: PendingFieldValue[]
  display: PendingFieldValue[]
}

/**
 * Staging snapshot for renderer/validator usage without exposing mutable maps.
 */
export interface StagingSnapshot {
  updates: PendingRowUpdateView[]
  removals: number[]
  inserts: PendingInsertDraftView[]
}

/**
 * Result from staging active form controls into queue state.
 */
export interface StageDraftResult {
  changed: boolean
  message: string
}

/**
 * Input contract used for staging from current form bindings.
 */
export interface StageDraftInput {
  editMode: EditMode
  bindings: RowBinding[]
  selectedRowModels: SelectedRowModel[]
  multiEditInsertIndexes: number[]
  multiEditInitialDisplayByFieldId: Map<string, string>
}

/**
 * Dependencies needed by staging manager for payload/display conversion.
 */
export interface StagingManagerDeps {
  gridService: GridService
  formRenderer: FormRenderer
}

/**
 * Staging manager contract owning all staged insert/update/remove mutations.
 */
export interface StagingManager {
  getQueue: () => InternalStagingQueue
  clearAll: () => void
  getPendingOperationCount: () => number
  getStagedSummary: () => StagedSummary
  getSnapshot: () => StagingSnapshot
  getInsertDraftAt: (insertIndex: number) => PendingInsertDraftLike | null
  getInsertCount: () => number
  getPendingChangesMap: () => Map<number, Map<string, string>>
  getPendingDisplayMap: () => Map<number, Map<string, string>>
  getPendingRemovalSet: () => Set<number>
  buildAddDraftFromFields: (columns: ApiTableColumn[]) => PendingInsertDraftLike
  addInsertDraft: (draft: PendingInsertDraftLike) => number
  replaceInsertDraft: (insertIndex: number, draft: PendingInsertDraftLike) => void
  removeInsertDrafts: (insertIndexes: number[]) => number
  buildCloneDraftFromModel: (model: SelectedRowModel, columns: ApiTableColumn[]) => PendingInsertDraftLike
  getDisplayValueForModelField: (
    model: SelectedRowModel,
    column: ApiTableColumn,
    fallbackResolver: (model: SelectedRowModel, column: ApiTableColumn) => string
  ) => string
  getPayloadValueForModelField: (
    model: SelectedRowModel,
    column: ApiTableColumn,
    fallbackResolver: (model: SelectedRowModel, column: ApiTableColumn) => string
  ) => string
  buildModelByDomRowIndex: (selectedRowModels: SelectedRowModel[]) => Map<number, SelectedRowModel>
  toggleRemovalForDomRows: (domRowIndexes: number[]) => number
  revertForDomRows: (domRowIndexes: number[]) => number
  getSelectedRevertSummary: (domRowIndexes: number[]) => SelectedRevertSummary
  buildMultiEditSeed: (
    selectedRowModels: SelectedRowModel[],
    existingRowIndexes: number[],
    insertIndexes: number[],
    columns: ApiTableColumn[],
    fallbackResolver: (model: SelectedRowModel, column: ApiTableColumn) => string
  ) => { initialValues: Map<string, string>; mismatchFieldIds: Set<string> }
  stageDraftFromBindings: (input: StageDraftInput) => StageDraftResult
}

function mapToArray(map: Map<string, string>): PendingFieldValue[] {
  return Array.from(map.entries()).map(([fieldId, value]) => ({ fieldId, value }))
}

function arrayToMap(values: PendingFieldValue[]): Map<string, string> {
  return new Map(values.map((value) => [value.fieldId, value.value]))
}

function getControlBaseValue(binding: RowBinding): string {
  if (binding.control instanceof HTMLInputElement && binding.control.type === 'checkbox') {
    return binding.control.checked ? 'true' : 'false'
  }
  if (binding.control instanceof HTMLFieldSetElement && isRadioFieldType(binding.field.typeId)) {
    const currentValue = String(binding.control.dataset.plmLookupCurrentValue || '').trim()
    const currentLink = String(binding.control.dataset.plmLookupCurrentLink || '').trim()
    return currentValue || currentLink || ''
  }
  if (
    binding.control instanceof HTMLInputElement ||
    binding.control instanceof HTMLTextAreaElement ||
    binding.control instanceof HTMLSelectElement
  ) {
    return binding.control.value || ''
  }
  return ''
}

function hasControlInteraction(binding: RowBinding): boolean {
  return binding.control.dataset.plmTouched === 'true'
}

/**
 * Creates staging manager with private queue-backed staging structures.
 */
export function createStagingManager(deps: StagingManagerDeps): StagingManager {
  const queue = createStagingQueue()
  const pendingChangesByDomRowIndex = queue.getUpdatePayloads()
  const pendingDisplayByDomRowIndex = queue.getUpdateDisplays()
  const pendingRemovalRowIndexes = queue.getRemovals()
  const pendingInsertDrafts = queue.getInserts() as PendingInsertDraftLike[]

  function getControlDisplayValue(binding: RowBinding): string {
    if (binding.control instanceof HTMLFieldSetElement && isRadioFieldType(binding.field.typeId)) {
      const label = String(binding.control.dataset.plmLookupCurrentLabel || '').trim()
      if (label && label.toLowerCase() !== 'select...') return label
      return ''
    }
    let nextValue = getControlBaseValue(binding)
    const fieldUsesLookup = isLookupFieldType(binding.field.typeId) || Boolean(binding.field.picklistPath)
    if (fieldUsesLookup && binding.control instanceof HTMLInputElement) {
      const currentLabel = String(binding.control.dataset.plmLookupCurrentLabel || '').trim()
      const currentLink = String(binding.control.dataset.plmLookupCurrentLink || '').trim()
      const multiSelect = isMultiLookupFieldType(binding.field.typeId)
      if (currentLabel && (multiSelect || nextValue === currentLink || isLookupPayloadValue(nextValue))) {
        nextValue = currentLabel
      }
    }
    return nextValue
  }

  function getControlPayloadValue(binding: RowBinding): string {
    if (binding.control instanceof HTMLFieldSetElement && isRadioFieldType(binding.field.typeId)) {
      const selectedValue = String(binding.control.dataset.plmLookupCurrentValue || '').trim()
      const linkedValue = String(binding.control.dataset.plmLookupCurrentLink || '').trim()
      return linkedValue || selectedValue
    }
    let nextValue = getControlBaseValue(binding)
    if (binding.field.kind === 'date') nextValue = deps.gridService.parseDateToInputValue(nextValue)
    const fieldUsesLookup = isLookupFieldType(binding.field.typeId) || Boolean(binding.field.picklistPath)
    if (fieldUsesLookup && binding.control instanceof HTMLInputElement) {
      nextValue = deps.formRenderer.resolveLookupPayloadValue(
        binding.control,
        nextValue,
        isMultiLookupFieldType(binding.field.typeId)
      )
    }
    return nextValue
  }

  function buildPayloadFromBindings(bindings: RowBinding[]): Map<string, string> {
    const payload = new Map<string, string>()
    for (const binding of bindings) {
      if (!binding.field.editable) continue
      payload.set(binding.field.fieldId, getControlPayloadValue(binding))
    }
    return payload
  }

  function buildDisplayFromBindings(bindings: RowBinding[]): Map<string, string> {
    const display = new Map<string, string>()
    for (const binding of bindings) {
      if (!binding.field.editable) continue
      display.set(binding.field.fieldId, getControlDisplayValue(binding))
    }
    return display
  }

  function getSnapshot(): StagingSnapshot {
    const updates: PendingRowUpdateView[] = []
    for (const [domRowIndex, payload] of pendingChangesByDomRowIndex.entries()) {
      updates.push({
        domRowIndex,
        payload: mapToArray(payload),
        display: mapToArray(pendingDisplayByDomRowIndex.get(domRowIndex) || new Map<string, string>())
      })
    }
    return {
      updates,
      removals: Array.from(pendingRemovalRowIndexes.values()).sort((a, b) => a - b),
      inserts: pendingInsertDrafts.map((draft, index) => ({
        index,
        source: draft.source,
        payload: mapToArray(draft.payload),
        display: mapToArray(draft.display)
      }))
    }
  }

  function getDisplayValueForModelField(
    model: SelectedRowModel,
    column: ApiTableColumn,
    fallbackResolver: (model: SelectedRowModel, column: ApiTableColumn) => string
  ): string {
    const pendingDisplay = pendingDisplayByDomRowIndex.get(model.domRowIndex)?.get(column.field.fieldId)
    if (typeof pendingDisplay === 'string') return pendingDisplay
    const resolved = fallbackResolver(model, column)
    return resolved || column.field.defaultValue || ''
  }

  function getPayloadValueForModelField(
    model: SelectedRowModel,
    column: ApiTableColumn,
    fallbackResolver: (model: SelectedRowModel, column: ApiTableColumn) => string
  ): string {
    const pendingPayload = pendingChangesByDomRowIndex.get(model.domRowIndex)?.get(column.field.fieldId)
    if (typeof pendingPayload === 'string') return pendingPayload
    const link = model.apiRow?.byFieldLink.get(column.field.fieldId)
    if (typeof link === 'string' && link) return link
    const display = getDisplayValueForModelField(model, column, fallbackResolver)
    if (display) return display
    return column.field.defaultPayloadValue || column.field.defaultValue || ''
  }

  return {
    getQueue: () => queue,
    clearAll: () => queue.clear(),
    getPendingOperationCount: () => queue.count(),
    getStagedSummary: () =>
      createStagedSummary(pendingInsertDrafts.length, pendingChangesByDomRowIndex.size, pendingRemovalRowIndexes.size),
    getSnapshot,
    getInsertDraftAt: (insertIndex) => pendingInsertDrafts[insertIndex] || null,
    getInsertCount: () => pendingInsertDrafts.length,
    getPendingChangesMap: () => new Map(Array.from(pendingChangesByDomRowIndex.entries()).map(([k, v]) => [k, new Map(v)])),
    getPendingDisplayMap: () => new Map(Array.from(pendingDisplayByDomRowIndex.entries()).map(([k, v]) => [k, new Map(v)])),
    getPendingRemovalSet: () => new Set(pendingRemovalRowIndexes),
    buildAddDraftFromFields: (columns) => {
      const payload = new Map<string, string>()
      const display = new Map<string, string>()
      for (const column of columns) {
        if (!column.field.editable) continue
        const defaultDisplay = column.field.defaultValue || ''
        const defaultPayload = column.field.defaultPayloadValue || defaultDisplay
        payload.set(column.field.fieldId, defaultPayload)
        display.set(column.field.fieldId, defaultDisplay)
      }
      return { payload, display, source: 'add' }
    },
    addInsertDraft: (draft) => {
      pendingInsertDrafts.push({
        payload: new Map(draft.payload),
        display: new Map(draft.display),
        source: draft.source
      })
      return pendingInsertDrafts.length - 1
    },
    replaceInsertDraft: (insertIndex, draft) => {
      if (insertIndex < 0 || insertIndex >= pendingInsertDrafts.length) return
      pendingInsertDrafts[insertIndex] = {
        payload: new Map(draft.payload),
        display: new Map(draft.display),
        source: draft.source
      }
    },
    removeInsertDrafts: (insertIndexes) => {
      const sorted = [...insertIndexes].sort((a, b) => b - a)
      let removed = 0
      for (const index of sorted) {
        if (index < 0 || index >= pendingInsertDrafts.length) continue
        pendingInsertDrafts.splice(index, 1)
        removed += 1
      }
      return removed
    },
    buildCloneDraftFromModel: (model, columns) => {
      const payload = new Map<string, string>()
      const display = new Map<string, string>()
      for (const column of columns) {
        if (!column.field.editable) continue
        payload.set(
          column.field.fieldId,
          getPayloadValueForModelField(model, column, (nextModel, nextColumn) =>
            deps.gridService.getApiTableValueForRow(nextModel, nextColumn, pendingChangesByDomRowIndex)
          )
        )
        display.set(
          column.field.fieldId,
          getDisplayValueForModelField(model, column, (nextModel, nextColumn) =>
            deps.gridService.getApiTableValueForRow(nextModel, nextColumn, pendingChangesByDomRowIndex)
          )
        )
      }
      return { payload, display, source: 'clone' }
    },
    getDisplayValueForModelField,
    getPayloadValueForModelField,
    buildModelByDomRowIndex: (selectedRowModels) => {
      const modelByDomRowIndex = new Map<number, SelectedRowModel>()
      for (const model of selectedRowModels) modelByDomRowIndex.set(model.domRowIndex, model)
      return modelByDomRowIndex
    },
    toggleRemovalForDomRows: (domRowIndexes) => {
      let toggled = 0
      for (const domRowIndex of domRowIndexes) {
        if (pendingRemovalRowIndexes.has(domRowIndex)) {
          pendingRemovalRowIndexes.delete(domRowIndex)
        } else {
          pendingRemovalRowIndexes.add(domRowIndex)
          pendingChangesByDomRowIndex.delete(domRowIndex)
          pendingDisplayByDomRowIndex.delete(domRowIndex)
        }
        toggled += 1
      }
      return toggled
    },
    revertForDomRows: (domRowIndexes) => {
      let reverted = 0
      for (const domRowIndex of domRowIndexes) {
        const hadPending =
          pendingChangesByDomRowIndex.has(domRowIndex) ||
          pendingDisplayByDomRowIndex.has(domRowIndex) ||
          pendingRemovalRowIndexes.has(domRowIndex)
        pendingChangesByDomRowIndex.delete(domRowIndex)
        pendingDisplayByDomRowIndex.delete(domRowIndex)
        pendingRemovalRowIndexes.delete(domRowIndex)
        if (hadPending) reverted += 1
      }
      return reverted
    },
    getSelectedRevertSummary: (domRowIndexes) => {
      let editedRows = 0
      let deletedRows = 0
      for (const domRowIndex of domRowIndexes) {
        const isDeleted = pendingRemovalRowIndexes.has(domRowIndex)
        const isEdited = pendingChangesByDomRowIndex.has(domRowIndex) || pendingDisplayByDomRowIndex.has(domRowIndex)
        if (isDeleted) deletedRows += 1
        else if (isEdited) editedRows += 1
      }
      return {
        editedRows,
        deletedRows,
        total: editedRows + deletedRows
      }
    },
    buildMultiEditSeed: (
      selectedRowModels,
      existingRowIndexes,
      insertIndexes,
      columns,
      fallbackResolver
    ) => {
      const initialValues = new Map<string, string>()
      const mismatchFieldIds = new Set<string>()

      const selectedModels = existingRowIndexes
        .map((index) => selectedRowModels[index])
        .filter((model): model is SelectedRowModel => Boolean(model))
      const selectedInsertDrafts = insertIndexes
        .map((index) => pendingInsertDrafts[index])
        .filter((draft): draft is PendingInsertDraftLike => Boolean(draft))

      for (const column of columns) {
        const values: string[] = []
        for (const model of selectedModels) {
          values.push(getDisplayValueForModelField(model, column, fallbackResolver))
        }
        for (const draft of selectedInsertDrafts) {
          values.push(String(draft.display.get(column.field.fieldId) || ''))
        }
        if (values.length === 0) continue
        const first = values[0] || ''
        const same = values.every((value) => String(value || '') === String(first || ''))
        if (same) initialValues.set(column.field.fieldId, first)
        else {
          initialValues.set(column.field.fieldId, '')
          mismatchFieldIds.add(column.field.fieldId)
        }
      }
      return { initialValues, mismatchFieldIds }
    },
    stageDraftFromBindings: (input) => {
      const { editMode, bindings, selectedRowModels, multiEditInsertIndexes, multiEditInitialDisplayByFieldId } = input
      if (bindings.length === 0) return { changed: false, message: '' }

      if (editMode.type === 'idle') return { changed: false, message: '' }

      if (editMode.type === 'multi') {
        const changedPayload = new Map<string, string>()
        const changedDisplay = new Map<string, string>()
        for (const binding of bindings) {
          if (!binding.field.editable) continue
          const payloadValue = getControlPayloadValue(binding)
          const displayValue = getControlDisplayValue(binding)
          const initialDisplay = multiEditInitialDisplayByFieldId.get(binding.field.fieldId) || ''
          const isMismatchField = binding.control.dataset.plmMultiMismatch === 'true'
          const isExplicitClearForMismatch =
            isMismatchField &&
            hasControlInteraction(binding) &&
            displayValue === initialDisplay &&
            payloadValue === ''
          if (displayValue === initialDisplay && !isExplicitClearForMismatch) continue
          changedPayload.set(binding.field.fieldId, payloadValue)
          changedDisplay.set(binding.field.fieldId, displayValue)
        }
        if (changedPayload.size === 0) return { changed: false, message: 'No changes detected for selected rows.' }

        const existingModels = Array.from(editMode.rowIndexes.values())
          .map((index) => selectedRowModels[index])
          .filter((model): model is SelectedRowModel => Boolean(model))
        for (const model of existingModels) {
          const nextPayload = new Map<string, string>(pendingChangesByDomRowIndex.get(model.domRowIndex) || [])
          const nextDisplay = new Map<string, string>(pendingDisplayByDomRowIndex.get(model.domRowIndex) || [])
          for (const [fieldId, value] of changedPayload.entries()) nextPayload.set(fieldId, value)
          for (const [fieldId, value] of changedDisplay.entries()) nextDisplay.set(fieldId, value)
          pendingChangesByDomRowIndex.set(model.domRowIndex, nextPayload)
          pendingDisplayByDomRowIndex.set(model.domRowIndex, nextDisplay)
          pendingRemovalRowIndexes.delete(model.domRowIndex)
        }

        for (const insertIndex of multiEditInsertIndexes) {
          const draft = pendingInsertDrafts[insertIndex]
          if (!draft) continue
          const nextPayload = new Map<string, string>(draft.payload)
          const nextDisplay = new Map<string, string>(draft.display)
          for (const [fieldId, value] of changedPayload.entries()) nextPayload.set(fieldId, value)
          for (const [fieldId, value] of changedDisplay.entries()) nextDisplay.set(fieldId, value)
          pendingInsertDrafts[insertIndex] = { payload: nextPayload, display: nextDisplay, source: draft.source }
        }
        return { changed: true, message: 'Multi-row draft updated.' }
      }

      if (editMode.type === 'insert') {
        const currentDraft = pendingInsertDrafts[editMode.insertIndex]
        if (!currentDraft) return { changed: false, message: '' }
        pendingInsertDrafts[editMode.insertIndex] = {
          payload: buildPayloadFromBindings(bindings),
          display: buildDisplayFromBindings(bindings),
          source: currentDraft.source
        }
        return { changed: true, message: 'Row draft updated.' }
      }

      const model = selectedRowModels[editMode.rowIndex]
      if (!model) return { changed: false, message: '' }
      const pendingPayload = buildPayloadFromBindings(bindings)
      const pendingDisplay = buildDisplayFromBindings(bindings)
      if (pendingPayload.size === 0) {
        pendingChangesByDomRowIndex.delete(model.domRowIndex)
        pendingDisplayByDomRowIndex.delete(model.domRowIndex)
        return { changed: true, message: 'Row draft updated.' }
      }
      pendingChangesByDomRowIndex.set(model.domRowIndex, pendingPayload)
      pendingDisplayByDomRowIndex.set(model.domRowIndex, pendingDisplay)
      pendingRemovalRowIndexes.delete(model.domRowIndex)
      return { changed: true, message: 'Row draft updated.' }
    }
  }
}
