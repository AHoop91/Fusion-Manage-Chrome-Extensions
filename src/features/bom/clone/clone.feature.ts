import type { PlmExtRuntime } from '../../../shared/runtime/types'
import type { AttachmentDownloadBomNode } from '../downloader'
import { createCloneDom } from './clone.dom'
import { createEmptyBomClonePermissions, resolveBomClonePermissions, type BomClonePermissions } from './clone.permissions'
import type { CloneLaunchMode } from './clone.types'
import type { CloneService } from './services/service.contract'

type CloneRuntime = Pick<PlmExtRuntime, 'requestPlmAction' | 'openModal' | 'closeModal' | 'findByIdDeep'>
type CloneControllerModule = typeof import('./clone.controller')
type CloneController = ReturnType<CloneControllerModule['createCloneController']>
type DownloaderModule = typeof import('../downloader')
type AttachmentDownloadView = ReturnType<DownloaderModule['createAttachmentDownloadView']>

export type BomCloneFeature = {
  mount: () => void
  update: () => void
  unmount: () => void
}

export function createBomCloneFeature(runtime: CloneRuntime): BomCloneFeature {
  const dom = createCloneDom(runtime)
  let controller: CloneController | null = null
  let controllerLoadPromise: Promise<CloneController> | null = null
  let attachmentDownloadView: AttachmentDownloadView | null = null
  let attachmentDownloadService: CloneService | null = null
  let attachmentDownloadDepsPromise: Promise<{
    view: AttachmentDownloadView
    service: CloneService
  }> | null = null
  let attachmentDownloadModalRoot: HTMLDivElement | null = null
  let attachmentDownloadRequestId = 0
  let mounted = false
  let stopDomObservation: (() => void) | null = null
  let refreshTimer: number | null = null
  let keepAliveTimer: number | null = null
  let lastUrl = window.location.href
  const navEventName = 'plm-extension-location-change'
  let permissionContextKey: string | null = null
  let permissionLoadInFlight: Promise<BomClonePermissions> | null = null
  let permissions = createEmptyBomClonePermissions()
  let permissionsResolved = false

  function clearRefreshTimer(): void {
    if (refreshTimer === null) return
    window.clearTimeout(refreshTimer)
    refreshTimer = null
  }

  function clearKeepAliveTimer(): void {
    if (keepAliveTimer === null) return
    window.clearInterval(keepAliveTimer)
    keepAliveTimer = null
  }

  function stopObserver(): void {
    if (!stopDomObservation) return
    stopDomObservation()
    stopDomObservation = null
  }

  function clearPermissionState(): void {
    permissionLoadInFlight = null
    permissions = createEmptyBomClonePermissions()
    permissionsResolved = false
  }

  function closeAttachmentDownloadModal(): void {
    attachmentDownloadRequestId += 1
    if (attachmentDownloadModalRoot && attachmentDownloadView) {
      attachmentDownloadView.unmount(attachmentDownloadModalRoot)
    }
    attachmentDownloadModalRoot = null
    dom.closeAttachmentDownloadModalShell()
  }

  function renderAttachmentDownloadModal(params: {
    bomNodes: AttachmentDownloadBomNode[]
    bomLoading: boolean
    bomError: string | null
  }): void {
    if (!attachmentDownloadModalRoot) return
    if (!attachmentDownloadView) return
    attachmentDownloadView.render(attachmentDownloadModalRoot, {
      onClose: closeAttachmentDownloadModal,
      bomNodes: params.bomNodes,
      bomLoading: params.bomLoading,
      bomError: params.bomError
    })
  }

  function openAttachmentDownloadModal(): void {
    closeAttachmentDownloadModal()
    const modalRoot = dom.openAttachmentDownloadModalShell()
    if (!modalRoot) return
    attachmentDownloadModalRoot = modalRoot
    const requestId = attachmentDownloadRequestId + 1
    attachmentDownloadRequestId = requestId

    const activeContext = dom.resolveContext(window.location.href)
    if (!activeContext) {
      void ensureAttachmentDownloadDependencies().then(() => {
        if (attachmentDownloadRequestId !== requestId || !attachmentDownloadModalRoot) return
        renderAttachmentDownloadModal({
          bomNodes: [],
          bomLoading: false,
          bomError: 'Unable to resolve the current BOM context.'
        })
      })
      return
    }

    const depsPromise = ensureAttachmentDownloadDependencies()
    void depsPromise
      .then(({ service }) => {
        if (attachmentDownloadRequestId !== requestId || !attachmentDownloadModalRoot) return null
        renderAttachmentDownloadModal({
          bomNodes: [],
          bomLoading: true,
          bomError: null
        })
        return service.fetchSourceBomStructure(activeContext, activeContext.currentItemId, { depth: 100 })
      })
      .then((bomNodes) => {
        if (!Array.isArray(bomNodes)) return
        if (attachmentDownloadRequestId !== requestId || !attachmentDownloadModalRoot) return
        renderAttachmentDownloadModal({
          bomNodes,
          bomLoading: false,
          bomError: null
        })
      })
      .catch((error) => {
        if (attachmentDownloadRequestId !== requestId || !attachmentDownloadModalRoot) return
        renderAttachmentDownloadModal({
          bomNodes: [],
          bomLoading: false,
          bomError: `Failed to load the current BOM. ${error instanceof Error ? error.message : String(error)}`
        })
      })
  }

  async function ensureAttachmentDownloadDependencies(): Promise<{
    view: AttachmentDownloadView
    service: CloneService
  }> {
    if (attachmentDownloadView && attachmentDownloadService) {
      return {
        view: attachmentDownloadView,
        service: attachmentDownloadService
      }
    }

    if (attachmentDownloadDepsPromise) return attachmentDownloadDepsPromise

    attachmentDownloadDepsPromise = Promise.all([
      import('../downloader'),
      import('./clone.service')
    ])
      .then(([downloaderModule, cloneServiceModule]) => {
        attachmentDownloadView = downloaderModule.createAttachmentDownloadView()
        attachmentDownloadService = cloneServiceModule.createCloneService(runtime)
        return {
          view: attachmentDownloadView,
          service: attachmentDownloadService
        }
      })
      .finally(() => {
        attachmentDownloadDepsPromise = null
      })

    return attachmentDownloadDepsPromise
  }

  function scheduleSync(delayMs = 0): void {
    if (controller) {
      controller.update()
      return
    }
    if (refreshTimer !== null) return
    refreshTimer = window.setTimeout(() => {
      refreshTimer = null
      syncLauncher()
    }, Math.max(0, delayMs))
  }

  function onUrlMaybeChanged(): void {
    const currentUrl = window.location.href
    if (currentUrl === lastUrl) return
    lastUrl = currentUrl
    scheduleSync(0)
  }

  function ensureObserver(): void {
    if (controller || stopDomObservation) return
    stopDomObservation = dom.observeCloneButtonPresence((delayMs) => scheduleSync(delayMs))
  }

  async function ensureController(): Promise<CloneController> {
    if (controller) return controller
    if (controllerLoadPromise) return controllerLoadPromise

    controllerLoadPromise = import('./clone.controller')
      .then((module) => {
        controller = module.createCloneController(runtime)
        return controller
      })
      .finally(() => {
        controllerLoadPromise = null
      })

    const loadedController = await controllerLoadPromise
    if (mounted) {
      stopObserver()
      clearRefreshTimer()
      clearKeepAliveTimer()
      loadedController.mount()
    }
    return loadedController
  }

  async function openClone(mode: CloneLaunchMode): Promise<void> {
    const loadedController = await ensureController()
    await loadedController.launchClone(mode)
  }

  function syncLauncher(): void {
    if (controller) {
      controller.update()
      return
    }

    const isBom = dom.isBomTab(window.location.href)
    if (!isBom) {
      dom.removeCloneButton()
      dom.removeAdvancedAttachmentDownloadButton()
      closeAttachmentDownloadModal()
      permissionContextKey = null
      clearPermissionState()
      return
    }

    dom.ensureAdvancedAttachmentDownloadButton(() => {
      openAttachmentDownloadModal()
    }, {
      disabled: false,
      title: 'Advanced Download Attachments'
    })

    const resolvedContext = dom.resolveContext(window.location.href)
    if (!resolvedContext) {
      dom.removeCloneButton()
      return
    }

    const nextPermissionKey = `${resolvedContext.tenant}:${resolvedContext.workspaceId}`
    if (permissionContextKey !== nextPermissionKey) {
      permissionContextKey = nextPermissionKey
      clearPermissionState()
    }

    if (!permissionsResolved) {
      if (!permissionLoadInFlight) {
        permissionLoadInFlight = resolveBomClonePermissions(runtime, resolvedContext.tenant, resolvedContext.workspaceId)
          .then((nextPermissions) => {
            if (permissionContextKey === nextPermissionKey) {
              permissions = nextPermissions
              permissionsResolved = true
            }
            return nextPermissions
          })
          .catch(() => {
            const fallback = createEmptyBomClonePermissions()
            if (permissionContextKey === nextPermissionKey) {
              permissions = fallback
              permissionsResolved = true
            }
            return fallback
          })
          .finally(() => {
            permissionLoadInFlight = null
            scheduleSync(0)
          })
      }
      dom.removeCloneButton()
      return
    }

    if (!permissions.canAdd) {
      dom.removeCloneButton()
      return
    }

    dom.ensureCloneButton((mode) => {
      void openClone(mode)
    }, {
      disabled: false,
      title: 'Quick Create'
    })
  }

  return {
    mount() {
      if (!mounted) {
        mounted = true
        lastUrl = window.location.href
        window.addEventListener(navEventName, onUrlMaybeChanged)
        window.addEventListener('hashchange', onUrlMaybeChanged)
        window.addEventListener('popstate', onUrlMaybeChanged)
      }

      if (controller) {
        controller.mount()
        return
      }

      ensureObserver()
      syncLauncher()

      if (keepAliveTimer === null) {
        keepAliveTimer = window.setInterval(() => {
          if (controller) return
          if (!dom.isBomTab(window.location.href)) return
          if (!dom.isAdvancedAttachmentDownloadButtonPresent()) {
            scheduleSync(0)
            return
          }
          if (permissionsResolved && permissions.canAdd && !dom.isCloneButtonPresent()) scheduleSync(0)
        }, 300)
      }
    },
    update() {
      if (controller) {
        controller.update()
        return
      }
      scheduleSync(0)
    },
    unmount() {
      if (mounted) {
        mounted = false
        window.removeEventListener(navEventName, onUrlMaybeChanged)
        window.removeEventListener('hashchange', onUrlMaybeChanged)
        window.removeEventListener('popstate', onUrlMaybeChanged)
      }

      clearRefreshTimer()
      clearKeepAliveTimer()
      stopObserver()
      closeAttachmentDownloadModal()
      permissionContextKey = null
      clearPermissionState()

      if (controller) {
        controller.unmount()
        return
      }

      dom.removeCloneButton()
    }
  }
}
