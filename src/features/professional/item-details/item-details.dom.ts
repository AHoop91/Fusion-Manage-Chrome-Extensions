import { LOADING_PROGRESS_RING_SELECTOR } from './item-details.constants'

export type ItemDetailsDomAdapter = {
  isWrapperLoading: () => boolean
  observeWrapperLoading: (onChange: (loading: boolean) => void) => () => void
}

export function createItemDetailsDom(): ItemDetailsDomAdapter {
  function isWrapperLoading(): boolean {
    return document.querySelector(LOADING_PROGRESS_RING_SELECTOR) !== null
  }

  function observeWrapperLoading(onChange: (loading: boolean) => void): () => void {
    let previousLoadingState = isWrapperLoading()

    const observer = new MutationObserver(() => {
      const nextLoadingState = isWrapperLoading()
      if (nextLoadingState === previousLoadingState) return
      previousLoadingState = nextLoadingState
      onChange(nextLoadingState)
    })

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }

  return {
    isWrapperLoading,
    observeWrapperLoading
  }
}
