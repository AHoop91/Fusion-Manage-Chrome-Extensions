/**
 * Shared content-script runtime.
 *
 * Responsibilities:
 * - Provide common helpers (URL guards, deep DOM lookup, modal helpers)
 * - Provide option storage helpers
 * - Expose a lightweight page-module registry for route-based activation
 */
import { findByIdDeep } from '../dom/deepLookup'
import { ensureStyleTag } from '../dom/styles'
import { createModalController } from '../ui/modal/modalController'
import { requestPlmAction } from '../platform/background/actions'
import { createNavigationPatcher } from '../platform/runtime/navigation'
import { getLocalOptions, setLocalOptions } from '../platform/storage/localOptions'
import type { PageModule, PlmExtRuntime } from '../shared/runtime/types'
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

  const runtime: PlmExtRuntime = {
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
    setLocalOptions,
    requestPlmAction
  }

  window.__plmExt = runtime
})()

export {}
