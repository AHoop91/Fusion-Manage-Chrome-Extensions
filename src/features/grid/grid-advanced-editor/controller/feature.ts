import { getEffectiveFeatures } from '../../../../extension/runtime/effectiveFeatures'
import { initRuntimeFeaturesFromStorage } from '../../../../extension/runtime/runtimeFeatureStorage'
import { GRID_FILTER_TOGGLE_BUTTON_ID } from '../../grid-filters/constants'
import { parseGridRouteContext } from '../../grid-page/grid-page-context'
import { getCommandButtonHost } from '../../grid-filters/panelLayout'
import type { GridPageRuntime } from '../../grid.types'
import { GRID_FORM_BUTTON_ID } from '../view/constants'
import { createGridFormEventManager } from './eventManager'
import { createGridFormModalController } from './modalController'
import { resolveGridAdvancedEditorPermissions, type GridAdvancedEditorPermissions } from '../services/permissions.service'
import { createFormRenderer } from '../view/formRenderer'
import { createGridService } from '../services/gridService'
import type { GridImportEditOpenResult, GridImportEditSession } from '../../grid-staging/grid-import-edit-session'
import type { GridFormFeature } from '../types'
import { warnGridDiagnostic } from '../../grid-services/gridDiagnostics'

const NAV_EVENT = 'plm-extension-location-change'

/**
 * Grid form feature bootstrap.
 *
 * Responsibilities:
 * - compose domain services (grid parsing, rendering, modal behavior)
 * - own command button lifecycle
 * - delegate global listener lifecycle to EventManager
 */
export type GridFormFeatureOptions = {
  onImportCsv?: () => void
}

