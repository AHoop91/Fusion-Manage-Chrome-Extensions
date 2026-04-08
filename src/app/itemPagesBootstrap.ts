import { bootstrapLazyPageModules } from './pageModuleBootstrap'
import { getRuntimeUrl } from '../platform/runtime/extensionInfo'
import { parseItemDetailsContextFromPageUrl } from '../shared/url/parse'

const windowWithBootstrapFlag = window as Window & {
  __plmItemPagesBootstrapStarted?: boolean
}

const ITEM_DETAILS_MODULE_URL = getRuntimeUrl('content/item-pages/item-details.js')
const GRID_MODULE_URL = getRuntimeUrl('content/item-pages/grid.js')
const BOM_MODULE_URL = getRuntimeUrl('content/item-pages/bom.js')
const TABLEAUS_MODULE_URL = getRuntimeUrl('content/item-pages/tableaus.js')

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

if (!windowWithBootstrapFlag.__plmItemPagesBootstrapStarted) {
  windowWithBootstrapFlag.__plmItemPagesBootstrapStarted = true

  bootstrapLazyPageModules({
    contextId: 'content-router',
    loaders: [
      {
        id: 'itemDetails',
        matches(url) {
          return isItemDetailsRoute(url) || isAddItemRoute(url)
        },
        async load(runtime) {
          const module = await import(/* @vite-ignore */ requireModuleUrl(ITEM_DETAILS_MODULE_URL, 'item details'))
          return module.createItemDetailsPageModule(runtime)
        }
      },
      {
        id: 'grid',
        matches: isGridRoute,
        async load(runtime) {
          const module = await import(/* @vite-ignore */ requireModuleUrl(GRID_MODULE_URL, 'grid'))
          return module.createGridPageModule(runtime)
        }
      },
      {
        id: 'bom',
        matches: isBomRoute,
        async load(runtime) {
          const module = await import(/* @vite-ignore */ requireModuleUrl(BOM_MODULE_URL, 'bom'))
          return module.createBomPageModule(runtime)
        }
      },
      {
        id: 'tableaus',
        matches(url) {
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
          const module = await import(/* @vite-ignore */ requireModuleUrl(TABLEAUS_MODULE_URL, 'tableaus'))
          return module.createTableausPageModule(runtime)
        }
      }
    ]
  })
}
