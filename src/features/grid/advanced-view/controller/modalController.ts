import { parseGridRouteContext } from '../../filters/data'
import { GRID_FORM_MODAL_ID } from '../view/constants'
import { shouldPreloadLookupOptions } from '../services/fieldTypes'
import type { GridAdvancedEditorPermissions } from '../services/permissions.service'
import type { FormRenderer } from '../view/formRenderer'
import type { GridService } from '../services/gridService'
import type { ApiRowProjection, ApiTableColumn, MatchedFormField } from '../types'
import { bindModalActions } from './commitHandler'
import { buildModalDom } from '../view/shell/GridModalShell'
import { tryRefreshGridTabInPlace } from './gridTabRefresh'
import { createMetadataManager } from './metadataManager'
import { createModalState } from './modalState'
import { createSelectionManager } from './selectionState'
import { createStagingManager } from '../services/staging.service'
import { createValidationManager } from '../services/validation.service'
import { createViewRenderer } from '../view/viewRenderer'
import { showCancelConfirm } from '../view/dialogs/GridDialogs'

export interface ModalController {
  close: () => void
  openForTable: (permissions?: GridAdvancedEditorPermissions | null) => void
}

type ModalControllerDeps = { gridService: GridService; formRenderer: FormRenderer }
type GridModalOverlay = HTMLDivElement & { __plmReactRoot?: { unmount: () => void } }

/**
 * Creates grid form modal controller and returns `{ openForTable, close }`.
 */
