import { getLatestGridViewIdForContext } from '../../grid-services/gridApiMetadata'
import type { GridService } from '../services/gridService'
import type { ModalDomRefs } from '../view/shell/GridModalShell'
import type { ModalState } from './modalState'
import type { GridAdvancedEditorPermissions } from '../services/permissions.service'
import type { SelectionManager } from './selectionState'
import type { StagingManager } from '../services/staging.service'
import type { ValidationManager } from '../services/validation.service'
import type { ViewRenderer } from '../view/viewRenderer'
import { showCommitConfirm, showCommitErrors, showCommitProgressDialog, showRevertConfirm } from '../view/dialogs/GridDialogs'
import type { PlmExtRuntime } from '../../../../shared/runtime/types'
import {
  formatNumericBoundary,
  isNumericPayloadType,
  parseNumericPayloadValue,
  resolveNumericBounds
} from './commitPayload.helpers'
import { commitStagedChanges } from './commitStagedChanges'

/**
 * Progress event emitted during staged commit execution.
 */
export interface CommitProgress {
  message: string
  completed: number
  total: number
  phaseCurrent: number
  phaseTotal: number
  phase: 'remove' | 'update' | 'insert' | 'complete'
}

/**
 * Action binding contract for add/edit/clone/remove/revert/commit handlers.
 */
export interface BindModalActionsInput {
  refs: ModalDomRefs
  state: ModalState
  selection: SelectionManager
  staging: StagingManager
  validation: ValidationManager
  permissions: GridAdvancedEditorPermissions
  gridService: GridService
  ext: Pick<PlmExtRuntime, 'requestPlmAction'> | null | undefined
  tenant: string | null
  route: { workspaceId: number; dmsId: number } | null
  view: ViewRenderer
  setStatus: (message?: string) => void
  renderForm: () => void
  syncActionState: () => void
  updateCommitState: () => void
  selectedDomRowIndexes: () => number[]
  setCommitErrors: (existingRowIndexes: number[], insertIndexes: number[]) => void
  clearCommitErrors: () => void
  refreshMetadataAfterCommit: () => Promise<void>
  closeModalAfterSave: () => void
}