export function createGridFormFeature(
  ext: Pick<GridPageRuntime, 'requestPlmAction'>,
  options: GridFormFeatureOptions = {}
): GridFormFeature {
  const gridService = createGridService()
  const formRenderer = createFormRenderer(gridService)
  const modalController = createGridFormModalController({
    gridService,
    formRenderer,
    onImportCsv: options.onImportCsv
  })

  let hydratedContextKey: string | null = null
  let permissionContextKey: string | null = null
  let permissionSnapshot: GridAdvancedEditorPermissions | null = null
  let permissionLoadInFlight: Promise<GridAdvancedEditorPermissions> | null = null

  function clearPermissionState(): void {
    permissionSnapshot = null
    permissionLoadInFlight = null
  }

  function openFormModalWithRetry(): void {
    if (!permissionSnapshot?.canOpen) return
    modalController.openForTable(permissionSnapshot)
  }

  async function openForTableWithImportSession(session: GridImportEditSession): Promise<GridImportEditOpenResult> {
    await initRuntimeFeaturesFromStorage()
    const route = parseGridRouteContext(window.location.href)
    const tenant = gridService.getTenantFromLocation(window.location.href)
    if (!route || !tenant) {
      return { ok: false, reason: 'Cannot open advanced editor: missing grid page context.' }
    }

    const nextPermissionKey = `${tenant}:${route.workspaceId}`
    if (permissionContextKey !== nextPermissionKey) {
      permissionContextKey = nextPermissionKey
      clearPermissionState()
    }

    if (!permissionSnapshot) {
      try {
        permissionSnapshot = await resolveGridAdvancedEditorPermissions(ext, tenant, route.workspaceId)
      } catch {
        permissionSnapshot = {
          canAdd: false,
          canDelete: false,
          canEdit: false,
          canOpen: false
        }
      }
    }

    if (!permissionSnapshot.canOpen) {
      return { ok: false, reason: 'Advanced editor is unavailable for current permissions.' }
    }

    modalController.openForTableWithImportSession(session, permissionSnapshot)
    return { ok: true }
  }

  function handleOpenFormTrigger(event: Event): void {
    event.preventDefault()
    event.stopPropagation()
    if (!permissionSnapshot?.canOpen) return
    openFormModalWithRetry()
  }

  function updateButtonState(button: HTMLButtonElement): void {
    if (!permissionSnapshot?.canOpen) {
      button.disabled = true
      button.title = 'Advanced editor is unavailable for current permissions'
      return
    }
    const rowCount = gridService.buildApiRowProjections(gridService.getGridRowsPayloadForCurrentGrid()).length
    button.disabled = false
    button.title =
      rowCount > 0
        ? `Open advanced editor for ${rowCount} row${rowCount === 1 ? '' : 's'}`
        : 'Open advanced editor'
  }

  async function ensureButton(): Promise<void> {
    await initRuntimeFeaturesFromStorage()
    const existing = document.getElementById(GRID_FORM_BUTTON_ID)
    if (!getEffectiveFeatures().enableGridAdvancedEditor) {
      warnGridDiagnostic('ae-disabled', 'Advanced Editor is off (build flag or extension popup toggle).')
      if (existing) existing.remove()
      modalController.close()
      hydratedContextKey = null
      permissionContextKey = null
      clearPermissionState()
      return
    }
    if (!gridService.isGridViewModeActive()) {
      warnGridDiagnostic(
        'ae-view-mode',
        'Advanced Editor hidden: grid must be in view mode (Edit visible, Save/Cancel hidden).'
      )
      if (existing) existing.remove()
      modalController.close()
      hydratedContextKey = null
      permissionContextKey = null
      clearPermissionState()
      return
    }

    const route = parseGridRouteContext(window.location.href)
    const tenant = gridService.getTenantFromLocation(window.location.href)
    if (!route || !tenant) {
      warnGridDiagnostic('ae-route', 'Advanced Editor hidden: grid route or tenant could not be parsed from the URL.')
      if (existing) existing.remove()
      return
    }

    const nextPermissionKey = `${tenant}:${route.workspaceId}`
    if (permissionContextKey !== nextPermissionKey) {
      permissionContextKey = nextPermissionKey
      clearPermissionState()
    }

    if (!permissionSnapshot) {
      if (!permissionLoadInFlight) {
        permissionLoadInFlight = resolveGridAdvancedEditorPermissions(ext, tenant, route.workspaceId)
          .then((snapshot) => {
            if (permissionContextKey === nextPermissionKey) permissionSnapshot = snapshot
            return snapshot
          })
          .catch((error) => {
            const fallback: GridAdvancedEditorPermissions = {
              canAdd: false,
              canDelete: false,
              canEdit: false,
              canOpen: false
            }
            warnGridDiagnostic(
              'ae-permissions',
              'Advanced Editor hidden: could not load workspace permissions.',
              error
            )
            if (permissionContextKey === nextPermissionKey) permissionSnapshot = fallback
            return fallback
          })
          .finally(() => {
            permissionLoadInFlight = null
            void ensureButton()
          })
      }
      if (existing instanceof HTMLButtonElement) {
        existing.disabled = true
        existing.title = 'Loading permissions...'
      }
      return
    }

    if (!permissionSnapshot.canOpen) {
      warnGridDiagnostic(
        'ae-permissions-denied',
        'Advanced Editor hidden: workspace permissions do not allow add/edit/delete on the grid.'
      )
      if (existing) existing.remove()
      modalController.close()
      return
    }

    if (route) {
      const currentKey = `${route.workspaceId}:${route.dmsId}`
      if (hydratedContextKey !== currentKey) {
        hydratedContextKey = currentKey
        void Promise.all([
          gridService.hydrateGridFieldsForCurrentContext(),
          gridService.hydrateGridRowsForCurrentContext()
        ])
      }
    }

    formRenderer.ensureStyles()
    const host = getCommandButtonHost()
    if (!host) {
      warnGridDiagnostic(
        'ae-toolbar-host',
        'Advanced Editor hidden: grid command bar (#transcluded-buttons .grid-command-bar) not found.'
      )
      return
    }

    let button = existing as HTMLButtonElement | null
    if (!button) {
      button = document.createElement('button')
      button.id = GRID_FORM_BUTTON_ID
      button.type = 'button'
      button.className = 'plm-extension-btn plm-extension-btn--secondary'
      button.setAttribute('aria-label', 'Advanced Editor')
      const icon = document.createElement('span')
      icon.className = 'plm-extension-grid-advanced-editor-icon zmdi zmdi-code-setting'
      icon.setAttribute('aria-hidden', 'true')
      const label = document.createElement('span')
      label.className = 'label'
      label.textContent = 'Advanced Editor'
      button.appendChild(icon)
      button.appendChild(label)
    }

    button.classList.add('plm-extension-btn', 'plm-extension-btn--secondary')

    button.onclick = (event): void => {
      handleOpenFormTrigger(event)
    }

    const filterButton = document.getElementById(GRID_FILTER_TOGGLE_BUTTON_ID)
    if (filterButton instanceof HTMLElement && filterButton.parentElement === host) {
      if (button.parentElement !== host || button.nextElementSibling !== filterButton) {
        button.remove()
        host.insertBefore(button, filterButton)
      }
    } else if (button.parentElement !== host) {
      button.remove()
      host.appendChild(button)
    }

    updateButtonState(button)
  }

  const eventManager = createGridFormEventManager({
    navEventName: NAV_EVENT,
    buttonId: GRID_FORM_BUTTON_ID,
    isActive: () => gridService.isGridViewModeActive(),
    ensureButton: (): void => {
      void ensureButton()
    },
    getButton: () => document.getElementById(GRID_FORM_BUTTON_ID) as HTMLButtonElement | null,
    updateButtonState,
    onButtonTrigger: handleOpenFormTrigger
  })

  function mount(): void {
    eventManager.mount()
  }

  function update(): void {
    eventManager.update()
  }

  function unmount(): void {
    eventManager.unmount()
    const button = document.getElementById(GRID_FORM_BUTTON_ID)
    if (button) button.remove()
    modalController.close()
    gridService.clearCaches()
    hydratedContextKey = null
    permissionContextKey = null
    clearPermissionState()
  }

  return {
    mount,
    update,
    unmount,
    openForTableWithImportSession
  }
}
