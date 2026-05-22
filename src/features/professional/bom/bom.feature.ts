import type { PlmExtRuntime, PageModule } from '../../../shared/runtime/types'
import { getEffectiveFeatures } from '../../../extension/runtime/effectiveFeatures'
import { initRuntimeFeaturesFromStorage } from '../../../extension/runtime/runtimeFeatureStorage'

type BomRuntime = Pick<PlmExtRuntime, 'isFusionHost' | 'requestPlmAction' | 'openModal' | 'closeModal' | 'findByIdDeep'>
type BomFeatureController = {
  mount: () => void
  update: () => void
  unmount: () => void
}

const noopController: BomFeatureController = {
  mount() {},
  update() {},
  unmount() {}
}

function isBomPage(urlString: string, isFusionHost: (url: string) => boolean): boolean {
  if (!isFusionHost(urlString)) return false

  try {
    const url = new URL(urlString)
    const pathname = url.pathname.toLowerCase()
    const tab = (url.searchParams.get('tab') || '').toLowerCase()
    const mode = (url.searchParams.get('mode') || '').toLowerCase()
    const view = (url.searchParams.get('view') || '').toLowerCase()

    const pathMatch = /^\/plm\/workspaces\/\d+\/items\/bom\/nested$/i.test(pathname)
    const supportedView = view === 'full' || view === 'split'
    return pathMatch && tab === 'bom' && mode === 'view' && supportedView
  } catch {
    return false
  }
}

export function createBomPageModule(ext: BomRuntime): PageModule {
  let cloneFeature: BomFeatureController | null = null
  let cloneFeaturePromise: Promise<BomFeatureController> | null = null
  let downloadFeature: BomFeatureController | null = null
  let downloadFeaturePromise: Promise<BomFeatureController> | null = null
  let mounted = false
  let lifecycleGeneration = 0

  function needsClone(): boolean {
    const f = getEffectiveFeatures()
    return f.enableBomVariant || f.enableBomManufacturing
  }

  function needsDownload(): boolean {
    return getEffectiveFeatures().enableBomAdvancedDownload
  }

  function ensureCloneFeature(): Promise<BomFeatureController> {
    if (!needsClone()) return Promise.resolve(noopController)
    if (cloneFeature) return Promise.resolve(cloneFeature)
    if (cloneFeaturePromise) return cloneFeaturePromise

    cloneFeaturePromise = import('./bom-clone/index')
      .then((module) => {
        cloneFeature = module.createBomCloneFeature(ext)
        return cloneFeature
      })
      .finally(() => {
        cloneFeaturePromise = null
      })

    return cloneFeaturePromise
  }

  function ensureDownloadFeature(): Promise<BomFeatureController> {
    if (!needsDownload()) return Promise.resolve(noopController)
    if (downloadFeature) return Promise.resolve(downloadFeature)
    if (downloadFeaturePromise) return downloadFeaturePromise

    downloadFeaturePromise = import('./bom-downloader/index')
      .then((module) => {
        downloadFeature = module.createBomAttachmentDownloadFeature(ext)
        return downloadFeature
      })
      .finally(() => {
        downloadFeaturePromise = null
      })

    return downloadFeaturePromise
  }

  function unmountDisabledFeatures(): void {
    if (!needsClone() && cloneFeature) {
      cloneFeature.unmount()
      cloneFeature = null
      cloneFeaturePromise = null
    }

    if (!needsDownload() && downloadFeature) {
      downloadFeature.unmount()
      downloadFeature = null
      downloadFeaturePromise = null
    }
  }

  function runWithFreshRuntimeFeatures(action: () => void): void {
    const gen = lifecycleGeneration
    void initRuntimeFeaturesFromStorage().then(() => {
      if (!mounted || gen !== lifecycleGeneration) return
      unmountDisabledFeatures()
      action()
    })
  }

  return {
    id: 'bom',
    requiredSelectors: [],
    matches(url) {
      return isBomPage(url, ext.isFusionHost)
    },
    mount() {
      mounted = true
      runWithFreshRuntimeFeatures(() => {
        void Promise.all([ensureCloneFeature(), ensureDownloadFeature()]).then(([nextCloneFeature, nextDownloadFeature]) => {
          if (!mounted) return
          nextCloneFeature.mount()
          nextDownloadFeature.mount()
        })
      })
    },
    update() {
      runWithFreshRuntimeFeatures(() => {
        void Promise.all([ensureCloneFeature(), ensureDownloadFeature()]).then(([nextCloneFeature, nextDownloadFeature]) => {
          if (!mounted) return
          nextCloneFeature.update()
          nextDownloadFeature.update()
        })
      })
    },
    unmount() {
      lifecycleGeneration += 1
      mounted = false
      if (cloneFeature) cloneFeature.unmount()
      if (downloadFeature) downloadFeature.unmount()
      cloneFeature = null
      cloneFeaturePromise = null
      downloadFeature = null
      downloadFeaturePromise = null
    }
  }
}