export function createGridFormModalController(deps: ModalControllerDeps): ModalController {
  const close = (): void => {
    const overlay = document.getElementById(GRID_FORM_MODAL_ID) as GridModalOverlay | null
    overlay?.__plmReactRoot?.unmount()
    overlay?.remove()
  }

  function openForTable(permissions?: GridAdvancedEditorPermissions | null): void {
    close()
    deps.formRenderer.ensureStyles()

    const effectivePermissions: GridAdvancedEditorPermissions = permissions || {
      canAdd: true,
      canDelete: true,
      canEdit: true,
      canOpen: true
    }

    const ext = window.__plmExt
    const route = parseGridRouteContext(window.location.href)
    const tenant = deps.gridService.getTenantFromLocation(window.location.href)
    const computeApiTableColumns = (): ApiTableColumn[] =>
      deps.gridService.getApiFieldsForCurrentGrid().map((field) => ({
        field,
        columnIndex: null
      }))
    const computeMatchedFields = (columns: ApiTableColumn[]): MatchedFormField[] =>
      columns.map((column) => ({ field: column.field, columnIndex: Number.isFinite(column.columnIndex) ? Number(column.columnIndex) : null }))
    const computeApiRows = (): ApiRowProjection[] =>
      deps.gridService.buildApiRowProjections(deps.gridService.getGridRowsPayloadForCurrentGrid())

    const initialColumns = computeApiTableColumns()
    const hasMetadata = initialColumns.length > 0
    const columns = hasMetadata ? initialColumns : []
    deps.gridService.clearGridRowsForCurrentContext()
    const rows = computeApiRows()
    const state = createModalState({
      metadata: {
        hasApiFieldMetadata: hasMetadata,
        apiTableColumns: columns,
        matchedFields: computeMatchedFields(columns),
        apiRows: rows,
        selectedRowModels: deps.gridService.buildApiRowModels(rows),
        sourceRows: []
      }
    })
    const selection = createSelectionManager()
    const staging = createStagingManager({ gridService: deps.gridService, formRenderer: deps.formRenderer })
    const validation = createValidationManager({ state, stagingManager: staging, gridService: deps.gridService })
    const firstSelected = selection.initializeFromSelectedRows([], state.getMetadata().selectedRowModels, [])
    if (typeof firstSelected === 'number') state.setEditMode({ type: 'single', rowIndex: firstSelected })
    else state.clearEditMode()

    const refs = buildModalDom()
    const view = createViewRenderer(refs)
    view.applyActionPermissions(effectivePermissions)
    const erroredExistingRowIndexes = new Set<number>()
    const erroredInsertIndexes = new Set<number>()
    const setCommitErrors = (existingRowIndexes: number[], insertIndexes: number[]): void => {
      erroredExistingRowIndexes.clear()
      erroredInsertIndexes.clear()
      for (const rowIndex of existingRowIndexes) {
        if (rowIndex >= 0) erroredExistingRowIndexes.add(rowIndex)
      }
      for (const insertIndex of insertIndexes) {
        if (insertIndex >= 0) erroredInsertIndexes.add(insertIndex)
      }
      view.setSelectErroredVisible(erroredExistingRowIndexes.size > 0 || erroredInsertIndexes.size > 0)
    }
    const clearCommitErrors = (): void => {
      erroredExistingRowIndexes.clear()
      erroredInsertIndexes.clear()
      view.setSelectErroredVisible(false)
    }
    const selectedDomRowIndexes = (): number[] =>
      selection
        .getSelectionSummary()
        .existingRowIndexes.map((index) => state.getMetadata().selectedRowModels[index]?.domRowIndex)
        .filter((value): value is number => Number.isFinite(value))
    const setStatus = (extra = ''): void => view.setStatus(staging.getStagedSummary(), extra)
    const updateCommitState = (): void => {
      const meta = state.getMetadata()
      const canValidate = meta.hasApiFieldMetadata && meta.apiTableColumns.length > 0
      const issues = canValidate ? validation.getRequiredValidationIssues(staging.buildModelByDomRowIndex(meta.selectedRowModels)) : []
      const requiredFields = validation.getUniqueRequiredFieldTitles(issues)
      const stagedSummary = staging.getStagedSummary()
      view.updateCommitActionState({
        canEvaluateRequired: canValidate,
        requiredFields,
        isCommitting: state.isCommitting(),
        hasRuntime: Boolean(ext),
        hasTenant: Boolean(tenant),
        hasRoute: Boolean(route),
        hasApiFieldMetadata: meta.hasApiFieldMetadata,
        hasColumns: meta.apiTableColumns.length > 0,
        hasPendingOperations: staging.getPendingOperationCount() > 0,
        permissions: effectivePermissions,
        stagedSummary
      })
      view.renderRequiredSummary({ canEvaluateRequired: canValidate, requiredFields })
      view.renderFieldsNotice(state.getEditMode().type === 'multi')
    }
    const syncActionState = (): void => {
      const summary = selection.getSelectionSummary()
      view.syncEditActionState({
        isCommitting: state.isCommitting(),
        hasApiFieldMetadata: state.getMetadata().hasApiFieldMetadata,
        selectionCount: summary.count,
        canCloneSelection: !state.isCommitting() && state.getMetadata().hasApiFieldMetadata && summary.existingCount === 1 && summary.insertCount === 0,
        canRevertSelection:
          !state.isCommitting() &&
          state.getMetadata().hasApiFieldMetadata &&
          summary.count > 0 &&
          staging.getSelectedRevertSummary(selectedDomRowIndexes()).total > 0,
        permissions: effectivePermissions
      })
    }
    const normalizeEditMode = (): void => {
      const mode = state.getEditMode()
      const meta = state.getMetadata()
      if (mode.type === 'single' && (mode.rowIndex < 0 || mode.rowIndex >= meta.selectedRowModels.length)) state.clearEditMode()
      if (mode.type === 'insert' && (mode.insertIndex < 0 || mode.insertIndex >= staging.getInsertCount())) state.clearEditMode()
      if (mode.type === 'multi') {
        const valid = new Set(Array.from(mode.rowIndexes.values()).filter((index) => index >= 0 && index < meta.selectedRowModels.length))
        const hasSelectedInsertRows = selection.getSelectionSummary().insertCount > 0
        if (valid.size === 0 && !hasSelectedInsertRows) state.clearEditMode()
        else state.setEditMode({ type: 'multi', rowIndexes: valid })
      }
    }
    const renderRowTable = (): void => {
      view.renderRowTable({
        apiTableColumns: state.getMetadata().apiTableColumns,
        selectedRowModels: state.getMetadata().selectedRowModels,
        staging: staging.getSnapshot(),
        selection: selection.getSelectionSummary(),
        erroredExistingRowIndexes,
        erroredInsertIndexes,
        normalizeActiveSelection: normalizeEditMode,
        resolveTableValue: (model, column) => deps.gridService.getApiTableValueForRow(model, column, staging.getPendingChangesMap()),
        onSelectAllToggle: (checked) => {
          if (checked) selection.selectAll(state.getMetadata().selectedRowModels.length, staging.getInsertCount())
          else {
            selection.clearSelection()
            state.clearEditMode()
          }
          if (!selection.hasSelection()) state.clearEditMode()
          setStatus(`Select rows to edit. ${selection.selectionCountText()}.`)
          syncActionState()
          renderForm()
        },
        onExistingRowToggle: (rowIndex, checked) => {
          selection.toggleRow(rowIndex, checked)
          if (!selection.hasSelection()) state.clearEditMode()
          setStatus(`Select rows to edit. ${selection.selectionCountText()}.`)
          syncActionState()
          renderForm()
        },
        onInsertRowToggle: (insertIndex, checked) => {
          selection.toggleInsert(insertIndex, checked)
          if (!selection.hasSelection()) state.clearEditMode()
          setStatus(`Select rows to edit. ${selection.selectionCountText()}.`)
          syncActionState()
          renderForm()
        }
      })
      syncActionState()
    }
    const renderForm = (): void => {
      renderRowTable()
      const meta = state.getMetadata()
      const insertCount = staging.getInsertCount()
      if (meta.hasApiFieldMetadata) {
        const preload: string[] = []
        for (const matched of meta.matchedFields) {
          const path = (matched.field.picklistPath || '').trim()
          if (!path || !shouldPreloadLookupOptions(matched.field.typeId) || state.isLookupPathPreloaded(path)) continue
          state.markLookupPathPreloaded(path)
          preload.push(path)
        }
        if (preload.length > 0) deps.formRenderer.preloadLookupOptions(preload)
      }
      if (meta.selectedRowModels.length === 0 && insertCount === 0) {
        view.setFormPaneVisible(false); refs.fieldsTitle.textContent = 'FORM FIELDS'; setStatus('No rows available for this grid.'); updateCommitState(); syncActionState(); return
      }
      const mode = state.getEditMode()
      if (mode.type === 'idle') {
        view.setFormPaneVisible(false); refs.fieldsTitle.textContent = 'FORM FIELDS'; setStatus(`Select row(s) and click Edit. ${selection.selectionCountText()}.`); updateCommitState(); syncActionState(); return
      }
      if (meta.apiTableColumns.length === 0 || meta.matchedFields.length === 0) {
        view.setFormPaneVisible(true); refs.fieldsTitle.textContent = 'FORM FIELDS'; setStatus(''); updateCommitState(); return
      }
      normalizeEditMode()
      const nextMode = state.getEditMode()
      const activeInsertDraft = nextMode.type === 'insert' ? staging.getInsertDraftAt(nextMode.insertIndex) : null
      const activeModel = nextMode.type === 'single' ? meta.selectedRowModels[nextMode.rowIndex] || null : null
      if (!activeInsertDraft && !activeModel && nextMode.type !== 'multi') {
        view.setFormPaneVisible(false); refs.fieldsTitle.textContent = 'FORM FIELDS'; setStatus('No active row available.'); updateCommitState(); return
      }
      view.setFormPaneVisible(true)
      refs.fieldsTitle.textContent =
        nextMode.type === 'multi'
          ? `FORM FIELDS - ${selection.getSelectionSummary().count} ROWS`
          : nextMode.type === 'insert'
            ? `FORM FIELDS - ROW ${meta.selectedRowModels.length + nextMode.insertIndex + 1}`
            : nextMode.type === 'single'
              ? `FORM FIELDS - ROW ${nextMode.rowIndex + 1}`
              : 'FORM FIELDS'
      const multiSeed = state.getMultiEditSeed()
      const snapshot = staging.getSnapshot()
      const bindings = view.renderFormFields({
        matchedFields: meta.matchedFields,
        requiredOnly: state.isRequiredOnly(),
        isMultiEditMode: nextMode.type === 'multi',
        activeModel,
        activeInsertDraft,
        pendingChanges: snapshot.updates.map((row) => ({ domRowIndex: row.domRowIndex, fields: row.payload })),
        pendingDisplays: snapshot.updates.map((row) => ({ domRowIndex: row.domRowIndex, fields: row.display })),
        multiEditInitialDisplayValues: Array.from(multiSeed.initialValues.entries()).map(([fieldId, value]) => ({ fieldId, value })),
        multiEditMismatchFieldIds: Array.from(multiSeed.mismatchFieldIds.values()),
        formRenderer: deps.formRenderer,
        resolveFieldValueForSelectedRow: deps.gridService.resolveFieldValueForSelectedRow,
        onFieldChange: () => {
          const result = staging.stageDraftFromBindings({
            editMode: state.getEditMode(),
            bindings: state.getBindings(),
            selectedRowModels: state.getMetadata().selectedRowModels,
            multiEditInsertIndexes: selection.getSelectionSummary().insertIndexes,
            multiEditInitialDisplayByFieldId: state.getMultiEditSeed().initialValues
          })
          if (result.changed) renderRowTable()
          if (result.message) setStatus(result.message)
          updateCommitState()
        }
      })
      state.setBindings(bindings)
      setStatus(nextMode.type === 'multi' ? `Editing ${selection.getSelectionSummary().count} selected rows.` : '')
      updateCommitState()
      syncActionState()
    }

    refs.closeAction.addEventListener('click', async () => {
      const stagedCount = staging.getStagedSummary().total
      if (stagedCount > 0) {
        const confirmed = await showCancelConfirm(refs.overlay, stagedCount)
        if (!confirmed) return
      }
      if (!state.hasCommittedOperations()) return close()
      close()
      if (!tryRefreshGridTabInPlace()) window.location.reload()
    })
    refs.overlay.addEventListener('click', (event) => { if (event.target === refs.overlay) { event.preventDefault(); event.stopPropagation() } })
    refs.expandAction.addEventListener('click', () => { state.setExpanded(!state.isExpanded()); view.setExpandedState(state.isExpanded()) })
    refs.fieldsClose.addEventListener('click', () => { state.clearEditMode(); renderForm() })
    refs.clearSelectionAction.addEventListener('click', () => {
      selection.clearSelection()
      state.clearEditMode()
      setStatus(`Select row(s) and click Edit. ${selection.selectionCountText()}.`)
      syncActionState()
      renderForm()
    })
    refs.requiredToggle.addEventListener('change', () => { state.setRequiredOnly(refs.requiredToggle.checked); renderForm() })
    document.body.appendChild(refs.overlay)

    bindModalActions({
      refs,
      state,
      selection,
      staging,
      validation,
      permissions: effectivePermissions,
      gridService: deps.gridService,
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
      refreshMetadataAfterCommit: async () => {
        view.setLoadingState(true, 'Refreshing rows...')
        try {
          deps.gridService.clearCaches()
          await Promise.all([
            deps.gridService.hydrateGridFieldsForCurrentContext(),
            deps.gridService.hydrateGridRowsForCurrentContext()
          ])
          const refreshedColumns = computeApiTableColumns()
          const refreshedRows = computeApiRows()
          state.setMetadata({
            hasApiFieldMetadata: refreshedColumns.length > 0,
            apiTableColumns: refreshedColumns,
            matchedFields: computeMatchedFields(refreshedColumns),
            apiRows: refreshedRows,
            selectedRowModels: deps.gridService.buildApiRowModels(refreshedRows)
          })
          selection.clearSelection()
          state.clearEditMode()
          state.clearRowIds()
        } finally {
          view.setLoadingState(false)
          renderForm()
        }
      }
    })

    const metadataManager = createMetadataManager({
      state,
      gridService: deps.gridService,
      computeApiTableColumns,
      computeMatchedFields,
      computeApiRows,
      setLoadingState: (isLoading, text) => view.setLoadingState(isLoading, text),
      setStatus,
      onMetadataUpdated: (result) => {
        state.setMetadata({
          hasApiFieldMetadata: result.hasApiFieldMetadata,
          apiTableColumns: result.apiTableColumns,
          matchedFields: result.matchedFields,
          apiRows: result.apiRows,
          selectedRowModels: result.selectedRowModels
        })
        if (result.apiTableColumns.length > 0 && result.matchedFields.length > 0) renderForm()
      }
    })

    view.setExpandedState(false)
    view.setSelectErroredVisible(false)
    view.setLoadingState(!state.getMetadata().hasApiFieldMetadata || state.getMetadata().apiRows.length === 0)
    view.resetCommitProgress()
    renderForm()
    metadataManager.startPolling()
  }

  return { close, openForTable }
}
