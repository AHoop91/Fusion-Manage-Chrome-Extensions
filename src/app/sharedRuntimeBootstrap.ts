/**
 * Shared content-script runtime.
 *
 * Responsibilities:
 * - Provide common helpers (URL guards, deep DOM lookup, modal helpers)
 * - Provide option storage helpers
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
import type { PlmExtPublicRuntime } from '../shared/runtime/types'
import '../shared/runtime/types'
import { isAddItemPage, isFusionHost, isItemDetailsPage } from '../shared/url/parse'
import baseCss from '../styles/base.css?raw'

(() => {
  if (window.__plmExt) return
  ensureStyleTag('plm-extension-base-styles', baseCss)

  const ensureNavPatched = createNavigationPatcher()
  const { closeModal, openModal } = createModalController()

  const runtime: PlmExtPublicRuntime = {
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
