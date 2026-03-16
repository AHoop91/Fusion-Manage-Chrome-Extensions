import { el } from './domBuilder'
import type { GridAdvancedEditorPermissions } from '../services/permissions.service'
import { renderFormFields, type PendingInsertDraftLike } from './formFieldsRenderer'
import { renderRowTable as renderModalRowTable } from './rowTableRenderer'
import { buildSummaryNode, type StagedSummary } from './summaryView'
import type { ApiTableColumn, MatchedFormField, RowBinding, SelectedRowModel } from '../types'
import type { FormRenderer } from './formRenderer'
import type { ModalDomRefs } from './shell/GridModalShell'
import type { SelectionSummary } from '../controller/selectionState'
import type { PendingFieldValue, StagingSnapshot } from '../services/staging.service'

/**
 * Required-render state consumed by commit-action and summary UI.
 */
export interface RequiredSummaryRenderState {
  canEvaluateRequired: boolean
  requiredFields: string[]
}

/**
 * Render input used to compute commit action disabled state.
 */
export interface CommitActionRenderState extends RequiredSummaryRenderState {
  isCommitting: boolean
  hasRuntime: boolean
  hasTenant: boolean
  hasRoute: boolean
  hasApiFieldMetadata: boolean
  hasColumns: boolean
  hasPendingOperations: boolean
  permissions: GridAdvancedEditorPermissions
  stagedSummary: StagedSummary
}

/**
 * Edit action enablement input used for action button state sync.
 */
export interface EditActionRenderState {
  isCommitting: boolean
  hasApiFieldMetadata: boolean
  selectionCount: number
  canCloneSelection: boolean
  canRevertSelection: boolean
  permissions: GridAdvancedEditorPermissions
}

/**
 * Row table render input for pure UI rendering.
 */
export interface RenderRowTableArgs {
  apiTableColumns: ApiTableColumn[]
  selectedRowModels: SelectedRowModel[]
  staging: StagingSnapshot
  selection: SelectionSummary
  erroredExistingRowIndexes: Set<number>
  erroredInsertIndexes: Set<number>
  normalizeActiveSelection: () => void
  resolveTableValue: (model: SelectedRowModel, column: ApiTableColumn) => string
  onSelectAllToggle: (checked: boolean) => void
  onExistingRowToggle: (rowIndex: number, checked: boolean, model: SelectedRowModel) => void
  onInsertRowToggle: (insertIndex: number, checked: boolean) => void
}

/**
 * Form render input shape for pure UI rendering.
 */
export interface RenderFormFieldsArgs {
  matchedFields: MatchedFormField[]
  requiredOnly: boolean
  isMultiEditMode: boolean
  activeModel: SelectedRowModel | null
  activeInsertDraft: PendingInsertDraftLike | null
  pendingChanges: Array<{ domRowIndex: number; fields: PendingFieldValue[] }>
  pendingDisplays: Array<{ domRowIndex: number; fields: PendingFieldValue[] }>
  multiEditInitialDisplayValues: PendingFieldValue[]
  multiEditMismatchFieldIds: string[]
  formRenderer: FormRenderer
  resolveFieldValueForSelectedRow: (
    row: SelectedRowModel,
    field: ApiTableColumn['field'],
    columnIndex: number | null
  ) => string
  onFieldChange: () => void
}

/**
 * View renderer contract for all modal DOM operations.
 */
