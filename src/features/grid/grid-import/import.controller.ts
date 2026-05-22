import { parseGridRouteContext } from '../grid-page/grid-page-context'
import { getGridFieldsPayloadForCurrentContext, getLatestGridViewIdForContext } from '../grid-services/gridApiMetadata'
import { createGridService } from '../grid-advanced-editor/services/gridService'
import type { GridImportEditSession } from '../grid-staging/grid-import-edit-session'
import type { GridPageRuntime } from '../grid.types'
import { tryRefreshGridTabInPlace } from '../grid-advanced-editor/controller/gridTabRefresh'
import {
  buildImportEditSession,
  canBuildImportEditSession,
  formatImportEditAllSkippedStatus,
  summarizeImportEditSkippedRows
} from './build-import-edit-session'
import { isCsvFileName, parseCsv } from './csv.service'
import { buildDomRowIndexByRowId } from './dom-row-index-map'
import { buildImportableFields, createAutoMapping } from './mapping.service'
import { submitGridImportRows } from './submit.service'
import { validateGridImportWithProgress } from './validation.service'
import {
  promptForGridImportCsvFile,
  showGridImportDialog,
  showGridImportEditAllSkippedModal,
  showGridImportEditConfirmModal,
  showGridImportValidationIssuesModal,
  type GridImportDialog,
  type GridImportDialogState
} from './importDialog'
import type { GridImportMatchableRow } from './import-row-classification'
import {
  restoreGridFormModalOverlay,
  suppressGridFormModalOverlay
} from '../grid-advanced-editor/view/modalOverlayVisibility'
import type { CapturedGridFieldsPayload } from '../grid-advanced-editor/types'
import type { GridImportEditOpenResult } from '../grid-staging/grid-import-edit-session'
import type { CsvParseResult, GridImportField, GridImportMapping, GridImportOpenOptions, GridImportValidationResult } from './types'

export type GridImportControllerOptions = {
  enableGridAdvancedEditor: () => boolean
  onEditInAdvancedEditor: (session: GridImportEditSession) => Promise<GridImportEditOpenResult>
}

type GridImportController = {
  open: (openOptions?: GridImportOpenOptions) => void
  close: () => void
}

function getTenantFromLocation(urlString: string): string | null {
  try {
    const url = new URL(urlString)
    const hostParts = url.hostname.split('.')
    if (hostParts.length < 3) return null
    return hostParts[0]?.toUpperCase() || null
  } catch {
    return null
  }
}

