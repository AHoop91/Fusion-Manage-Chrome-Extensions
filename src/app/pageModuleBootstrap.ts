import { BootstrapGuard } from '../core/health/bootstrapGuard'
import type { BootstrapContextId } from '../core/health/pageHealthConfig'
import { FeatureRegistry, type FeatureDefinition } from '../core/orchestration/featureRegistry'
import { healthTelemetry } from '../core/observability/healthTelemetry'
import { getExtensionVersion } from '../platform/runtime/extensionInfo'
import type { PageModule, PlmExtRuntime } from '../shared/runtime/types'

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
  loaders: LazyModuleLoader[]
}

function isExtensionContextInvalidatedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || '')
  return message.toLowerCase().includes('extension context invalidated')
}

function reportBootstrapError(error: unknown, scope: string): void {
  if (isExtensionContextInvalidatedError(error)) return
  console.error(`[plm-ext] ${scope}`, error)
}

function toFeatureDefinition(page: PageModule): FeatureDefinition {
  return {
    name: page.id,
    requiredSelectors: page.requiredSelectors || [],
    riskLevel: page.riskLevel || 'medium',
    matches: page.matches,
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
    let queuedApplyUrl: string | null = null

    const bootstrap = await BootstrapGuard.initialize({
      contextId: config.contextId,
      initialUrl: lastUrl,
      extensionVersion: getExtensionVersion()
    })

    const registry = new FeatureRegistry({
      domAdapter: bootstrap.domAdapter,
      safeExecutor: bootstrap.safeExecutor,
      telemetry: healthTelemetry,
      extensionVersion: bootstrap.extensionVersion
    })

    for (const page of config.createModules(runtime)) {
      registry.register(toFeatureDefinition(page))
    }

    async function applyRoute(url: string, options?: { skipUpdates?: boolean }): Promise<void> {
      const snapshot = await bootstrap.evaluateUrl(url)
      registry.setHealth(snapshot)
      await registry.applyRoute(url, options)
    }

    function scheduleApplyRoute(url: string, options?: { skipUpdates?: boolean }): void {
      if (routeApplyInFlight) {
        queuedApplyUrl = url
        return
      }

      routeApplyInFlight = true
      void applyRoute(url, options)
        .catch((error) => {
          reportBootstrapError(error, 'page module bootstrap failed')
        })
        .finally(() => {
          routeApplyInFlight = false
          if (!queuedApplyUrl) return
          const nextUrl = queuedApplyUrl
          queuedApplyUrl = null
          scheduleApplyRoute(nextUrl, { skipUpdates: true })
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

    function init(): void {
      try {
        runtime.ensureNavPatched(navEventName)
      } catch {
        // Ignore nav patch failures and keep fallback polling active.
      }

      window.addEventListener(navEventName, onUrlMaybeChanged)
      window.addEventListener('popstate', onUrlMaybeChanged)
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
    let queuedApplyUrl: string | null = null

    const bootstrap = await BootstrapGuard.initialize({
      contextId: config.contextId,
      initialUrl: lastUrl,
      extensionVersion: getExtensionVersion()
    })

    const registry = new FeatureRegistry({
      domAdapter: bootstrap.domAdapter,
      safeExecutor: bootstrap.safeExecutor,
      telemetry: healthTelemetry,
      extensionVersion: bootstrap.extensionVersion
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
              registry.register(toFeatureDefinition(page))
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
      await ensureModulesForUrl(url)
      const snapshot = await bootstrap.evaluateUrl(url)
      registry.setHealth(snapshot)
      await registry.applyRoute(url, options)
    }

    function scheduleApplyRoute(url: string, options?: { skipUpdates?: boolean }): void {
      if (routeApplyInFlight) {
        queuedApplyUrl = url
        return
      }

      routeApplyInFlight = true
      void applyRoute(url, options)
        .catch((error) => {
          reportBootstrapError(error, 'lazy page module bootstrap failed')
        })
        .finally(() => {
          routeApplyInFlight = false
          if (!queuedApplyUrl) return
          const nextUrl = queuedApplyUrl
          queuedApplyUrl = null
          scheduleApplyRoute(nextUrl, { skipUpdates: true })
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

    function init(): void {
      try {
        runtime.ensureNavPatched(navEventName)
      } catch {
        // Ignore nav patch failures and keep fallback polling active.
      }

      window.addEventListener(navEventName, onUrlMaybeChanged)
      window.addEventListener('popstate', onUrlMaybeChanged)
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