export interface ViewRenderer {
  getRefs: () => ModalDomRefs
  setExpandedState: (expanded: boolean) => void
  setLoadingState: (isLoading: boolean, text?: string) => void
  setFormPaneVisible: (visible: boolean) => void
  setStatus: (summary: StagedSummary, extra?: string) => void
  resetCommitProgress: () => void
  setCommitProgress: (current: number, total: number, message?: string) => void
  scheduleCommitProgressHide: (delayMs?: number, isCommitting?: boolean) => void
  applyActionPermissions: (permissions: GridAdvancedEditorPermissions) => void
  updateCommitActionState: (state: CommitActionRenderState) => void
  syncEditActionState: (state: EditActionRenderState) => void
  renderFieldsNotice: (isMultiEditMode: boolean) => void
  renderRequiredSummary: (state: RequiredSummaryRenderState) => void
  setSelectErroredVisible: (visible: boolean) => void
  renderRowTable: (args: RenderRowTableArgs) => void
  renderFormFields: (args: RenderFormFieldsArgs) => RowBinding[]
}

function fieldValuesToMap(items: PendingFieldValue[]): Map<string, string> {
  return new Map(items.map((item) => [item.fieldId, item.value]))
}

/**
 * Creates view renderer with internal UI caches, isolated from controller state internals.
 */
