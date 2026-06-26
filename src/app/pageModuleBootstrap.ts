import { resolveContentPlmRuntime } from '../extension/runtime/contentPlmRuntime'
import { attachPageModuleRouterLifecycle, createRouteScheduler, RUNTIME_FEATURES_CHANGED_EVENT } from './bootstrap/pageModuleRouter'
import { BootstrapGuard, type BootstrapContextId } from './bootstrap/bootstrapGuard'
import { FeatureRegistry, type FeatureDefinition } from './bootstrap/featureRegistry'
import type { PageModule, PlmExtRuntime } from '../shared/runtime/types'

export { RUNTIME_FEATURES_CHANGED_EVENT }

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
    const runtime = resolveContentPlmRuntime()
    if (!runtime) return

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

    const { scheduleApplyRoute } = createRouteScheduler((url, options) => registry.applyRoute(url, options))
    attachPageModuleRouterLifecycle(runtime, { scheduleApplyRoute }, {
      navEventName: config.navEventName,
      pollIntervalMs: config.pollIntervalMs
    })
  })()
}

export function bootstrapLazyPageModules(config: LazyBootstrapConfig): void {
  void (async () => {
    const runtime = resolveContentPlmRuntime()
    if (!runtime) return
    const plmRuntime = runtime

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
              const page = await loader.load(plmRuntime)
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

    const { scheduleApplyRoute } = createRouteScheduler(async (url, options) => {
      if (config.prepareRoute) await config.prepareRoute(url, plmRuntime)
      await ensureModulesForUrl(url)
      await registry.applyRoute(url, options)
    })

    attachPageModuleRouterLifecycle(plmRuntime, { scheduleApplyRoute }, {
      navEventName: config.navEventName,
      pollIntervalMs: config.pollIntervalMs
    })
  })()
}
