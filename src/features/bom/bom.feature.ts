import type { PlmExtRuntime, PageModule } from '../../shared/runtime/types'

type BomRuntime = Pick<PlmExtRuntime, 'isFusionHost' | 'requestPlmAction' | 'openModal' | 'closeModal' | 'findByIdDeep'>
type BomFeatureController = {
  mount: () => void
  update: () => void
  unmount: () => void
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

  function ensureCloneFeature(): Promise<BomFeatureController> {
    if (cloneFeature) return Promise.resolve(cloneFeature)
    if (cloneFeaturePromise) return cloneFeaturePromise

    cloneFeaturePromise = import('./clone/index')
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
    if (downloadFeature) return Promise.resolve(downloadFeature)
    if (downloadFeaturePromise) return downloadFeaturePromise

    downloadFeaturePromise = import('./downloader/index')
      .then((module) => {
        downloadFeature = module.createBomAttachmentDownloadFeature(ext)
        return downloadFeature
      })
      .finally(() => {
        downloadFeaturePromise = null
      })

    return downloadFeaturePromise
  }

  return {
    id: 'bom',
    requiredSelectors: [],
    riskLevel: 'high',
    matches(url) {
      return isBomPage(url, ext.isFusionHost)
    },
    mount() {
      void Promise.all([ensureCloneFeature(), ensureDownloadFeature()]).then(([nextCloneFeature, nextDownloadFeature]) => {
        nextCloneFeature.mount()
        nextDownloadFeature.mount()
      })
    },
    update() {
      void Promise.all([ensureCloneFeature(), ensureDownloadFeature()]).then(([nextCloneFeature, nextDownloadFeature]) => {
        nextCloneFeature.update()
        nextDownloadFeature.update()
      })
    },
    unmount() {
      if (cloneFeature) cloneFeature.unmount()
      if (downloadFeature) downloadFeature.unmount()
    }
  }
}
