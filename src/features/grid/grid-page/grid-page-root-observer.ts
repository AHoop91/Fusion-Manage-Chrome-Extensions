type GridPageRootObserverListener = () => void

let rootObserver: MutationObserver | null = null
const listeners = new Set<GridPageRootObserverListener>()

function notifyRootObservers(): void {
  for (const listener of listeners) {
    try {
      listener()
    } catch {
      // Keep other grid page root subscribers running if one throws.
    }
  }
}

/**
 * Subscribe to a single shared document root MutationObserver for grid page features.
 * Disconnects when the last subscriber unsubscribes.
 */
export function subscribeGridPageRootObserver(listener: GridPageRootObserverListener): () => void {
  listeners.add(listener)
  if (!rootObserver) {
    rootObserver = new MutationObserver(() => {
      notifyRootObservers()
    })
    rootObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    })
  }

  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && rootObserver) {
      rootObserver.disconnect()
      rootObserver = null
    }
  }
}