export function bindModalActions(input: BindModalActionsInput): void {
  const {
    refs,
    state,
    selection,
    staging,
    validation,
    permissions,
    gridService,
    ext,
    tenant,
    route,
    view,
    setStatus,
    renderForm,
    syncActionState,
    updateCommitState,
    selectedDomRowIndexes,
    setCommitErrors,
    clearCommitErrors,
    refreshMetadataAfterCommit,
    closeModalAfterSave
  } = input

  let lastCommitErrorExistingIndexes: number[] = []
  let lastCommitErrorInsertIndexes: number[] = []
  const applyCommitErrors = (existingIndexes: number[], insertIndexes: number[]): void => {
    lastCommitErrorExistingIndexes = [...existingIndexes]
    lastCommitErrorInsertIndexes = [...insertIndexes]
    setCommitErrors(existingIndexes, insertIndexes)
  }
  const resetCommitErrors = (): void => {
    lastCommitErrorExistingIndexes = []
    lastCommitErrorInsertIndexes = []
    clearCommitErrors()
  }

  refs.selectErroredAction.addEventListener('click', () => {
    if (lastCommitErrorExistingIndexes.length === 0 && lastCommitErrorInsertIndexes.length === 0) return
    selection.clearSelection()
    for (const rowIndex of lastCommitErrorExistingIndexes) selection.selectRow(rowIndex)
    for (const insertIndex of lastCommitErrorInsertIndexes) selection.selectInsert(insertIndex)
    state.clearEditMode()
    setStatus(`Selected errored rows. ${selection.selectionCountText()}.`)
    renderForm()
  })

  refs.addAction.addEventListener('click', () => {
    resetCommitErrors()
    if (!permissions.canAdd) return setStatus('Missing permission: Add to Grid.')
    const meta = state.getMetadata()
    if (!meta.hasApiFieldMetadata) return setStatus('Metadata still loading. Please wait before staging changes.')
    const draft = staging.buildAddDraftFromFields(meta.apiTableColumns)
    if (draft.payload.size === 0) return setStatus('No editable fields available to add.')
    const insertIndex = staging.addInsertDraft(draft)
    selection.clearSelection()
    if (meta.selectedRowModels.length === 0) {
      selection.selectInsert(insertIndex)
      state.setEditMode({ type: 'insert', insertIndex })
    } else {
      state.clearEditMode()
    }
    renderForm()
    setStatus(meta.selectedRowModels.length === 0 ? 'New row staged. Editing new row.' : 'New row staged. Select row(s) and click Edit Selected when ready.')
    updateCommitState()
  })

  refs.editAction.addEventListener('click', () => {
    resetCommitErrors()
    if (!permissions.canEdit) return setStatus('Missing permission: Edit Grid.')
    const meta = state.getMetadata()
    const selected = selection.getSelectionSummary()
    if (!meta.hasApiFieldMetadata) return setStatus('Metadata still loading. Please wait before editing.')
    if (selected.count === 0) return setStatus('Select at least one row and click Edit Selected.')
    if (selected.count === 1) {
      state.clearMultiEditSeed()
      if (selected.existingCount === 1) state.setEditMode({ type: 'single', rowIndex: selected.existingRowIndexes[0]! })
      else state.setEditMode({ type: 'insert', insertIndex: selected.insertIndexes[0]! })
      setStatus('Editing selected row.')
      return renderForm()
    }
    const seed = staging.buildMultiEditSeed(
      meta.selectedRowModels,
      selected.existingRowIndexes,
      selected.insertIndexes,
      meta.apiTableColumns,
      (model, column) => gridService.getApiTableValueForRow(model, column, staging.getPendingChangesMap())
    )
    state.setMultiEditSeed(seed.initialValues, seed.mismatchFieldIds)
    state.setEditMode({ type: 'multi', rowIndexes: new Set(selected.existingRowIndexes) })
    setStatus(`Editing ${selected.count} rows. Update fields to apply to all selected.`)
    renderForm()
  })

  refs.cloneAction.addEventListener('click', () => {
    resetCommitErrors()
    if (!permissions.canAdd) return setStatus('Missing permission: Add to Grid.')
    const meta = state.getMetadata()
    const selected = selection.getSelectionSummary()
    if (!meta.hasApiFieldMetadata) return setStatus('Metadata still loading. Please wait before staging changes.')
    const oneExisting = selected.existingCount === 1 && selected.insertCount === 0
    const oneInsert = selected.existingCount === 0 && selected.insertCount === 1
    if (!oneExisting && !oneInsert) {
      return setStatus('Clone one row at a time: select a single existing row or a single new row.')
    }
    void (async () => {
      await gridService.ensureValidatorsHydratedForCurrentGrid()
      let cloneDraft: ReturnType<StagingManager['buildCloneDraftFromModel']>
      if (oneExisting) {
        const model = meta.selectedRowModels[selected.existingRowIndexes[0]!]
        if (!model) return setStatus('No values available to clone.')
        cloneDraft = staging.buildCloneDraftFromModel(model, meta.apiTableColumns)
      } else {
        const insertIndex = selected.insertIndexes[0]
        if (typeof insertIndex !== 'number' || insertIndex < 0 || insertIndex >= staging.getInsertCount()) {
          return setStatus('No staged new row to clone.')
        }
        cloneDraft = staging.buildCloneDraftFromInsertAt(insertIndex, meta.apiTableColumns)
      }
      if (cloneDraft.payload.size === 0) return setStatus('No values available to clone.')
      staging.addInsertDraft(cloneDraft)
      state.clearEditMode()
      renderForm()
      const uniqueFieldCount = gridService.getUniqueInGridFieldIdsForCurrentGrid().length
      setStatus(
        uniqueFieldCount > 0
          ? 'Cloned 1 row(s). Unique fields were cleared — enter new values before commit.'
          : 'Cloned 1 row(s).'
      )
      updateCommitState()
    })()
  })

  refs.removeAction.addEventListener('click', () => {
    resetCommitErrors()
    if (!permissions.canAdd && !permissions.canDelete) {
      return setStatus('Missing permission: Add to Grid or Delete from Grid.')
    }
    const meta = state.getMetadata()
    const selected = selection.getSelectionSummary()
    if (!meta.hasApiFieldMetadata) return setStatus('Metadata still loading. Please wait before staging changes.')
    if (selected.count === 0) return setStatus('Select at least one row to remove.')
    const existingIndexesToDeselect = [...selected.existingRowIndexes]
    staging.removeInsertDrafts(selected.insertIndexes)
    selection.shiftInsertSelectionAfterRemoval(selected.insertIndexes)
    const domRows = selected.existingRowIndexes
      .map((index) => meta.selectedRowModels[index]?.domRowIndex)
      .filter((value): value is number => Number.isFinite(value))
    staging.toggleRemovalForDomRows(domRows)
    for (const rowIndex of existingIndexesToDeselect) {
      selection.deselectRow(rowIndex)
    }
    state.clearEditMode()
    setStatus(`Updated remove selection. ${selection.selectionCountText()}.`)
    renderForm()
    updateCommitState()
  })

  refs.revertAction.addEventListener('click', () => {
    resetCommitErrors()
    if (!permissions.canEdit) return setStatus('Missing permission: Edit Grid.')
    const meta = state.getMetadata()
    if (!meta.hasApiFieldMetadata) return setStatus('Metadata still loading. Please wait before reverting changes.')
    const summary = staging.getSelectedRevertSummary(selectedDomRowIndexes())
    if (summary.total === 0) return setStatus('Select row(s) with staged edits or deletes to revert.')
    void (async () => {
      if (!(await showRevertConfirm(refs.overlay, summary))) return
      const reverted = staging.revertForDomRows(selectedDomRowIndexes())
      if (reverted === 0) setStatus('No staged changes found for selected rows.')
      else {
        state.clearEditMode()
        setStatus(`Reverted ${reverted} selected row change(s).`)
      }
      renderForm()
      updateCommitState()
    })()
  })

  async function runCommitFlow(closeAfterSuccess: boolean): Promise<void> {
    if (state.isCommitting()) return
    if (!ext || !tenant || !route) return setStatus('Cannot save: missing runtime context.')
    if (staging.getPendingOperationCount() === 0) return setStatus('No staged changes to save.')
    const stagedSummary = staging.getStagedSummary()
    if (!permissions.canAdd && stagedSummary.newRows > 0) return setStatus('Cannot save: missing Add to Grid permission for staged rows.')
    if (!permissions.canEdit && stagedSummary.editedRows > 0) return setStatus('Cannot save: missing Edit Grid permission for staged rows.')
    if (!permissions.canDelete && stagedSummary.deletedRows > 0) {
      return setStatus('Cannot save: missing Delete from Grid permission for staged removals.')
    }

    await (async () => {
      await gridService.ensureValidatorsHydratedForCurrentGrid()
      const meta = state.getMetadata()
      let modelByDomRowIndex = staging.buildModelByDomRowIndex(meta.selectedRowModels)
      const requiredIssues = validation.getRequiredValidationIssues(modelByDomRowIndex)
      if (requiredIssues.length > 0) {
        const preview = requiredIssues.slice(0, 3).map((issue) => `${issue.rowLabel}: ${issue.fieldTitle}`).join(', ')
        setStatus(`Required fields missing. ${preview}${requiredIssues.length > 3 ? ` (+${requiredIssues.length - 3} more)` : ''}.`)
        return
      }
      const uniqueIssues = validation.getUniqueInGridValidationIssues(modelByDomRowIndex)
      if (uniqueIssues.length > 0) {
        const preview = uniqueIssues
          .slice(0, 3)
          .map((issue) => `${issue.rowLabel}: ${issue.fieldTitle} ("${issue.duplicateValue}")`)
          .join(', ')
        setStatus(
          `Duplicate values for fields that must be unique in the grid. ${preview}${uniqueIssues.length > 3 ? ` (+${uniqueIssues.length - 3} more)` : ''}.`
        )
        return
      }

      const numericIssues: string[] = []
      const fieldById = new Map(meta.apiTableColumns.map((column) => [column.field.fieldId, column.field]))
      const snapshot = staging.getSnapshot()
      for (const update of snapshot.updates) {
        for (const entry of update.payload) {
          const field = fieldById.get(entry.fieldId)
          if (!field) continue
          const payloadType = gridService.toGridPayloadType(field)
          if (!isNumericPayloadType(payloadType)) continue
          const parsedValue = parseNumericPayloadValue(entry.value)
          if (parsedValue === null) continue
          const bounds = resolveNumericBounds(field)
          if (bounds.min !== null && parsedValue < bounds.min) {
            const message =
              bounds.max !== null
                ? `Row ${update.domRowIndex + 1}: ${field.title} must be between ${formatNumericBoundary(bounds.min, bounds.precision)} and ${formatNumericBoundary(bounds.max, bounds.precision)}.`
                : `Row ${update.domRowIndex + 1}: ${field.title} minimum is ${formatNumericBoundary(bounds.min, bounds.precision)}.`
            numericIssues.push(message)
            continue
          }
          if (bounds.max !== null && parsedValue > bounds.max) {
            const message =
              bounds.min !== null
                ? `Row ${update.domRowIndex + 1}: ${field.title} must be between ${formatNumericBoundary(bounds.min, bounds.precision)} and ${formatNumericBoundary(bounds.max, bounds.precision)}.`
                : `Row ${update.domRowIndex + 1}: ${field.title} maximum is ${formatNumericBoundary(bounds.max, bounds.precision)}.`
            numericIssues.push(message)
          }
        }
      }

      for (let insertIndex = 0; insertIndex < snapshot.inserts.length; insertIndex += 1) {
        const insert = snapshot.inserts[insertIndex]!
        for (const entry of insert.payload) {
          const field = fieldById.get(entry.fieldId)
          if (!field) continue
          const payloadType = gridService.toGridPayloadType(field)
          if (!isNumericPayloadType(payloadType)) continue
          const parsedValue = parseNumericPayloadValue(entry.value)
          if (parsedValue === null) continue
          const bounds = resolveNumericBounds(field)
          if (bounds.min !== null && parsedValue < bounds.min) {
            const message =
              bounds.max !== null
                ? `New Row ${insertIndex + 1}: ${field.title} must be between ${formatNumericBoundary(bounds.min, bounds.precision)} and ${formatNumericBoundary(bounds.max, bounds.precision)}.`
                : `New Row ${insertIndex + 1}: ${field.title} minimum is ${formatNumericBoundary(bounds.min, bounds.precision)}.`
            numericIssues.push(message)
            continue
          }
          if (bounds.max !== null && parsedValue > bounds.max) {
            const message =
              bounds.min !== null
                ? `New Row ${insertIndex + 1}: ${field.title} must be between ${formatNumericBoundary(bounds.min, bounds.precision)} and ${formatNumericBoundary(bounds.max, bounds.precision)}.`
                : `New Row ${insertIndex + 1}: ${field.title} maximum is ${formatNumericBoundary(bounds.max, bounds.precision)}.`
            numericIssues.push(message)
          }
        }
      }

      if (numericIssues.length > 0) {
        const preview = numericIssues.slice(0, 2).join(' ')
        setStatus(`Numeric value out of range. ${preview}${numericIssues.length > 2 ? ` (+${numericIssues.length - 2} more)` : ''}`)
        return
      }

      if (!(await showCommitConfirm(refs.overlay, staging.getStagedSummary()))) return
      state.setCommitting(true)
      resetCommitErrors()
      syncActionState()
      updateCommitState()
      const totalOps = staging.getPendingOperationCount()
      setStatus('Saving staged row updates...')
      view.setCommitProgress(0, totalOps, 'Starting save')
      const progressDialog = showCommitProgressDialog(refs.overlay, staging.getStagedSummary())

      modelByDomRowIndex = staging.buildModelByDomRowIndex(meta.selectedRowModels)
      const fullRowPayloadByDomRowIndex = new Map<number, Map<string, string>>()
      const fullRowDisplayByDomRowIndex = new Map<number, Map<string, string>>()
      for (const update of staging.getSnapshot().updates) {
        const model = modelByDomRowIndex.get(update.domRowIndex)
        if (!model) continue
        const payload = new Map<string, string>()
        const display = new Map<string, string>()
        for (const column of meta.apiTableColumns) {
          if (!column.field.editable) continue
          payload.set(
            column.field.fieldId,
            staging.getPayloadValueForModelField(model, column, (nextModel, nextColumn) =>
              gridService.getApiTableValueForRow(nextModel, nextColumn, staging.getPendingChangesMap())
            )
          )
          display.set(
            column.field.fieldId,
            staging.getDisplayValueForModelField(model, column, (nextModel, nextColumn) =>
              gridService.getApiTableValueForRow(nextModel, nextColumn, staging.getPendingChangesMap())
            )
          )
        }
        fullRowPayloadByDomRowIndex.set(update.domRowIndex, payload)
        fullRowDisplayByDomRowIndex.set(update.domRowIndex, display)
      }

      const currentViewId = getLatestGridViewIdForContext(route.workspaceId, route.dmsId) || 13
      const { successCount, failures } = await commitStagedChanges(
        staging,
        {
          ext,
          tenant,
          workspaceId: route.workspaceId,
          dmsId: route.dmsId,
          viewId: currentViewId,
          fieldById,
          modelByDomRowIndex,
          rowIdByDomRowIndex: new Map(state.getRowIdEntries().map((entry) => [entry.domRowIndex, entry.rowId])),
          fullRowPayloadByDomRowIndex,
          fullRowDisplayByDomRowIndex,
          toGridPayloadType: gridService.toGridPayloadType
        },
        (progress: CommitProgress) => {
          setStatus(progress.message)
          view.setCommitProgress(progress.completed, progress.total, progress.message)
          progressDialog.setMessage(progress.message)
          if (progress.phase === 'remove') {
            progressDialog.setCategoryProgress('delete', progress.phaseCurrent, progress.phaseTotal)
          } else if (progress.phase === 'update') {
            progressDialog.setCategoryProgress('update', progress.phaseCurrent, progress.phaseTotal)
          } else if (progress.phase === 'insert') {
            progressDialog.setCategoryProgress('new', progress.phaseCurrent, progress.phaseTotal)
          }
        }
      )

      state.setCommitting(false)
      if (successCount > 0) state.markCommittedOperations()
      syncActionState()
      updateCommitState()
      view.scheduleCommitProgressHide(1400, state.isCommitting())
      if (failures.length > 0) {
        const failedExistingDomRows = failures
          .filter((failure) => Number.isFinite(failure.domRowIndex))
          .map((failure) => Number(failure.domRowIndex))
        const failedExistingIndexes = state
          .getMetadata()
          .selectedRowModels
          .map((model, index) => (failedExistingDomRows.includes(model.domRowIndex) ? index : -1))
          .filter((index) => index >= 0)
        const failedInsertIndexes = failures
          .filter((failure) => Number.isFinite(failure.insertIndex))
          .map((failure) => Number(failure.insertIndex))
        applyCommitErrors(failedExistingIndexes, failedInsertIndexes)
        view.setCommitProgress(totalOps - failures.length, totalOps, `Completed with failures (${failures.length})`)
        setStatus(`Saved ${successCount} operation(s). ${failures.length} failed.`)
        const messages = failures.map((failure) => `${failure.rowLabel}: ${failure.message}`)
        progressDialog.close()
        await showCommitErrors(refs.overlay, messages)
        selection.clearSelection()
        for (const index of failedExistingIndexes) selection.selectRow(index)
        for (const index of failedInsertIndexes) selection.selectInsert(index)
        renderForm()
      } else {
        view.setCommitProgress(totalOps, totalOps, 'Save complete')
        progressDialog.close()
        await refreshMetadataAfterCommit()
        setStatus(`Saved ${successCount} operation(s) successfully.`)
        if (closeAfterSuccess) closeModalAfterSave()
      }
    })()
  }

  refs.commitAction.addEventListener('click', () => {
    void runCommitFlow(false)
  })
  refs.commitAndCloseAction.addEventListener('click', () => {
    void runCommitFlow(true)
  })
}

