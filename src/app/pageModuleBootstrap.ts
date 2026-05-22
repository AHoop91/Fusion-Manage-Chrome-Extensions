import { BootstrapGuard, type BootstrapContextId } from './bootstrap/bootstrapGuard'
import { FeatureRegistry, type FeatureDefinition } from './bootstrap/featureRegistry'
import type { PageModule, PlmExtRuntime } from '../shared/runtime/types'

/** Fired on the page `window` after runtime feature overrides are reloaded from `chrome.storage` (see item pages bootstrap). */
export const RUNTIME_FEATURES_CHANGED_EVENT = 'plm-extension-runtime-features-changed'

type BootstrapConfig = {
  contextId: BootstrapContextId
  navEventName?: string
  pollIntervalMs?: number
  createModules: (runtime: PlmExtRuntime) => PageModule[]
}

type LazyModuleLoader = {
  id: string
  matches: (url: string) => boolean
  load: (runtime: PlmExtRuntime) => Promise<PageModule>
}

type LazyBootstrapConfig = {
  contextId: BootstrapContextId
  navEventName?: string
  pollIntervalMs?: number
  /** Runs before module matching (e.g. resolve async workspace tier for sync {@link LazyModuleLoader.matches}). */
  prepareRoute?: (url: string, runtime: PlmExtRuntime) => Promise<void>
  loaders: LazyModuleLoader[]
}

function toFeatureDefinition(page: PageModule, matches?: (url: string) => boolean): FeatureDefinition {
  return {
    name: page.id,
    requiredSelectors: page.requiredSelectors || [],
    matches: matches ?? page.matches,
    initialize() {
      page.mount?.({ url: window.location.href })
    },
    update(url) {
      page.update?.({ url })
    },
    teardown() {
      page.unmount?.({ url: window.location.href })
    }
  }
}

export function bootstrapPageModules(config: BootstrapConfig): void {
  void (async () => {
    const runtime = window.__plmExt
    if (!runtime) return

    const navEventName = config.navEventName || 'plm-extension-location-change'
    const pollIntervalMs = Math.max(500, config.pollIntervalMs || 1500)
    let lastUrl = window.location.href
    let routeApplyInFlight = false
    let queuedApplyRoute: { url: string; skipUpdates: boolean } | null = null

    const bootstrap = await BootstrapGuard.initialize({
      contextId: config.contextId
    })

    const registry = new FeatureRegistry({
      domAdapter: bootstrap.domAdapter,
      safeExecutor: bootstrap.safeExecutor
    })

    for (const page of config.createModules(runtime)) {
      registry.register(toFeatureDefinition(page))
    }

    async function applyRoute(url: string, options?: { skipUpdates?: boolean }): Promise<void> {
      await registry.applyRoute(url, options)
    }

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

    function onUrlMaybeChanged(): void {
      const currentUrl = window.location.href
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl
        scheduleApplyRoute(lastUrl)
        return
      }
      scheduleApplyRoute(lastUrl, { skipUpdates: true })
    }

    function onResume(): void {
      const currentUrl = window.location.href
      lastUrl = currentUrl
      scheduleApplyRoute(currentUrl)
    }

    function onRuntimeFeaturesChanged(): void {
      scheduleApplyRoute(window.location.href)
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
      window.addEventListener(RUNTIME_FEATURES_CHANGED_EVENT, onRuntimeFeaturesChanged)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') onResume()
      })
      scheduleApplyRoute(lastUrl)
      window.setInterval(onUrlMaybeChanged, pollIntervalMs)
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true })
      return
    }

    init()
  })()
}

export function bootstrapLazyPageModules(config: LazyBootstrapConfig): void {
  void (async () => {
    const runtime = window.__plmExt
    if (!runtime) return

    const navEventName = config.navEventName || 'plm-extension-location-change'
    const pollIntervalMs = Math.max(500, config.pollIntervalMs || 1500)
    let lastUrl = window.location.href
    let routeApplyInFlight = false
    let queuedApplyRoute: { url: string; skipUpdates: boolean } | null = null

    const bootstrap = await BootstrapGuard.initialize({
      contextId: config.contextId
    })

    const registry = new FeatureRegistry({
      domAdapter: bootstrap.domAdapter,
      safeExecutor: bootstrap.safeExecutor
    })

    const loadedModuleIds = new Set<string>()
    const moduleLoadInFlightById = new Map<string, Promise<void>>()

    async function ensureModulesForUrl(url: string): Promise<void> {
      const matches = config.loaders.filter((loader) => loader.matches(url) && !loadedModuleIds.has(loader.id))
      if (matches.length === 0) return

      await Promise.all(
        matches.map(async (loader) => {
          const existing = moduleLoadInFlightById.get(loader.id)
          if (existing) return existing

          const run = (async (): Promise<void> => {
            try {
              const page = await loader.load(runtime)
              registry.register(
                toFeatureDefinition(page, (url) => loader.matches(url))
              )
              loadedModuleIds.add(loader.id)
            } finally {
              moduleLoadInFlightById.delete(loader.id)
            }
          })()

          moduleLoadInFlightById.set(loader.id, run)
          return run
        })
      )
    }

    async function applyRoute(url: string, options?: { skipUpdates?: boolean }): Promise<void> {
      if (config.prepareRoute) await config.prepareRoute(url, runtime)
      await ensureModulesForUrl(url)
      await registry.applyRoute(url, options)
    }

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

    function onUrlMaybeChanged(): void {
      const currentUrl = window.location.href
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl
        scheduleApplyRoute(lastUrl)
        return
      }
      scheduleApplyRoute(lastUrl, { skipUpdates: true })
    }

    function onResume(): void {
      const currentUrl = window.location.href
      lastUrl = currentUrl
      scheduleApplyRoute(currentUrl)
    }

    function onRuntimeFeaturesChanged(): void {
      scheduleApplyRoute(window.location.href)
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
      window.addEventListener(RUNTIME_FEATURES_CHANGED_EVENT, onRuntimeFeaturesChanged)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') onResume()
      })
      scheduleApplyRoute(lastUrl)
      window.setInterval(onUrlMaybeChanged, pollIntervalMs)
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true })
      return
    }

    init()
  })()
}
