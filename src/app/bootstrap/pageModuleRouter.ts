import type { PlmExtRuntime } from '../../shared/runtime/types'

/** Fired on the page `window` after runtime feature overrides are reloaded from `chrome.storage`. */
export const RUNTIME_FEATURES_CHANGED_EVENT = 'plm-extension-runtime-features-changed'

type RouteScheduler = {
  scheduleApplyRoute: (url: string, options?: { skipUpdates?: boolean }) => void
}

export function attachPageModuleRouterLifecycle(
  runtime: PlmExtRuntime,
  scheduler: RouteScheduler,
  options?: { navEventName?: string; pollIntervalMs?: number }
): void {
  const navEventName = options?.navEventName || 'plm-extension-location-change'
  const pollIntervalMs = Math.max(500, options?.pollIntervalMs || 1500)
  let lastUrl = window.location.href

  function onUrlMaybeChanged(): void {
    const currentUrl = window.location.href
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl
      scheduler.scheduleApplyRoute(lastUrl)
      return
    }
    scheduler.scheduleApplyRoute(lastUrl, { skipUpdates: true })
  }

  function onResume(): void {
    const currentUrl = window.location.href
    lastUrl = currentUrl
    scheduler.scheduleApplyRoute(currentUrl)
  }

  function init(): void {
    try {
      runtime.ensureNavPatched(navEventName)
    } catch {
      // Ignore nav patch failures and keep fallback polling active.
    }

    window.addEventListener(navEventName, onUrlMaybeChanged)
    window.addEventListener('popstate', onUrlMaybeChanged)
    window.addEventListener('pageshow', onResume)
    window.addEventListener('focus', onResume)
    window.addEventListener(RUNTIME_FEATURES_CHANGED_EVENT, () => {
      scheduler.scheduleApplyRoute(window.location.href)
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') onResume()
    })
    scheduler.scheduleApplyRoute(lastUrl)
    window.setInterval(onUrlMaybeChanged, pollIntervalMs)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
    return
  }

  init()
}

export function createRouteScheduler(applyRoute: (url: string, options?: { skipUpdates?: boolean }) => Promise<void>): {
  scheduleApplyRoute: (url: string, options?: { skipUpdates?: boolean }) => void
} {
  let routeApplyInFlight = false
  let queuedApplyRoute: { url: string; skipUpdates: boolean } | null = null

  function scheduleApplyRoute(url: string, options?: { skipUpdates?: boolean }): void {
    const skipUpdates = options?.skipUpdates === true
    if (routeApplyInFlight) {
      const prevSkip = queuedApplyRoute === null ? true : queuedApplyRoute.skipUpdates
      queuedApplyRoute = { url, skipUpdates: prevSkip && skipUpdates }
      return
    }

    routeApplyInFlight = true
    void applyRoute(url, options)
      .catch(() => {})
      .finally(() => {
        routeApplyInFlight = false
        if (!queuedApplyRoute) return
        const next = queuedApplyRoute
        queuedApplyRoute = null
        scheduleApplyRoute(next.url, next.skipUpdates ? { skipUpdates: true } : undefined)
      })
  }

  return { scheduleApplyRoute }
}
