import { FEATURES, isBomPageFeatureEnabled, isGridPageFeatureEnabled } from '../build/featureFlags'
import { getEffectiveFeatures } from '../extension/runtime/effectiveFeatures'
import {
  initRuntimeFeaturesFromStorage,
  subscribeToRuntimeFeatureChanges
} from '../extension/runtime/runtimeFeatureStorage'
import { bootstrapLazyPageModules, RUNTIME_FEATURES_CHANGED_EVENT } from './pageModuleBootstrap'
import { getRuntimeUrl } from '../extension/runtime/extensionInfo'
import { matchesCwComponentsItemChromeRoute, parseItemDetailsContextFromPageUrl } from '../shared/url/parse'
import type { PageModule, PlmExtRuntime } from '../shared/runtime/types'
import { isCwComponentsWorkspaceForUrl, prepareWorkspaceTierForUrl, shouldLoadLazyModule } from './workspace/workspaceTierGate'

const windowWithBootstrapFlag = window as Window & {
  __plmItemPagesBootstrapStarted?: boolean
}

function requireModuleUrl(moduleUrl: string | null, moduleName: string): string {
  if (moduleUrl) return moduleUrl
  throw new Error(`Extension context unavailable while resolving ${moduleName} module URL`)
}

function isItemDetailsRoute(urlString: string): boolean {
  return parseItemDetailsContextFromPageUrl(urlString) !== null
}

function isAddItemRoute(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    if (!/^\/plm\/workspaces\/\d+\/items\/additem$/i.test(url.pathname)) return false
    const view = String(url.searchParams.get('view') || '').toLowerCase()
    return view === 'split' || view === 'full'
  } catch {
    return false
  }
}

function isGridRoute(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    return /^\/plm\/workspaces\/\d+\/items\/grid$/i.test(url.pathname)
  } catch {
    return false
  }
}

function isBomRoute(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    return /^\/plm\/workspaces\/\d+\/items\/bom\/nested$/i.test(url.pathname)
  } catch {
    return false
  }
}

type ItemPageLoader = {
  id: string
  matches: (url: string) => boolean
  load: (runtime: PlmExtRuntime) => Promise<PageModule>
}

function buildItemPageLoaders(): ItemPageLoader[] {
  const loaders: ItemPageLoader[] = []
  const build = FEATURES

  if (build.enableItemDetails) {
    loaders.push({
      id: 'itemDetails',
      matches(url) {
        return (
          getEffectiveFeatures().enableItemDetails &&
          shouldLoadLazyModule('itemDetails', url) &&
          (isItemDetailsRoute(url) || isAddItemRoute(url))
        )
      },
      async load(runtime) {
        const url = getRuntimeUrl('content/item-pages/item-details.js')
        const module = await import(/* @vite-ignore */ requireModuleUrl(url, 'item details'))
        return module.createItemDetailsPageModule(runtime)
      }
    })
  }

  if (isGridPageFeatureEnabled(build)) {
    loaders.push({
      id: 'grid',
      matches(url) {
        return (
          isGridPageFeatureEnabled(getEffectiveFeatures()) &&
          shouldLoadLazyModule('grid', url) &&
          isGridRoute(url)
        )
      },
      async load(runtime) {
        const url = getRuntimeUrl('content/item-pages/grid.js')
        const module = await import(/* @vite-ignore */ requireModuleUrl(url, 'grid'))
        return module.createGridPageModule(runtime)
      }
    })
  }

  if (isBomPageFeatureEnabled(build)) {
    loaders.push({
      id: 'bom',
      matches(url) {
        return (
          isBomPageFeatureEnabled(getEffectiveFeatures()) &&
          shouldLoadLazyModule('bom', url) &&
          isBomRoute(url)
        )
      },
      async load(runtime) {
        const url = getRuntimeUrl('content/item-pages/bom.js')
        const module = await import(/* @vite-ignore */ requireModuleUrl(url, 'bom'))
        return module.createBomPageModule(runtime)
      }
    })
  }

  if (build.enableTableaus) {
    loaders.push({
      id: 'tableaus',
      matches(url) {
        if (!getEffectiveFeatures().enableTableaus) return false
        if (!shouldLoadLazyModule('tableaus', url)) return false
        try {
          const parsed = new URL(url)
          if (!parsed.hostname.toLowerCase().endsWith('.autodeskplm360.net')) return false
          if (/^\/plm\/workspaces\/\d+\/items$/i.test(parsed.pathname)) return true
          if (/^\/plm\/workspaces\/\d+\/items\/itemDetails$/i.test(parsed.pathname)) {
            return parsed.searchParams.get('view')?.toLowerCase() === 'split'
          }
          return false
        } catch {
          return false
        }
      },
      async load(runtime) {
        const url = getRuntimeUrl('content/item-pages/tableaus.js')
        const module = await import(/* @vite-ignore */ requireModuleUrl(url, 'tableaus'))
        return module.createTableausPageModule(runtime)
      }
    })
  }

  if (build.enableDesignComponents) {
    loaders.push({
      id: 'designComponents',
      matches(url) {
        return (
          getEffectiveFeatures().enableDesignComponents &&
          shouldLoadLazyModule('designComponents', url) &&
          matchesCwComponentsItemChromeRoute(url) &&
          isCwComponentsWorkspaceForUrl(url)
        )
      },
      async load(runtime) {
        const url = getRuntimeUrl('content/item-pages/design-components.js')
        const module = await import(/* @vite-ignore */ requireModuleUrl(url, 'design components'))
        return module.createDesignComponentsPageModule(runtime)
      }
    })
  }

  return loaders
}

function attachRuntimeOverridesListener(): void {
  subscribeToRuntimeFeatureChanges(() => {
    void initRuntimeFeaturesFromStorage().then(() => {
      window.dispatchEvent(new Event(RUNTIME_FEATURES_CHANGED_EVENT))
    })
  })
}

async function startItemPagesBootstrap(): Promise<void> {
  await initRuntimeFeaturesFromStorage()
  attachRuntimeOverridesListener()

  bootstrapLazyPageModules({
    contextId: 'content-router',
    prepareRoute(url, runtime) {
      return prepareWorkspaceTierForUrl(runtime, url)
    },
    loaders: buildItemPageLoaders()
  })
}

if (!windowWithBootstrapFlag.__plmItemPagesBootstrapStarted) {
  windowWithBootstrapFlag.__plmItemPagesBootstrapStarted = true
  void startItemPagesBootstrap()
}
