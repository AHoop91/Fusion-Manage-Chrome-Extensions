/**
 * Shared content-script runtime.
 *
 * Responsibilities:
 * - Provide common helpers (URL guards, deep DOM lookup, modal helpers)
 * - Provide option storage helpers
 * - Expose a lightweight page-module registry for route-based activation
 *
 * `requestPlmAction` is intentionally omitted from `window.__plmExt` so hostile page
 * scripts cannot invoke extension-proxied PLM APIs. Content modules resolve the full
 * runtime via `resolveContentPlmRuntime()`.
 */
import { findByIdDeep } from '../shared/dom/deepLookup'
import { ensureStyleTag } from '../shared/dom/styles'
import { createModalController } from '../shared/ui/modal/modalController'
import { createNavigationPatcher } from '../extension/runtime/navigation'
import { getLocalOptions, setLocalOptions } from '../extension/storage/localStorage'
import type { PageModule, PlmExtPublicRuntime } from '../shared/runtime/types'
import '../shared/runtime/types'
import { isAddItemPage, isFusionHost, isItemDetailsPage } from '../shared/url/parse'
import baseCss from '../styles/base.css?raw'

(() => {
  if (window.__plmExt) return
  ensureStyleTag('plm-extension-base-styles', baseCss)

  const pages: PageModule[] = []
  const ensureNavPatched = createNavigationPatcher()
  const { closeModal, openModal } = createModalController()

  /**
   * Register a page module; router owns activation state.
   */
  function registerPage(page: PageModule): void {
    pages.push({
      ...page,
      __active: false
    })
  }

  const runtime: PlmExtPublicRuntime = {
    pages,
    registerPage,
    ensureNavPatched,
    findByIdDeep,
    isFusionHost,
    isItemDetailsPage,
    isAddItemPage,
    closeModal,
    openModal,
    getLocalOptions,
    setLocalOptions
  }

  window.__plmExt = runtime
})()

export {}
