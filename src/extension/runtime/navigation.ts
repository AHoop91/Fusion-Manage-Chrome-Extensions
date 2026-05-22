/**
 * Build a one-time history patcher for a navigation event.
 */
export function createNavigationPatcher(): (eventName: string) => void {
  let patched = false

  return function ensureNavPatched(eventName: string): void {
    if (patched) return
    patched = true

    const originalPushState = history.pushState
    const originalReplaceState = history.replaceState

    history.pushState = function () {
      const result = originalPushState.apply(this, arguments as unknown as Parameters<History['pushState']>)
      window.dispatchEvent(new Event(eventName))
      return result
    }

    history.replaceState = function () {
      const result = originalReplaceState.apply(this, arguments as unknown as Parameters<History['replaceState']>)
      window.dispatchEvent(new Event(eventName))
      return result
    }
  }
}