function parseViewIdFromFieldsSelf(self: unknown): number | null {
  const match = /\/views\/(\d+)\/fields(?:[/?#]|$)/i.exec(String(self || '').trim())
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

async function fetchLatestFieldsPayload(
  ext: Pick<GridPageRuntime, 'requestPlmAction'>,
  tenant: string,
  workspaceId: number,
  dmsId: number,
  viewId: number
): Promise<CapturedGridFieldsPayload | null> {
  try {
    const payload = await ext.requestPlmAction<CapturedGridFieldsPayload>('fetchApiJson', {
      tenant,
      path: `/api/v3/workspaces/${workspaceId}/items/${dmsId}/views/${viewId}/fields`
    })
    return Array.isArray(payload?.fields) && payload.fields.length > 0 ? payload : null
  } catch {
    return null
  }
}

function toMatchableRows(
  rows: ReturnType<ReturnType<typeof createGridService>['buildApiRowProjections']>
): GridImportMatchableRow[] {
  return rows.map((row) => ({
    rowId: row.rowId,
    index: row.index,
    byFieldId: row.byFieldId
  }))
}

export function createGridImportController(
  ext: Pick<GridPageRuntime, 'requestPlmAction'>,
  options: GridImportControllerOptions
): GridImportController {
  const gridService = createGridService()
  let dialog: GridImportDialog | null = null
  let editConfirmModalOpen = false
  let openedFromAdvancedEditor = false
  let state: GridImportDialogState = {
    fileName: '',
    parsed: null,
    fields: [],
    mapping: [],
    matchFieldIds: [],
    validation: null,
    showValidationColumn: false,
    rowValidation: {},
    loading: false,
    submitting: false,
    progress: null,
    failures: [],
    status: '',
    enableAdvancedEditor: false,
    fromAdvancedEditor: false
  }

  function setState(next: Partial<GridImportDialogState>): void {
    state = { ...state, ...next, fromAdvancedEditor: openedFromAdvancedEditor }
    dialog?.update(state)
  }

  function showEditInImportDialog(): boolean {
    return !openedFromAdvancedEditor && options.enableGridAdvancedEditor()
  }

  function canHandoffToAdvancedEditor(): boolean {
    return options.enableGridAdvancedEditor() && Boolean(state.parsed)
  }

  function canEditInAdvancedEditor(): boolean {
    return canHandoffToAdvancedEditor()
  }

  function recomputeValidation(
    parsed: CsvParseResult,
    fields: GridImportField[],
    mapping: GridImportMapping[],
    matchFieldIds = state.matchFieldIds
  ): void {
    setState({
      parsed,
      fields,
      mapping,
      matchFieldIds,
      validation: null,
      showValidationColumn: false,
      rowValidation: {},
      failures: [],
      enableAdvancedEditor: showEditInImportDialog()
    })
  }

  async function refreshFieldsAndValidate(): Promise<GridImportValidationResult | null> {
    if (!state.parsed) {
      setState({ status: 'Select a CSV file before continuing.' })
      return null
    }
    setState({
      loading: true,
      validation: null,
      showValidationColumn: true,
      rowValidation: {},
      failures: [],
      progress: { completed: 0, total: state.parsed.rows.length, message: 'Refreshing grid field metadata from Fusion...' },
      status: 'Refreshing grid field metadata from Fusion...',
      enableAdvancedEditor: showEditInImportDialog()
    })
    const route = parseGridRouteContext(window.location.href)
    const tenant = getTenantFromLocation(window.location.href)
    const cachedPayload = getGridFieldsPayloadForCurrentContext()
    const viewId = parseViewIdFromFieldsSelf(cachedPayload?.__self__) || (route ? getLatestGridViewIdForContext(route.workspaceId, route.dmsId) : null)
    if (!route || !tenant || !viewId) {
      setState({ loading: false, progress: null, status: 'Cannot validate: missing grid runtime context.' })
      return null
    }

    const latestPayload = await fetchLatestFieldsPayload(ext, tenant, route.workspaceId, route.dmsId, viewId)
    if (!latestPayload) {
      setState({ loading: false, progress: null, status: 'Cannot validate: unable to refresh grid field metadata.' })
      return null
    }
    await gridService.hydrateRequiredValidatorsForFields(latestPayload.fields)
    const latestFields = buildImportableFields(latestPayload, gridService.getApiFieldsForCurrentGrid(), gridService.isFieldRequired)
    if (latestFields.length === 0) {
      setState({ loading: false, progress: null, status: 'Cannot validate: no editable fields are available to import.' })
      return null
    }
    const previousMappingByFieldId = new Map(state.mapping.map((entry) => [entry.fieldId, entry.header]))
    const latestMapping = latestFields.map((field) => ({
      fieldId: field.fieldId,
      header: previousMappingByFieldId.get(field.fieldId) || ''
    }))
    const latestFieldIds = new Set(latestFields.map((field) => field.fieldId))
    const latestMatchFieldIds = state.matchFieldIds.filter((fieldId) => latestFieldIds.has(fieldId))
    setState({
      fields: latestFields,
      mapping: latestMapping,
      matchFieldIds: latestMatchFieldIds,
      status: 'Field metadata refreshed. Validating CSV rows...'
    })
    const validation = await validateGridImportWithProgress(
      state.parsed,
      latestFields,
      latestMapping,
      latestMatchFieldIds,
      (progress) => {
        const next: Partial<GridImportDialogState> = { progress, status: progress.message }
        if (progress.rowSnapshot) {
          next.rowValidation = {
            ...state.rowValidation,
            [progress.rowSnapshot.csvRowNumber]: {
              tone: progress.rowSnapshot.tone,
              messages: progress.rowSnapshot.messages
            }
          }
        }
        setState(next)
      }
    )
    const hasIssues =
      validation.mappingIssues.length > 0 || validation.rowIssues.length > 0 || validation.warningIssues.length > 0
    setState({
      loading: false,
      progress: null,
      validation,
      failures: [],
      status: hasIssues
        ? 'Validation completed with issues. Review flagged rows before continuing.'
        : 'Validation passed.',
      enableAdvancedEditor: showEditInImportDialog()
    })
    return validation
  }

  async function handleFileSelected(file: File): Promise<void> {
    if (!isCsvFileName(file.name)) {
      setState({
        status: 'Unsupported file type. Select a .csv file.',
        parsed: null,
        validation: null,
        showValidationColumn: false,
        rowValidation: {},
        enableAdvancedEditor: showEditInImportDialog()
      })
      return
    }
    setState({ loading: true, fileName: file.name, status: 'Loading grid fields and parsing CSV...', failures: [] })
    try {
      const hydrated = await gridService.hydrateGridFieldsForCurrentContext()
      if (!hydrated) {
        setState({ status: 'Unable to load grid field metadata.', loading: false })
        return
      }
      await gridService.ensureValidatorsHydratedForCurrentGrid()
      const payload = getGridFieldsPayloadForCurrentContext()
      const fields = buildImportableFields(payload, gridService.getApiFieldsForCurrentGrid(), gridService.isFieldRequired)
      if (fields.length === 0) {
        setState({ status: 'No editable fields are available to import.', loading: false })
        return
      }
      const text = await file.text()
      const parsed = parseCsv(text)
      if (parsed.headers.length === 0) {
        setState({
          status: 'CSV is missing a header row.',
          parsed: null,
          validation: null,
          showValidationColumn: false,
          rowValidation: {},
          loading: false,
          enableAdvancedEditor: showEditInImportDialog()
        })
        return
      }
      const mapping = createAutoMapping(parsed.headers, fields)
      state = { ...state, loading: false, fileName: file.name, status: `Loaded ${parsed.rows.length} CSV row(s). Review mapping before import.` }
      recomputeValidation(parsed, fields, mapping)
    } catch (error) {
      setState({
        status: error instanceof Error ? error.message : 'Failed to read CSV file.',
        loading: false
      })
    }
  }

  function handleMappingChanged(mapping: GridImportMapping[]): void {
    if (!state.parsed) return
    const mappedFieldIds = new Set(mapping.filter((entry) => entry.header).map((entry) => entry.fieldId))
    const nextMatchFieldIds = state.matchFieldIds.filter((fieldId) => mappedFieldIds.has(fieldId))
    recomputeValidation(state.parsed, state.fields, mapping, nextMatchFieldIds)
    setState({ status: 'Mapping updated. Import will validate before submitting.' })
  }

  function handleMatchFieldsChanged(matchFieldIds: string[]): void {
    if (!state.parsed) return
    const mappedFieldIds = new Set(state.mapping.filter((entry) => entry.header).map((entry) => entry.fieldId))
    const nextMatchFieldIds = Array.from(new Set(matchFieldIds.filter((fieldId) => mappedFieldIds.has(fieldId))))
    recomputeValidation(state.parsed, state.fields, state.mapping, nextMatchFieldIds)
    setState({
      status:
        nextMatchFieldIds.length > 0
          ? `Match On set for ${nextMatchFieldIds.length} field(s).`
          : 'Match On cleared. Import will add rows.'
    })
  }

  async function runImport(validation: GridImportValidationResult, validationModal?: { close: () => void }): Promise<void> {
    const route = parseGridRouteContext(window.location.href)
    const tenant = getTenantFromLocation(window.location.href)
    const payload = getGridFieldsPayloadForCurrentContext()
    const viewId = parseViewIdFromFieldsSelf(payload?.__self__) || (route ? getLatestGridViewIdForContext(route.workspaceId, route.dmsId) : null)
    if (!state.parsed || !validation.valid) {
      setState({ status: 'Resolve field validation issues before importing.' })
      return
    }
    if (!route || !tenant || !viewId) {
      setState({ status: 'Cannot import: missing grid runtime context.' })
      return
    }

    validationModal?.close()
    const importRowTotal = state.parsed.rows.filter((row) => row.some((value) => String(value || '').trim())).length
    setState({
      submitting: true,
      failures: [],
      validation,
      status: 'Importing rows...',
      progress: { completed: 0, total: Math.max(importRowTotal, 1), message: 'Preparing import...' }
    })
    await gridService.hydrateGridRowsForCurrentContext()
    const existingRows = gridService.buildApiRowProjections(gridService.getGridRowsPayloadForCurrentGrid())
    const result = await submitGridImportRows(
      state.parsed,
      state.fields,
      state.mapping,
      {
        ext,
        tenant,
        workspaceId: route.workspaceId,
        dmsId: route.dmsId,
        viewId,
        existingRows,
        matchFieldIds: state.matchFieldIds
      },
      (progress) => setState({ progress })
    )
    const importSucceeded = result.failures.length === 0
    setState({
      submitting: false,
      failures: result.failures,
      status:
        result.failures.length > 0
          ? `Imported ${result.successCount} row(s) (${result.addCount} added, ${result.updateCount} updated). ${result.failures.length} failed.`
          : `Imported ${result.successCount} row(s) successfully (${result.addCount} added, ${result.updateCount} updated).`,
      progress: null
    })
    if (importSucceeded) {
      close()
      if (result.successCount > 0) {
        window.setTimeout(() => {
          gridService.clearCaches()
          if (!tryRefreshGridTabInPlace()) window.location.reload()
        }, 600)
      }
    }
  }

  async function openAdvancedEditorWithSession(validation: GridImportValidationResult): Promise<void> {
    if (editConfirmModalOpen) return
    if (!state.parsed || !canBuildImportEditSession(validation)) {
      setState({ status: 'Resolve field validation issues before editing in the advanced editor.' })
      return
    }

    const nonEmptyRowCount = state.parsed.rows.filter((row) => row.some((value) => String(value || '').trim())).length
    setState({
      loading: true,
      validation,
      status: 'Preparing imported rows for the advanced editor...',
      progress: {
        completed: 0,
        total: Math.max(nonEmptyRowCount, 1),
        message: 'Refreshing grid rows...'
      }
    })

    await gridService.hydrateGridRowsForCurrentContext()
    const existingRows = gridService.buildApiRowProjections(gridService.getGridRowsPayloadForCurrentGrid())
    const session = await buildImportEditSession({
      fileName: state.fileName,
      parsed: state.parsed,
      fields: state.fields,
      mapping: state.mapping,
      matchFieldIds: state.matchFieldIds,
      validation,
      rowValidation: state.rowValidation,
      existingRows: toMatchableRows(existingRows),
      domRowIndexByRowId: buildDomRowIndexByRowId(gridService)
    })

    setState({ loading: false, progress: null })

    if (session.rows.length === 0) {
      const skippedSummary = summarizeImportEditSkippedRows(session.skippedRows)
      if (skippedSummary) {
        const status = formatImportEditAllSkippedStatus(skippedSummary)
        setState({ status })
        showGridImportEditAllSkippedModal({
          skippedRowCount: skippedSummary.skippedRowCount,
          firstReason: skippedSummary.firstReason,
          hasAdditionalSkippedRows: skippedSummary.hasAdditionalSkippedRows,
          onClose: () => setState({ status })
        })
      } else {
        setState({
          status: 'No imported rows could be staged in the advanced editor. Review mapping and validation issues.'
        })
      }
      return
    }

    editConfirmModalOpen = true
    showGridImportEditConfirmModal({
      skippedRowCount: session.skippedRows.length,
      stagedRowCount: session.rows.length,
      onCancel: () => {
        editConfirmModalOpen = false
        setState({ status: 'Edit cancelled. Review the import preview before trying again.' })
      },
      onContinue: () => {
        editConfirmModalOpen = false
        void finishOpenAdvancedEditor(session)
      }
    })
  }

  async function finishOpenAdvancedEditor(session: GridImportEditSession): Promise<void> {
    setState({ status: 'Opening advanced editor...' })
    const openResult = await options.onEditInAdvancedEditor(session)
    if (openResult.ok === false) {
      setState({ status: openResult.reason })
      return
    }
    close({ restoreAdvancedEditorOverlay: false })
  }

  async function handleImport(): Promise<void> {
    const validation = await refreshFieldsAndValidate()
    if (!validation) return
    const hasIssues =
      validation.mappingIssues.length > 0 || validation.rowIssues.length > 0 || validation.warningIssues.length > 0
    if (!hasIssues) {
      void runImport(validation)
      return
    }
    const issuesModal = showGridImportValidationIssuesModal(
      validation,
      () => {
        issuesModal.close()
        void runImport(validation)
      },
      () => issuesModal.close()
    )
  }

  async function handleEdit(): Promise<void> {
    if (!canHandoffToAdvancedEditor()) {
      setState({ status: 'Advanced editor is not available for this page.' })
      return
    }

    const validation = await refreshFieldsAndValidate()
    if (!validation) return
    if (!canBuildImportEditSession(validation)) {
      const issuesModal = showGridImportValidationIssuesModal(
        validation,
        () => issuesModal.close(),
        () => issuesModal.close(),
        { intent: 'edit' }
      )
      return
    }

    const hasWarnings = validation.warningIssues.length > 0
    if (!hasWarnings) {
      await openAdvancedEditorWithSession(validation)
      return
    }

    const issuesModal = showGridImportValidationIssuesModal(
      validation,
      () => {
        issuesModal.close()
        void openAdvancedEditorWithSession(validation)
      },
      () => issuesModal.close(),
      { intent: 'edit' }
    )
  }

  function dismissDialogUi(): void {
    dialog?.close()
    dialog = null
  }

  function close(options?: { restoreAdvancedEditorOverlay?: boolean }): void {
    editConfirmModalOpen = false
    const shouldRestore =
      openedFromAdvancedEditor && options?.restoreAdvancedEditorOverlay !== false
    if (shouldRestore) {
      restoreGridFormModalOverlay()
    }
    openedFromAdvancedEditor = false
    dismissDialogUi()
  }

  function openMappingDialog(): void {
    if (openedFromAdvancedEditor) {
      suppressGridFormModalOverlay()
    }
    dialog = showGridImportDialog({
      onMappingChanged: handleMappingChanged,
      onMatchFieldsChanged: handleMatchFieldsChanged,
      onImport: () => {
        void handleImport()
      },
      onEdit: () => {
        void handleEdit()
      },
      canEditInAdvancedEditor,
      onClose: close
    })
    dialog.update(state)
  }

  function open(openOptions?: GridImportOpenOptions): void {
    openedFromAdvancedEditor = openOptions?.fromAdvancedEditor === true
    // Open the native picker synchronously on click; defer dialog teardown so it does not block the OS file dialog.
    const pickerPromise = promptForGridImportCsvFile()
    queueMicrotask(() => {
      dismissDialogUi()
    })
    void pickerPromise.then((file) => {
      if (!file) {
        openedFromAdvancedEditor = false
        return
      }
      state = {
        fileName: '',
        parsed: null,
        fields: [],
        mapping: [],
        matchFieldIds: [],
        validation: null,
        showValidationColumn: false,
        rowValidation: {},
        loading: false,
        submitting: false,
        progress: null,
        failures: [],
        status: '',
        enableAdvancedEditor: showEditInImportDialog(),
        fromAdvancedEditor: openedFromAdvancedEditor
      }
      openMappingDialog()
      setState({
        loading: true,
        fileName: file.name,
        status: 'Loading grid fields and parsing CSV...',
        failures: []
      })
      void handleFileSelected(file)
    })
  }

  return { open, close }
}