export function createViewRenderer(refs: ModalDomRefs): ViewRenderer {
  const {
    panel,
    loading,
    loadingText,
    expandAction,
    toolbar,
    requiredSummary,
    body,
    bodyLoading,
    selectErroredAction,
    clearSelectionAction,
    selectedCountLabel,
    rowTableHeadRow,
    rowTableBody,
    fieldsNotice,
    fieldsNoticeText,
    fieldsNoticeRequired,
    fieldsRoot,
    editAction,
    cloneAction,
    revertAction,
    removeAction,
    addAction,
    commitAction
  } = refs

  const rowIdByDomRowIndex = new Map<number, string>()
  const columnWidthByIndex = new Map<number, number>()

  function setExpandedState(expanded: boolean): void {
    panel.classList.toggle('is-expanded', expanded)
    expandAction.innerHTML = expanded
      ? '<i class="zmdi zmdi-fullscreen-exit" aria-hidden="true"></i>'
      : '<i class="zmdi zmdi-fullscreen" aria-hidden="true"></i>'
    expandAction.title = expanded ? 'Restore editor size' : 'Expand editor'
  }

  function setLoadingState(isLoading: boolean, text = 'Loading metadata...'): void {
    loading.classList.toggle('is-visible', isLoading)
    loadingText.textContent = text
    bodyLoading.classList.toggle('is-visible', isLoading)
  }

  function setFormPaneVisible(visible: boolean): void {
    body.classList.toggle('is-fields-hidden', !visible)
    toolbar.classList.toggle('is-fields-hidden', !visible)
  }

  function setStatus(summary: StagedSummary, extra = ''): void {
    refs.status.textContent = ''
    refs.status.appendChild(buildSummaryNode(summary, 'plm-extension-grid-form-status-summary'))
    if (extra) {
      refs.status.appendChild(el('span').cls('plm-extension-grid-form-status-separator').text('|').build())
      refs.status.appendChild(el('span').cls('plm-extension-grid-form-status-note').text(extra).build())
    }
  }

  function setCommitProgress(current: number, total: number, message = 'Ready'): void {
    void current
    void total
    void message
  }

  function resetCommitProgress(): void {
    // Commit progress is shown in modal dialogs only.
  }

  function scheduleCommitProgressHide(delayMs = 1400, isCommitting = false): void {
    void delayMs
    void isCommitting
  }

  function renderRequiredSummary(state: RequiredSummaryRenderState): void {
    requiredSummary.textContent = ''
    requiredSummary.appendChild(el('span').cls('plm-extension-grid-form-required-summary-label').text('Required Fields Remaining:').build())
    if (!state.canEvaluateRequired) {
      requiredSummary.appendChild(el('span').cls('plm-extension-grid-form-required-summary-empty').text('loading metadata...').build())
      requiredSummary.classList.remove('is-ok')
      requiredSummary.classList.remove('is-pending')
      return
    }
    if (state.requiredFields.length === 0) {
      requiredSummary.classList.add('is-ok')
      requiredSummary.classList.remove('is-pending')
      return
    }
    const pills = el('span').cls('plm-extension-grid-form-required-pill-list').build()
    for (const field of state.requiredFields) pills.appendChild(el('span').cls('plm-extension-grid-form-required-pill').text(field).build())
    requiredSummary.appendChild(pills)
    requiredSummary.classList.add('is-pending')
    requiredSummary.classList.remove('is-ok')
  }

  function renderFieldsNotice(isMultiEditMode: boolean): void {
    if (!isMultiEditMode) {
      fieldsNotice.classList.remove('is-visible')
      fieldsNoticeText.textContent = ''
      fieldsNoticeRequired.textContent = ''
      return
    }
    fieldsNotice.classList.add('is-visible')
    fieldsNoticeText.textContent =
      'Red field titles indicate selected rows have different values. Updating a field applies the new value to all selected rows.'
    fieldsNoticeRequired.textContent = ''
  }

  function updateCommitActionState(state: CommitActionRenderState): void {
    const hasRequiredIssues = state.requiredFields.length > 0
    const hasUnauthorizedAdds = !state.permissions.canAdd && state.stagedSummary.newRows > 0
    const hasUnauthorizedUpdates = !state.permissions.canEdit && state.stagedSummary.editedRows > 0
    const hasUnauthorizedDeletes = !state.permissions.canDelete && state.stagedSummary.deletedRows > 0
    const hasUnauthorizedStagedOperations = hasUnauthorizedAdds || hasUnauthorizedUpdates || hasUnauthorizedDeletes
    const baseDisabled =
      state.isCommitting ||
      !state.hasRuntime ||
      !state.hasTenant ||
      !state.hasRoute ||
      !state.hasColumns ||
      !state.hasApiFieldMetadata
    commitAction.disabled = baseDisabled || !state.hasPendingOperations || hasRequiredIssues || hasUnauthorizedStagedOperations
    if (baseDisabled) commitAction.title = ''
    else if (hasRequiredIssues) commitAction.title = `Pending required attributes: ${state.requiredFields.join(', ')}`
    else if (hasUnauthorizedAdds) commitAction.title = 'Missing permission: Add to Grid'
    else if (hasUnauthorizedUpdates) commitAction.title = 'Missing permission: Edit Grid'
    else if (hasUnauthorizedDeletes) commitAction.title = 'Missing permission: Delete from Grid'
    else if (!state.hasPendingOperations) commitAction.title = 'No staged changes to commit'
    else commitAction.title = 'Commit staged changes'
  }

  function applyActionPermissions(permissions: GridAdvancedEditorPermissions): void {
    addAction.style.display = permissions.canAdd ? '' : 'none'
    cloneAction.style.display = permissions.canAdd ? '' : 'none'
    editAction.style.display = permissions.canEdit ? '' : 'none'
    revertAction.style.display = permissions.canEdit ? '' : 'none'
    removeAction.style.display = permissions.canAdd || permissions.canDelete ? '' : 'none'
  }

  function syncEditActionState(state: EditActionRenderState): void {
    const selectedCountTextNode = selectedCountLabel.querySelector('.plm-extension-grid-form-selected-count-text')
    if (selectedCountTextNode) selectedCountTextNode.textContent = `${state.selectionCount} selected`
    selectedCountLabel.style.display = state.selectionCount > 0 ? 'inline-flex' : 'none'
    clearSelectionAction.disabled = state.isCommitting || state.selectionCount === 0
    const selectionActionsEnabled = !state.isCommitting && state.hasApiFieldMetadata && state.selectionCount > 0
    editAction.disabled = !state.permissions.canEdit || !selectionActionsEnabled
    cloneAction.disabled = !state.permissions.canAdd || !state.canCloneSelection
    revertAction.disabled = !state.permissions.canEdit || !state.canRevertSelection
    removeAction.disabled = !selectionActionsEnabled
    addAction.disabled = !state.permissions.canAdd || state.isCommitting || !state.hasApiFieldMetadata || state.selectionCount > 0
  }

  function renderRowTable(args: RenderRowTableArgs): void {
    const pendingChangesByDomRowIndex = new Map<number, Map<string, string>>(
      args.staging.updates.map((row) => [row.domRowIndex, fieldValuesToMap(row.payload)])
    )
    const pendingDisplayByDomRowIndex = new Map<number, Map<string, string>>(
      args.staging.updates.map((row) => [row.domRowIndex, fieldValuesToMap(row.display)])
    )
    const pendingRemovalRowIndexes = new Set(args.staging.removals)
    const pendingInsertDrafts: PendingInsertDraftLike[] = args.staging.inserts.map((draft) => ({
      payload: fieldValuesToMap(draft.payload),
      display: fieldValuesToMap(draft.display),
      source: draft.source
    }))
    const selectedExistingRowIndexes = new Set(args.selection.existingRowIndexes)
    const selectedInsertIndexes = new Set(args.selection.insertIndexes)

    renderModalRowTable({
      rowTableHeadRow,
      rowTableBody,
      apiTableColumns: args.apiTableColumns,
      selectedRowModels: args.selectedRowModels,
      pendingInsertDrafts,
      pendingChangesByDomRowIndex,
      pendingDisplayByDomRowIndex,
      pendingRemovalRowIndexes,
      selectedExistingRowIndexes,
      selectedInsertIndexes,
      erroredExistingRowIndexes: args.erroredExistingRowIndexes,
      erroredInsertIndexes: args.erroredInsertIndexes,
      rowIdByDomRowIndex,
      columnWidthByIndex,
      normalizeActiveSelection: args.normalizeActiveSelection,
      resolveTableValue: args.resolveTableValue,
      onSelectAllToggle: args.onSelectAllToggle,
      onExistingRowToggle: args.onExistingRowToggle,
      onInsertRowToggle: args.onInsertRowToggle
    })
  }

  function setSelectErroredVisible(visible: boolean): void {
    selectErroredAction.style.display = visible ? '' : 'none'
  }

  function renderFormFieldsView(args: RenderFormFieldsArgs): RowBinding[] {
    const pendingChangesByDomRowIndex = new Map<number, Map<string, string>>(
      args.pendingChanges.map((row) => [row.domRowIndex, fieldValuesToMap(row.fields)])
    )
    const pendingDisplayByDomRowIndex = new Map<number, Map<string, string>>(
      args.pendingDisplays.map((row) => [row.domRowIndex, fieldValuesToMap(row.fields)])
    )
    const multiEditInitialDisplayByFieldId = fieldValuesToMap(args.multiEditInitialDisplayValues)
    const multiEditMismatchFieldIds = new Set(args.multiEditMismatchFieldIds)

    return renderFormFields({
      fieldsRoot,
      matchedFields: args.matchedFields,
      requiredOnly: args.requiredOnly,
      isMultiEditMode: args.isMultiEditMode,
      activeModel: args.activeModel,
      activeInsertDraft: args.activeInsertDraft,
      pendingChangesByDomRowIndex,
      pendingDisplayByDomRowIndex,
      multiEditInitialDisplayByFieldId,
      multiEditMismatchFieldIds,
      formRenderer: args.formRenderer,
      resolveFieldValueForSelectedRow: args.resolveFieldValueForSelectedRow,
      onFieldChange: args.onFieldChange
    })
  }

  return {
    getRefs: () => refs,
    setExpandedState,
    setLoadingState,
    setFormPaneVisible,
    setStatus,
    resetCommitProgress,
    setCommitProgress,
    scheduleCommitProgressHide,
    applyActionPermissions,
    updateCommitActionState,
    syncEditActionState,
    renderFieldsNotice,
    renderRequiredSummary,
    setSelectErroredVisible,
    renderRowTable,
    renderFormFields: renderFormFieldsView
  }
}
