import type { GridService } from '../services/gridService'
import type { ApiRowProjection, ApiTableColumn, MatchedFormField, SelectedRowModel } from '../types'
import type { ModalState } from './modalState'

/**
 * Metadata refresh payload emitted on each poll tick.
 */
export interface MetadataRefreshResult {
  hasApiFieldMetadata: boolean
  apiTableColumns: ApiTableColumn[]
  matchedFields: MatchedFormField[]
  apiRows: ApiRowProjection[]
  selectedRowModels: SelectedRowModel[]
}

/**
 * Metadata manager polling contract.
 */
export interface MetadataManager {
  cancelPolling: () => void
  startPolling: () => void
}

type MetadataPollOptions = {
  maxAttempts: number
  intervalMs: number
}

function startMetadataPolling(
  options: MetadataPollOptions,
  onTick: () => boolean,
  onTimeout: () => void
): { cancel: () => void } {
  let attempts = 0
  let timer: number | null = null
  const cancel = (): void => {
    if (timer === null) return
    window.clearInterval(timer)
    timer = null
  }
  timer = window.setInterval(() => {
    attempts += 1
    const done = onTick()
    if (done) {
      cancel()
      return
    }
    if (attempts >= options.maxAttempts) {
      cancel()
      onTimeout()
    }
  }, options.intervalMs)
  return { cancel }
}

/**
 * Metadata manager dependencies.
 */
export interface MetadataManagerDeps {
  state: ModalState
  gridService: GridService
  computeApiTableColumns: () => ApiTableColumn[]
  computeMatchedFields: (columns: ApiTableColumn[]) => MatchedFormField[]
  computeApiRows: () => ApiRowProjection[]
  setLoadingState: (isLoading: boolean, text?: string) => void
  setStatus: (message: string) => void
  onMetadataUpdated: (result: MetadataRefreshResult) => void
}

/**
 * Creates metadata manager that updates modal state only through state APIs.
 */
export function createMetadataManager(deps: MetadataManagerDeps): MetadataManager {
  const { state, gridService } = deps

  function cancelPolling(): void {
    const handle = state.getMetadataPollHandle()
    if (!handle) return
    handle.cancel()
    state.setMetadataPollHandle(null)
  }

  function startPolling(): void {
    const meta = state.getMetadata()
    if (state.getMetadataPollHandle() || (meta.hasApiFieldMetadata && meta.apiRows.length > 0)) return

    state.setMetadataPollHandle(
      startMetadataPolling(
        { maxAttempts: 40, intervalMs: 200 },
        () => {
          const modalAlive = document.getElementById('plm-extension-grid-form-modal')
          if (!modalAlive) {
            cancelPolling()
            return true
          }

          if (!state.isMetadataHydrationStarted()) {
            state.markMetadataHydrationStarted()
            deps.setStatus('Loading fields metadata...')
            deps.setLoadingState(true, 'Loading metadata...')
            void Promise.all([gridService.hydrateGridFieldsForCurrentContext(), gridService.hydrateGridRowsForCurrentContext()])
          }

          const nextApiTableColumns = deps.computeApiTableColumns()
          const hasApiFieldMetadata = nextApiTableColumns.length > 0
          const apiTableColumns = hasApiFieldMetadata ? nextApiTableColumns : []
          const matchedFields = deps.computeMatchedFields(apiTableColumns)
          const apiRows = deps.computeApiRows()
          const selectedRowModels = gridService.buildApiRowModels(apiRows)

          deps.onMetadataUpdated({
            hasApiFieldMetadata,
            apiTableColumns,
            matchedFields,
            apiRows,
            selectedRowModels
          })

          const done = hasApiFieldMetadata && apiRows.length > 0
          if (done) {
            deps.setLoadingState(false)
            cancelPolling()
          }
          return done
        },
        () => {
          deps.setLoadingState(false)
          const latest = state.getMetadata()
          if (latest.apiTableColumns.length === 0 || latest.matchedFields.length === 0) {
            deps.setStatus('No fields matched API metadata.')
          } else if (latest.apiRows.length === 0) {
            deps.setStatus('Grid rows payload not available.')
          }
        }
      )
    )
  }

  return {
    cancelPolling,
    startPolling
  }
}
