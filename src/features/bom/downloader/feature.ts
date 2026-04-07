import type { PlmExtRuntime } from '../../../shared/runtime/types'
import { createAttachmentDownloadDom } from './dom'
import { loadAttachmentDownloadPreview } from './services/preview.service'
import type { AttachmentDownloadBomNode, AttachmentPreviewConfig } from './types'
import { resolveBomPageContext } from '../shared/page'

type DownloaderRuntime = Pick<PlmExtRuntime, 'requestPlmAction' | 'openModal' | 'closeModal' | 'findByIdDeep'>
type AttachmentDownloadViewModule = typeof import('./view/viewRenderer')
type AttachmentDownloadView = ReturnType<AttachmentDownloadViewModule['createAttachmentDownloadView']>

export type BomAttachmentDownloadFeature = {
  mount: () => void
  update: () => void
  unmount: () => void
}

export function createBomAttachmentDownloadFeature(runtime: DownloaderRuntime): BomAttachmentDownloadFeature {
  const dom = createAttachmentDownloadDom(runtime)
  let attachmentDownloadView: AttachmentDownloadView | null = null
  let attachmentDownloadViewPromise: Promise<AttachmentDownloadView> | null = null
  let attachmentDownloadModalRoot: HTMLDivElement | null = null
  let attachmentDownloadRequestId = 0
  let mounted = false
  let stopDomObservation: (() => void) | null = null
  let refreshTimer: number | null = null
  let keepAliveTimer: number | null = null
  let lastUrl = window.location.href
  const navEventName = 'plm-extension-location-change'

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

  function closeAttachmentDownloadModal(): void {
    attachmentDownloadRequestId += 1
    if (attachmentDownloadModalRoot && attachmentDownloadView) {
      attachmentDownloadView.unmount(attachmentDownloadModalRoot)
    }
    attachmentDownloadModalRoot = null
    dom.closeAttachmentDownloadModalShell()
  }

  async function ensureAttachmentDownloadView(): Promise<AttachmentDownloadView> {
    if (attachmentDownloadView) return attachmentDownloadView
    if (attachmentDownloadViewPromise) return attachmentDownloadViewPromise

    attachmentDownloadViewPromise = import('./view/viewRenderer')
      .then((module) => {
        attachmentDownloadView = module.createAttachmentDownloadView()
        return attachmentDownloadView
      })
      .finally(() => {
        attachmentDownloadViewPromise = null
      })

    return attachmentDownloadViewPromise
  }

  function renderAttachmentDownloadModal(params: {
    bomNodes: AttachmentDownloadBomNode[]
    bomLoading: boolean
    bomError: string | null
    attachmentPreviewConfig: AttachmentPreviewConfig
  }): void {
    if (!attachmentDownloadModalRoot || !attachmentDownloadView) return
    attachmentDownloadView.render(attachmentDownloadModalRoot, {
      onClose: closeAttachmentDownloadModal,
      bomNodes: params.bomNodes,
      bomLoading: params.bomLoading,
      bomError: params.bomError,
      attachmentPreviewConfig: params.attachmentPreviewConfig
    })
  }

  function openAttachmentDownloadModal(): void {
    closeAttachmentDownloadModal()
    const modalRoot = dom.openAttachmentDownloadModalShell()
    if (!modalRoot) return
    attachmentDownloadModalRoot = modalRoot
    const requestId = attachmentDownloadRequestId + 1
    attachmentDownloadRequestId = requestId

    const activeContext = resolveBomPageContext(window.location.href)
    if (!activeContext) {
      void ensureAttachmentDownloadView().then(() => {
        if (attachmentDownloadRequestId !== requestId || !attachmentDownloadModalRoot) return
        renderAttachmentDownloadModal({
          bomNodes: [],
          bomLoading: false,
          bomError: 'Unable to resolve the current BOM context.',
          attachmentPreviewConfig: {
            enabled: false,
            warningMessage: 'Preview attachments is disabled because the current BOM context could not be resolved.',
            attachmentFieldViewDefId: null
          }
        })
      })
      return
    }

    void ensureAttachmentDownloadView()
      .then(() => {
        if (attachmentDownloadRequestId !== requestId || !attachmentDownloadModalRoot) return null
        renderAttachmentDownloadModal({
          bomNodes: [],
          bomLoading: true,
          bomError: null,
          attachmentPreviewConfig: {
            enabled: false,
            warningMessage: null,
            attachmentFieldViewDefId: null
          }
        })
        return loadAttachmentDownloadPreview(runtime, activeContext)
      })
      .then((result) => {
        if (!result) return
        if (attachmentDownloadRequestId !== requestId || !attachmentDownloadModalRoot) return
        renderAttachmentDownloadModal({
          bomNodes: result.bomNodes,
          bomLoading: false,
          bomError: null,
          attachmentPreviewConfig: result.attachmentPreviewConfig
        })
      })
      .catch((error) => {
        if (attachmentDownloadRequestId !== requestId || !attachmentDownloadModalRoot) return
        renderAttachmentDownloadModal({
          bomNodes: [],
          bomLoading: false,
          bomError: `Failed to load the current BOM. ${error instanceof Error ? error.message : String(error)}`,
          attachmentPreviewConfig: {
            enabled: false,
            warningMessage: 'Preview attachments is disabled because the attachment field metadata could not be loaded.',
            attachmentFieldViewDefId: null
          }
        })
      })
  }

  function scheduleSync(delayMs = 0): void {
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
    if (stopDomObservation) return
    stopDomObservation = dom.observeButtonPresence((delayMs) => scheduleSync(delayMs))
  }

  function syncLauncher(): void {
    const isBom = dom.isBomTab(window.location.href)
    if (!isBom) {
      dom.removeAttachmentDownloadButton()
      closeAttachmentDownloadModal()
      return
    }

    dom.ensureAttachmentDownloadButton(() => {
      openAttachmentDownloadModal()
    }, {
      disabled: false,
      title: 'Advanced Download Attachments'
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

      ensureObserver()
      syncLauncher()

      if (keepAliveTimer === null) {
        keepAliveTimer = window.setInterval(() => {
          if (!dom.isBomTab(window.location.href)) return
          if (!dom.isAttachmentDownloadButtonPresent()) scheduleSync(0)
        }, 300)
      }
    },
    update() {
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
      dom.removeAttachmentDownloadButton()
    }
  }
}
