import { getLatestGridViewIdForContext } from '../../filters/data'
import type { GridService } from '../services/gridService'
import type { ApiTableColumn, CapturedGridRowField, SelectedRowModel } from '../types'
import type { ModalDomRefs } from '../view/shell/GridModalShell'
import type { ModalState } from './modalState'
import type { GridAdvancedEditorPermissions } from '../services/permissions.service'
import type { SelectionManager } from './selectionState'
import type { StagingManager } from '../services/staging.service'
import type { ValidationManager } from '../services/validation.service'
import type { ViewRenderer } from '../view/viewRenderer'
import { showCommitConfirm, showCommitErrors, showCommitProgressDialog, showRevertConfirm } from '../view/dialogs/GridDialogs'

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

type CommitContext = {
  ext: {
    requestPlmAction: <T = unknown>(action: string, payload?: Record<string, unknown>) => Promise<T>
  }
  tenant: string
  workspaceId: number
  dmsId: number
  viewId: number
  fieldById: Map<string, ApiTableColumn['field']>
  modelByDomRowIndex: Map<number, SelectedRowModel>
  rowIdByDomRowIndex: Map<number, string>
  fullRowPayloadByDomRowIndex?: Map<number, Map<string, string>>
  fullRowDisplayByDomRowIndex?: Map<number, Map<string, string>>
  toGridPayloadType: (field: ApiTableColumn['field']) => string
}

type GridCommitDataEntry = {
  fieldId: string
  type: string
  value: unknown
  display: string
  title: string
  typeId: number | null
  typeLink: string | null
  typeUrn: string | null
  typeTitle: string | null
  fieldSelf: string | null
  fieldUrn: string | null
}

type CommitFailure = {
  kind: 'insert' | 'update' | 'remove'
  rowLabel: string
  message: string
  domRowIndex?: number
  insertIndex?: number
}

type CommitResult = {
  successCount: number
  failures: CommitFailure[]
}

type NumericBounds = {
  min: number | null
  max: number | null
  precision: number
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
  ext: NonNullable<Window['__plmExt']> | undefined
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
}

function normalizePayloadValue(type: string, value: unknown): unknown {
  if (value == null) return value
  if (typeof value === 'object') return value

  const normalizedType = String(type || '').trim().toLowerCase()
  const normalizeNumeric = (rawValue: string, integerOnly: boolean): string => {
    let next = String(rawValue || '').trim()
    if (!next) return ''

    // Normalize display-style numbers (currency/grouping/trailing separators) to API-safe numeric strings.
    next = next.replace(/\s+/g, '').replace(/,/g, '').replace(/[^\d.\-]/g, '')
    if (!next || next === '-' || next === '.' || next === '-.') return ''

    const parsed = integerOnly ? Number.parseInt(next, 10) : Number(next)
    if (!Number.isFinite(parsed)) return String(rawValue || '').trim()
    return integerOnly ? String(Math.trunc(parsed)) : String(parsed)
  }

  if (normalizedType === 'multi-select') {
    return String(value || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
  }
  if (normalizedType === 'integer') return normalizeNumeric(String(value), true)
  if (normalizedType === 'number' || normalizedType === 'decimal' || normalizedType === 'money') {
    return normalizeNumeric(String(value), false)
  }
  return String(value)
}

function resolveNumericBounds(field: ApiTableColumn['field']): NumericBounds {
  const precision =
    typeof field.fieldPrecision === 'number' && Number.isFinite(field.fieldPrecision) && field.fieldPrecision > 0
      ? Math.floor(field.fieldPrecision)
      : 0
  const length =
    typeof field.fieldLength === 'number' && Number.isFinite(field.fieldLength) && field.fieldLength > 0
      ? Math.floor(field.fieldLength)
      : null
  if (length === null) return { min: null, max: null, precision }

  // In Fusion metadata, fieldLength is the allowed integer-digit width.
  const integerDigits = Math.max(0, length)
  const unit = precision > 0 ? Math.pow(10, -precision) : 1
  const maxAbs = Math.pow(10, integerDigits) - unit
  if (!Number.isFinite(maxAbs) || maxAbs < 0) return { min: null, max: null, precision }
  return { min: -maxAbs, max: maxAbs, precision }
}

function formatNumericBoundary(value: number, precision: number): string {
  if (precision > 0) return value.toFixed(precision)
  if (Number.isInteger(value)) return String(value)
  return String(value)
}

function isNumericPayloadType(type: string): boolean {
  const normalizedType = String(type || '').trim().toLowerCase()
  return normalizedType === 'integer' || normalizedType === 'number' || normalizedType === 'decimal' || normalizedType === 'money'
}

function parseNumericPayloadValue(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const raw = String(value || '').trim()
  if (!raw || raw === '-' || raw === '.' || raw === '-.') return null
  const normalized = raw.replace(/\s+/g, '').replace(/,/g, '').replace(/[^\d.\-]/g, '')
  if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function isApiPathValue(value: string): boolean {
  return /^\/api\/v3\//i.test(String(value || '').trim())
}

function sanitizeLookupPayloadValue(type: string, rawValue: string, baseValue = ''): string {
  const normalizedType = String(type || '').trim().toLowerCase()
  const raw = String(rawValue || '').trim()
  const base = String(baseValue || '').trim()

  if (normalizedType === 'multi-select') {
    if (!raw) return ''
    const valid = raw
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => isApiPathValue(entry))
    if (valid.length > 0) return valid.join(',')

    const baseValid = base
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => isApiPathValue(entry))
    return baseValid.join(',')
  }

  if (normalizedType === 'single-select' || normalizedType === 'radio' || normalizedType === 'buom') {
    if (!raw) return ''
    if (isApiPathValue(raw)) return raw
    if (isApiPathValue(base)) return base
    return ''
  }

  return raw
}

