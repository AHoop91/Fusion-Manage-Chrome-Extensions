/**
 * Item Details page orchestrator.
 *
 * Responsibilities:
 * - Delegate page matching and mode resolution to the feature service
 * - Coordinate loading-state aware UI injection through the DOM adapter
 * - Compose subfeatures and hand active-mode application to the root view
 */
import { createItemDetailsDom } from './item-details.dom'
import { createHiddenSectionsFeature } from './hiddenSections'
import { createHideEmptyFeature } from './hideEmpty'
import { createItemDetailsState } from './item-details.state'
import type { ItemDetailsController, ItemDetailsRuntime } from './item-details.types'
import { createOptionsButtonFeature } from './options/feature'
import { createRequiredOnlyFeature } from './requiredOnly'
import { createItemDetailsService } from './services/item-details.service'
import { createItemDetailsView } from './view/item-details.view'

export function createItemDetailsController(ext: ItemDetailsRuntime): ItemDetailsController {
  const service = createItemDetailsService(ext)
  const dom = createItemDetailsDom()
  const state = createItemDetailsState(service.resolveOptionsMode(window.location.href))

  const hideEmpty = createHideEmptyFeature(ext)
  const hiddenSections = createHiddenSectionsFeature(ext)
  const requiredOnly = createRequiredOnlyFeature(ext)
  const view = createItemDetailsView({
    hideEmpty,
    hiddenSections,
    requiredOnly
  })
  const optionsButton = createOptionsButtonFeature({
    ext,
    isPageSupported: service.matches,
    isLoading: dom.isWrapperLoading,
    getOptionsMode: () => state.getSnapshot().optionsMode,
    suspendSearchOverrides: () => {
      if (state.getSnapshot().optionsMode !== 'view') return
      hideEmpty.suspendForSearch()
      hiddenSections.suspendForSearch()
    },
    resumeSearchOverrides: () => {
      if (state.getSnapshot().optionsMode !== 'view') return
      hideEmpty.resumeFromSearch()
      hiddenSections.resumeFromSearch()
    },
    isHideEmptyEnabled: hideEmpty.isEnabled,
    setHideEmptyEnabled: hideEmpty.setEnabled,
    isRequiredOnlyEnabled: requiredOnly.isEnabled,
    setRequiredOnlyEnabled: requiredOnly.setEnabled,
    openSectionsModal: hiddenSections.openSectionsModal
  })
  let stopWrapperLoadingObservation: (() => void) | null = null

  function setOptionsModeFromUrl(url: string): void {
    const nextMode = service.resolveOptionsMode(url)
    if (nextMode === state.getSnapshot().optionsMode) return

    state.setOptionsMode(nextMode)
    optionsButton.closeOptionsMenu()
  }

  function stopWrapperLoadingObserver(): void {
    if (!stopWrapperLoadingObservation) return
    stopWrapperLoadingObservation()
    stopWrapperLoadingObservation = null
  }

  /**
   * Watch host loading transitions so extension UI does not flicker while
   * Autodesk re-renders the item details page.
   */
  function ensureWrapperLoadingObserver(): void {
    if (stopWrapperLoadingObservation) return

    stopWrapperLoadingObservation = dom.observeWrapperLoading((loading) => {
      optionsButton.scheduleVisibility(loading)
      view.render(state.getSnapshot(), { loading })
    })
  }

  function syncPageState(url: string): void {
    setOptionsModeFromUrl(url)
    ensureWrapperLoadingObserver()
    optionsButton.ensurePresenceObserver(url)
    const loading = dom.isWrapperLoading()
    optionsButton.scheduleVisibility(loading)
    view.render(state.getSnapshot(), { loading })
  }

  function cleanup(): void {
    stopWrapperLoadingObserver()
    optionsButton.cleanup()
    hideEmpty.cleanup()
    hiddenSections.cleanup()
    requiredOnly.cleanup()
    state.reset()
  }

  return {
    matches(url) {
      return service.matches(url)
    },
    mount({ url }) {
      syncPageState(url)
    },
    update({ url }) {
      syncPageState(url)
    },
    unmount() {
      cleanup()
    }
  }
}