function normalizeOriginalFieldDisplayValue(rawField: CapturedGridRowField, model: SelectedRowModel, fieldId: string): string {
  const fromProjection = model.apiRow?.byFieldId.get(fieldId)
  if (typeof fromProjection === 'string' && fromProjection.trim()) return fromProjection.trim()

  const value = Object.prototype.hasOwnProperty.call(rawField, 'value') ? rawField.value : null
  if (value == null) return ''
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return String(entry || '').trim()
        const record = entry as Record<string, unknown>
        return String(record.title || record.label || record.name || '').trim()
      })
      .filter(Boolean)
      .join(', ')
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return String(record.title || record.label || record.name || record.displayValue || record.display || '').trim()
  }
  return String(value).trim()
}

function parseTypeIdFromLink(typeLink: string | null | undefined): number | null {
  const match = /\/field-types\/(\d+)(?:[/?#]|$)/i.exec(String(typeLink || '').trim())
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

function buildOriginalRowCommitEntry(
  fieldId: string,
  field: ApiTableColumn['field'] | undefined,
  model: SelectedRowModel
): GridCommitDataEntry | null {
  const rawField = model.apiRow?.rawByFieldId.get(fieldId)
  if (!rawField) return null

  const rawTypeLink = String(rawField.type?.link || '').trim() || null
  const rawTypeUrn = String(rawField.type?.urn || '').trim() || null
  const rawTypeTitle = String(rawField.type?.title || '').trim() || null
  const rawFieldSelf = String(rawField.__self__ || '').trim() || null
  const rawFieldUrn = String(rawField.urn || '').trim() || null
  const typeId = field?.typeId ?? parseTypeIdFromLink(rawTypeLink)
  const title = String(field?.title || rawField.title || '').trim()

  return {
    fieldId,
    type: '',
    value: Object.prototype.hasOwnProperty.call(rawField, 'value') ? rawField.value : null,
    display: normalizeOriginalFieldDisplayValue(rawField, model, fieldId),
    title,
    typeId: typeId ?? null,
    typeLink: field?.typeLink ?? rawTypeLink,
    typeUrn: field?.typeUrn ?? rawTypeUrn,
    typeTitle: field?.typeTitle ?? rawTypeTitle,
    fieldSelf: field?.fieldSelf ?? rawFieldSelf,
    fieldUrn: field?.fieldUrn ?? rawFieldUrn
  }
}

async function commitStagedChanges(
  staging: StagingManager,
  context: CommitContext,
  onProgress: (progress: CommitProgress) => void
): Promise<CommitResult> {
  let successCount = 0
  const failures: CommitFailure[] = []

  const snapshot = staging.getSnapshot()
  const removals = [...snapshot.removals]
  const updates = [...snapshot.updates]
  const inserts = [...snapshot.inserts]
  const totalOps = removals.length + updates.length + inserts.length
  let completedOps = 0
  let removeCompleted = 0
  let updateCompleted = 0
  let insertCompleted = 0

  const emitProgress = (message: string, phase: CommitProgress['phase']): void => {
    if (phase === 'remove' || phase === 'complete') {
      onProgress({
        message,
        completed: Math.min(completedOps, totalOps),
        total: totalOps,
        phase,
        phaseCurrent: removeCompleted,
        phaseTotal: removals.length
      })
      return
    }
    if (phase === 'update') {
      onProgress({
        message,
        completed: Math.min(completedOps, totalOps),
        total: totalOps,
        phase,
        phaseCurrent: updateCompleted,
        phaseTotal: updates.length
      })
      return
    }
    onProgress({
      message,
      completed: Math.min(completedOps, totalOps),
      total: totalOps,
      phase,
      phaseCurrent: insertCompleted,
      phaseTotal: inserts.length
    })
  }

  emitProgress('Committing removals...', 'remove')
  await Promise.all(
    removals.map(async (domRowIndex) => {
      const model = context.modelByDomRowIndex.get(domRowIndex)
      const rowId = context.rowIdByDomRowIndex.get(domRowIndex) || model?.apiRow?.rowId || null
      const rowLabel = `Row ${domRowIndex + 1}`
      if (!model || !rowId) {
        failures.push({
          kind: 'remove',
          rowLabel,
          message: 'Missing row identifier for delete.',
          domRowIndex
        })
      } else {
        try {
          await context.ext.requestPlmAction('removeItemGridRow', {
            tenant: context.tenant,
            link: `/api/v3/workspaces/${context.workspaceId}/items/${context.dmsId}/views/${context.viewId}/rows/${rowId}`
          })
          staging.revertForDomRows([domRowIndex])
          successCount += 1
        } catch (error) {
          failures.push({
            kind: 'remove',
            rowLabel,
            message: error instanceof Error ? error.message : 'Delete request failed.',
            domRowIndex
          })
        }
      }
      removeCompleted += 1
      completedOps += 1
      emitProgress('Committing removals...', 'remove')
    })
  )

  emitProgress('Committing updates...', 'update')
  await Promise.all(
    updates.map(async (update) => {
      const domRowIndex = update.domRowIndex
      const model = context.modelByDomRowIndex.get(domRowIndex)
      const rowId = context.rowIdByDomRowIndex.get(domRowIndex) || model?.apiRow?.rowId || null
      const rowLabel = `Row ${domRowIndex + 1}`
      if (!model || !rowId) {
        failures.push({
          kind: 'update',
          rowLabel,
          message: 'Missing row identifier for update.',
          domRowIndex
        })
      } else {
        const rowChanges = new Map(update.payload.map((v) => [v.fieldId, v.value]))
        const rowDisplay = new Map(update.display.map((v) => [v.fieldId, v.value]))
        const basePayload = context.fullRowPayloadByDomRowIndex?.get(domRowIndex) || new Map<string, string>()
        const baseDisplay = context.fullRowDisplayByDomRowIndex?.get(domRowIndex) || new Map<string, string>()
        const mergedPayload = new Map<string, string>(basePayload)
        const mergedDisplay = new Map<string, string>(baseDisplay)
        for (const [fieldId, value] of rowChanges.entries()) {
          mergedPayload.set(fieldId, value)
          const nextDisplay = rowDisplay.get(fieldId)
          if (typeof nextDisplay === 'string') mergedDisplay.set(fieldId, nextDisplay)
        }

        const data: GridCommitDataEntry[] = []
        const fieldIds = new Set<string>([
          ...Array.from(model.apiRow?.rawByFieldId.keys() || []),
          ...Array.from(mergedPayload.keys())
        ])
        for (const fieldId of fieldIds) {
          const field = context.fieldById.get(fieldId)
          const payloadType = field ? context.toGridPayloadType(field) : ''
          if (!rowChanges.has(fieldId)) {
            const originalEntry = buildOriginalRowCommitEntry(fieldId, field, model)
            if (originalEntry) {
              data.push({
                ...originalEntry,
                type: payloadType
              })
            }
            continue
          }
          if (!field) continue
          const value = mergedPayload.get(fieldId) || ''
          const sanitizedValue = sanitizeLookupPayloadValue(payloadType, value, basePayload.get(fieldId) || '')
          data.push({
            fieldId,
            type: payloadType,
            value: normalizePayloadValue(payloadType, sanitizedValue),
            display: String(mergedDisplay.get(fieldId) || ''),
            title: String(field.title || ''),
            typeId: field.typeId ?? null,
            typeLink: field.typeLink ?? null,
            typeUrn: field.typeUrn ?? null,
            typeTitle: field.typeTitle ?? null,
            fieldSelf: field.fieldSelf ?? null,
            fieldUrn: field.fieldUrn ?? null
          })
        }

        if (data.length === 0) {
          completedOps += 1
          emitProgress('Committing updates...', 'update')
          return
        }

        try {
          await context.ext.requestPlmAction('updateItemGridRow', {
            tenant: context.tenant,
            workspaceId: context.workspaceId,
            dmsId: context.dmsId,
            viewId: context.viewId,
            rowId,
            data
          })
          staging.revertForDomRows([domRowIndex])
          successCount += 1
        } catch (error) {
          failures.push({
            kind: 'update',
            rowLabel,
            message: error instanceof Error ? error.message : 'Update request failed.',
            domRowIndex
          })
        }
      }
      updateCompleted += 1
      completedOps += 1
      emitProgress('Committing updates...', 'update')
    })
  )

  emitProgress('Committing inserts...', 'insert')
  const failedInsertIndexes = new Set<number>()
  await Promise.all(
    inserts.map(async (insert, index) => {
      const data: GridCommitDataEntry[] = []
      for (const { fieldId, value } of insert.payload) {
        const field = context.fieldById.get(fieldId)
        if (!field) continue
        const payloadType = context.toGridPayloadType(field)
        const sanitizedValue = sanitizeLookupPayloadValue(payloadType, value)
        data.push({
          fieldId,
          type: payloadType,
          value: normalizePayloadValue(payloadType, sanitizedValue),
          display: String(insert.display.find((d) => d.fieldId === fieldId)?.value || ''),
          title: String(field.title || ''),
          typeId: field.typeId ?? null,
          typeLink: field.typeLink ?? null,
          typeUrn: field.typeUrn ?? null,
          typeTitle: field.typeTitle ?? null,
          fieldSelf: field.fieldSelf ?? null,
          fieldUrn: field.fieldUrn ?? null
        })
      }

      if (data.length === 0) {
        completedOps += 1
        emitProgress('Committing inserts...', 'insert')
        return
      }

      try {
        await context.ext.requestPlmAction('addItemGridRow', {
          tenant: context.tenant,
          workspaceId: context.workspaceId,
          dmsId: context.dmsId,
          viewId: context.viewId,
          data
        })
        successCount += 1
      } catch (error) {
        failures.push({
          kind: 'insert',
          rowLabel: `New Row ${index + 1}`,
          message: error instanceof Error ? error.message : 'Insert request failed.',
          insertIndex: index
        })
        failedInsertIndexes.add(index)
      }

      insertCompleted += 1
      completedOps += 1
      emitProgress('Committing inserts...', 'insert')
    })
  )

  if (failedInsertIndexes.size > 0) {
    const removeIndexes: number[] = []
    for (let index = 0; index < inserts.length; index += 1) {
      if (!failedInsertIndexes.has(index)) removeIndexes.push(index)
    }
    staging.removeInsertDrafts(removeIndexes)
    const failedIndexOrder = Array.from(failedInsertIndexes.values()).sort((a, b) => a - b)
    for (const failure of failures) {
      if (failure.kind !== 'insert' || !Number.isFinite(failure.insertIndex)) continue
      const normalized = failedIndexOrder.indexOf(Number(failure.insertIndex))
      if (normalized >= 0) failure.insertIndex = normalized
    }
  } else if (inserts.length > 0) {
    staging.removeInsertDrafts(inserts.map((_, index) => index))
  }

  completedOps = totalOps
  emitProgress('Commit finished.', 'complete')
  return { successCount, failures }
}

/**
 * Binds add/edit/clone/remove/revert/commit handlers for current modal session.
 */
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
    refreshMetadataAfterCommit
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
    setStatus(meta.selectedRowModels.length === 0 ? 'New row staged. Editing new row.' : 'New row staged. Select row(s) and click Edit when ready.')
    updateCommitState()
  })

  refs.editAction.addEventListener('click', () => {
    resetCommitErrors()
    if (!permissions.canEdit) return setStatus('Missing permission: Edit Grid.')
    const meta = state.getMetadata()
    const selected = selection.getSelectionSummary()
    if (!meta.hasApiFieldMetadata) return setStatus('Metadata still loading. Please wait before editing.')
    if (selected.count === 0) return setStatus('Select at least one row and click Edit.')
    if (selected.count === 1) {
      state.clearMultiEditSeed()
      if (selected.existingCount === 1) state.setEditMode({ type: 'single', rowIndex: selected.existingRowIndexes[0] })
      else state.setEditMode({ type: 'insert', insertIndex: selected.insertIndexes[0] })
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
    if (selected.existingCount !== 1 || selected.insertCount > 0) return setStatus('Clone is available only when one existing row is selected.')
    const model = meta.selectedRowModels[selected.existingRowIndexes[0]]
    if (!model) return setStatus('No values available to clone.')
    const cloneDraft = staging.buildCloneDraftFromModel(model, meta.apiTableColumns)
    if (cloneDraft.payload.size === 0) return setStatus('No values available to clone.')
    staging.addInsertDraft(cloneDraft)
    state.clearEditMode()
    renderForm()
    setStatus('Cloned 1 row(s).')
    updateCommitState()
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
    staging.removeInsertDrafts(selected.insertIndexes)
    selection.shiftInsertSelectionAfterRemoval(selected.insertIndexes)
    const domRows = selected.existingRowIndexes
      .map((index) => meta.selectedRowModels[index]?.domRowIndex)
      .filter((value): value is number => Number.isFinite(value))
    staging.toggleRemovalForDomRows(domRows)
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

  refs.commitAction.addEventListener('click', () => {
    if (state.isCommitting()) return
    if (!ext || !tenant || !route) return setStatus('Cannot commit: missing runtime context.')
    if (staging.getPendingOperationCount() === 0) return setStatus('No staged changes to commit.')
    const stagedSummary = staging.getStagedSummary()
    if (!permissions.canAdd && stagedSummary.newRows > 0) return setStatus('Cannot commit: missing Add to Grid permission for staged rows.')
    if (!permissions.canEdit && stagedSummary.editedRows > 0) return setStatus('Cannot commit: missing Edit Grid permission for staged rows.')
    if (!permissions.canDelete && stagedSummary.deletedRows > 0) {
      return setStatus('Cannot commit: missing Delete from Grid permission for staged removals.')
    }
    const meta = state.getMetadata()
    const requiredIssues = validation.getRequiredValidationIssues(staging.buildModelByDomRowIndex(meta.selectedRowModels))
    if (requiredIssues.length > 0) {
      const preview = requiredIssues.slice(0, 3).map((issue) => `${issue.rowLabel}: ${issue.fieldTitle}`).join(', ')
      return setStatus(`Required fields missing. ${preview}${requiredIssues.length > 3 ? ` (+${requiredIssues.length - 3} more)` : ''}.`)
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
      const insert = snapshot.inserts[insertIndex]
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
      return setStatus(`Numeric value out of range. ${preview}${numericIssues.length > 2 ? ` (+${numericIssues.length - 2} more)` : ''}`)
    }

    void (async () => {
      if (!(await showCommitConfirm(refs.overlay, staging.getStagedSummary()))) return
      state.setCommitting(true)
      resetCommitErrors()
      syncActionState()
      updateCommitState()
      const totalOps = staging.getPendingOperationCount()
      setStatus('Committing staged row updates...')
      view.setCommitProgress(0, totalOps, 'Starting commit')
      const progressDialog = showCommitProgressDialog(refs.overlay, staging.getStagedSummary())

      const modelByDomRowIndex = staging.buildModelByDomRowIndex(meta.selectedRowModels)
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
        setStatus(`Committed ${successCount} operation(s). ${failures.length} failed.`)
        const messages = failures.map((failure) => `${failure.rowLabel}: ${failure.message}`)
        progressDialog.close()
        await showCommitErrors(refs.overlay, messages)
        selection.clearSelection()
        for (const index of failedExistingIndexes) selection.selectRow(index)
        for (const index of failedInsertIndexes) selection.selectInsert(index)
        renderForm()
      } else {
        view.setCommitProgress(totalOps, totalOps, 'Commit complete')
        progressDialog.close()
        await refreshMetadataAfterCommit()
        setStatus(`Committed ${successCount} operation(s) successfully.`)
      }
    })()
  })
}
