import { COMMAND_BAR_LINKED_ITEMS_MENU_ID } from '../item-details.constants'
import type { ItemDetailsRuntime } from '../item-details.types'
import {
  getCachedItemDetails,
  getCachedWorkspaceTitle,
  getCurrentItemContextFromLocation,
  getTenantFromLocation,
  loadItemDetails,
  loadWorkspaceTitleMap
} from '../services/item-details.data-cache.service'

type LinkedItemsMenuController = {
  close: () => void
  open: (anchor: HTMLElement) => Promise<void>
}

type LinkedItemOption = {
  href: string
  workspaceId: number
  workspaceName: string
  fieldName: string
  title: string
}

type LinkedItemsMenuDeps = {
  ext: ItemDetailsRuntime
}

type ItemContext = {
  workspaceId: number
  dmsId: number
}

type LinkedItemsCacheEntry = {
  items: LinkedItemOption[]
  timestamp: number
}

const ITEM_PATH_RE = /^\/api\/v3\/workspaces\/(\d+)\/items\/(\d+)$/i
const LINKED_ITEMS_CACHE_TTL_MS = 45_000
const LINKED_ITEMS_CACHE_MAX_ENTRIES = 80

export function createLinkedItemsMenuController({ ext }: LinkedItemsMenuDeps): LinkedItemsMenuController {
  let outsideClickHandler: ((event: Event) => void) | null = null
  let outsideClickAttachTimer: number | null = null
  const linkedItemsCache = new Map<string, LinkedItemsCacheEntry>()

  function stopOutsideClickListener(): void {
    if (outsideClickAttachTimer !== null) {
      window.clearTimeout(outsideClickAttachTimer)
      outsideClickAttachTimer = null
    }

    if (!outsideClickHandler) return
    document.removeEventListener('click', outsideClickHandler, true)
    outsideClickHandler = null
  }

  function close(): void {
    stopOutsideClickListener()
    const menu = document.getElementById(COMMAND_BAR_LINKED_ITEMS_MENU_ID)
    if (menu) menu.remove()
  }

  function toWorkspaceAndItemId(path: string): { workspaceId: number; dmsId: number } | null {
    let normalizedPath = path
    if (/^https?:\/\//i.test(path)) {
      try {
        normalizedPath = new URL(path).pathname
      } catch {
        return null
      }
    }

    const match = ITEM_PATH_RE.exec(normalizedPath)
    if (!match) return null
    const workspaceId = Number.parseInt(match[1], 10)
    const dmsId = Number.parseInt(match[2], 10)
    if (!Number.isFinite(workspaceId) || !Number.isFinite(dmsId)) return null
    return { workspaceId, dmsId }
  }

  function buildItemDetailsHref(tenant: string, workspaceId: number, dmsId: number): string {
    const itemId = encodeURIComponent(`urn\`adsk,plm\`tenant,workspace,item\`${tenant.toUpperCase()},${workspaceId},${dmsId}`)
    return `${window.location.origin}/plm/workspaces/${workspaceId}/items/itemDetails?view=full&tab=details&mode=view&itemId=${itemId}`
  }

  function toContextCacheKey(tenant: string, context: ItemContext): string {
    return `${tenant.toLowerCase()}:${context.workspaceId}:${context.dmsId}`
  }

  function cloneLinkedItems(linkedItems: LinkedItemOption[]): LinkedItemOption[] {
    return linkedItems.map((item) => ({ ...item }))
  }

  function getCachedLinkedItems(cacheKey: string): LinkedItemOption[] | null {
    const entry = linkedItemsCache.get(cacheKey)
    if (!entry) return null
    if (Date.now() - entry.timestamp > LINKED_ITEMS_CACHE_TTL_MS) {
      linkedItemsCache.delete(cacheKey)
      return null
    }
    return cloneLinkedItems(entry.items)
  }

  function setCachedLinkedItems(cacheKey: string, linkedItems: LinkedItemOption[]): void {
    linkedItemsCache.set(cacheKey, {
      items: cloneLinkedItems(linkedItems),
      timestamp: Date.now()
    })
    if (linkedItemsCache.size <= LINKED_ITEMS_CACHE_MAX_ENTRIES) return
    const oldestKey = linkedItemsCache.keys().next().value
    if (oldestKey) linkedItemsCache.delete(oldestKey)
  }

  function sortLinkedItems(linkedItems: LinkedItemOption[]): LinkedItemOption[] {
    linkedItems.sort((a, b) => {
      const workspaceCmp = a.workspaceName.localeCompare(b.workspaceName, undefined, { numeric: true })
      if (workspaceCmp !== 0) return workspaceCmp
      const fieldCmp = a.fieldName.localeCompare(b.fieldName, undefined, { numeric: true })
      if (fieldCmp !== 0) return fieldCmp
      return a.title.localeCompare(b.title, undefined, { numeric: true })
    })
    return linkedItems
  }

  function collectLinkedValueNodes(value: unknown): Array<Record<string, unknown>> {
    if (!value) return []
    if (Array.isArray(value)) {
      return value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    }
    if (typeof value !== 'object') return []
    const record = value as Record<string, unknown>
    const items = Array.isArray(record.items) ? record.items : null
    if (items) {
      return items.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    }
    return [record]
  }

  function extractLinkedItemsFromItemDetailsData(data: unknown, tenant: string): LinkedItemOption[] {
    const record = data as Record<string, unknown>
    if (!record || typeof record !== 'object') return []

    const currentSelf = typeof record.__self__ === 'string' ? record.__self__ : ''
    const sections = Array.isArray(record.sections) ? (record.sections as unknown[]) : []
    const seen = new Set<string>()
    const linkedItems: LinkedItemOption[] = []

    for (const sectionNode of sections) {
      if (!sectionNode || typeof sectionNode !== 'object') continue
      const section = sectionNode as Record<string, unknown>
      const fields = Array.isArray(section.fields) ? (section.fields as unknown[]) : []

      for (const fieldNode of fields) {
        if (!fieldNode || typeof fieldNode !== 'object') continue
        const field = fieldNode as Record<string, unknown>
        const fieldName =
          (typeof field.title === 'string' && field.title.trim()) ||
          (typeof field.name === 'string' && field.name.trim()) ||
          'Field'

        const values = collectLinkedValueNodes(field.value)
        if (values.length === 0) continue

        for (const value of values) {
          const link = typeof value.link === 'string' ? value.link : ''
          if (!link) continue
          if (currentSelf && link === currentSelf) continue

          const ids = toWorkspaceAndItemId(link)
          if (!ids) continue

          const href = buildItemDetailsHref(tenant, ids.workspaceId, ids.dmsId)
          const dedupeKey = `${fieldName}|${href}`
          if (seen.has(dedupeKey)) continue
          seen.add(dedupeKey)

          const linkedTitle =
            (typeof value.title === 'string' && value.title.trim()) ||
            (typeof value.name === 'string' && value.name.trim()) ||
            `Item ${ids.dmsId}`

          linkedItems.push({
            href,
            workspaceId: ids.workspaceId,
            workspaceName: getCachedWorkspaceTitle(tenant, ids.workspaceId) || String(ids.workspaceId),
            fieldName,
            title: linkedTitle
          })
        }
      }
    }

    return sortLinkedItems(linkedItems)
  }

  async function resolveWorkspaceNames(tenant: string, linkedItems: LinkedItemOption[]): Promise<LinkedItemOption[]> {
    if (linkedItems.length === 0) return linkedItems

    const unresolved = linkedItems.some((item) => item.workspaceName === String(item.workspaceId))
    if (!unresolved) return sortLinkedItems(linkedItems)

    const map = await loadWorkspaceTitleMap(ext, tenant)
    if (map.size === 0) return sortLinkedItems(linkedItems)

    const next = linkedItems.map((item) => ({
      ...item,
      workspaceName: getCachedWorkspaceTitle(tenant, item.workspaceId) || map.get(item.workspaceId) || item.workspaceName
    }))

    return sortLinkedItems(next)
  }

  async function loadLinkedItems(tenant: string, context: ItemContext): Promise<LinkedItemOption[]> {
    const fetched = await loadItemDetails(ext, tenant, context)
    if (!fetched) return []
    const fromApi = extractLinkedItemsFromItemDetailsData(fetched, tenant)
    return resolveWorkspaceNames(tenant, fromApi)
  }

  function navigateToHref(href: string): void {
    if (!href) return
    window.location.href = href
  }

  function renderRows(tbody: HTMLElement, linkedItems: LinkedItemOption[]): void {
    tbody.innerHTML = ''
    if (linkedItems.length === 0) {
      const emptyRow = document.createElement('tr')
      const emptyCell = document.createElement('td')
      emptyCell.colSpan = 4
      emptyCell.textContent = 'No linked items found.'
      emptyCell.style.cssText = 'padding:12px 10px;color:#64748b;'
      emptyRow.appendChild(emptyCell)
      tbody.appendChild(emptyRow)
      return
    }

    for (const item of linkedItems) {
      const row = document.createElement('tr')

      const workspaceCell = document.createElement('td')
      workspaceCell.textContent = item.workspaceName
      workspaceCell.style.cssText =
        'padding:8px 10px;border-bottom:1px solid #eef2f7;vertical-align:middle;white-space:normal;text-align:left;word-break:break-word;'

      const fieldCell = document.createElement('td')
      fieldCell.textContent = item.fieldName
      fieldCell.style.cssText =
        'padding:8px 10px;border-bottom:1px solid #eef2f7;vertical-align:middle;white-space:normal;text-align:left;word-break:break-word;'

      const titleCell = document.createElement('td')
      titleCell.textContent = item.title
      titleCell.title = item.href
      titleCell.style.cssText =
        'padding:8px 10px;border-bottom:1px solid #eef2f7;vertical-align:middle;word-break:break-word;text-align:left;'

      const actionCell = document.createElement('td')
      actionCell.style.cssText =
        'padding:8px 8px;border-bottom:1px solid #eef2f7;vertical-align:middle;white-space:nowrap;text-align:center;width:1%;'

      const actionButton = document.createElement('button')
      actionButton.type = 'button'
      actionButton.textContent = 'Open'
      actionButton.style.cssText = [
        'display:inline-flex',
        'align-items:center',
        'justify-content:center',
        'width:56px',
        'height:22px',
        'padding:0',
        'border:1px solid rgb(6, 150, 215)',
        'border-radius:5px',
        'background:rgb(6, 150, 215)',
        'color:#ffffff',
        "font:600 12px/1.2 'Segoe UI',Arial,sans-serif",
        'text-decoration:none',
        'white-space:nowrap',
        'box-sizing:border-box',
        'cursor:pointer'
      ].join(';')
      actionButton.addEventListener('click', () => {
        navigateToHref(item.href)
      })

      actionCell.appendChild(actionButton)
      row.appendChild(workspaceCell)
      row.appendChild(fieldCell)
      row.appendChild(titleCell)
      row.appendChild(actionCell)
      tbody.appendChild(row)
    }
  }

  async function open(anchor: HTMLElement): Promise<void> {
    close()
    const menu = document.createElement('div')
    menu.id = COMMAND_BAR_LINKED_ITEMS_MENU_ID
    menu.style.cssText = [
      'position:absolute',
      'top:calc(100% + 8px)',
      'right:0',
      'width:760px',
      'max-width:calc(100vw - 40px)',
      'background:#ffffff',
      'border:1px solid #cfd8e6',
      'border-radius:14px',
      'box-shadow:0 14px 30px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.06)',
      'padding:16px',
      'z-index:2147483647'
    ].join(';')

    const title = document.createElement('div')
    title.style.cssText = "font:700 17px/1.2 'Segoe UI',Arial,sans-serif;color:#0f172a;margin:0 0 4px;"
    const titleLabel = document.createElement('span')
    titleLabel.textContent = 'Linked Items'
    const titleDescription = document.createElement('span')
    titleDescription.textContent = ' - Quick navigation links to related items across connected workspaces.'
    titleDescription.style.cssText = "color:#64748b;font:500 12px/1.4 'Segoe UI',Arial,sans-serif;"
    title.appendChild(titleLabel)
    title.appendChild(titleDescription)

    const subtitle = document.createElement('div')
    subtitle.textContent = ''
    subtitle.style.cssText = "font:600 12px/1.4 'Segoe UI',Arial,sans-serif;color:#64748b;margin:0 0 12px;"

    const tableWrap = document.createElement('div')
    tableWrap.style.cssText = [
      'position:relative',
      'max-height:320px',
      'overflow-y:auto',
      'overflow-x:auto',
      'border:1px solid #dbe2ee',
      'border-radius:10px',
      'background:#ffffff'
    ].join(';')

    const table = document.createElement('table')
    table.style.cssText = [
      'width:100%',
      'border-collapse:separate',
      'border-spacing:0',
      "font:500 12px/1.4 'Segoe UI',Arial,sans-serif",
      'color:#0f172a'
    ].join(';')

    const thead = document.createElement('thead')
    thead.style.cssText = 'position:sticky;top:0;z-index:3;background:#f8fafc;'
    const headerRow = document.createElement('tr')
    headerRow.style.cssText = 'background:#f8fafc;'

    const workspaceHeader = document.createElement('th')
    workspaceHeader.textContent = 'Workspace Name'
    workspaceHeader.style.cssText =
      'position:sticky;top:0;z-index:4;background:#f8fafc;padding:8px 10px;text-align:left;border-bottom:1px solid #dbe2ee;vertical-align:middle;width:25%;'

    const fieldHeader = document.createElement('th')
    fieldHeader.textContent = 'Field Name'
    fieldHeader.style.cssText =
      'position:sticky;top:0;z-index:4;background:#f8fafc;padding:8px 10px;text-align:left;border-bottom:1px solid #dbe2ee;vertical-align:middle;width:23%;'

    const titleHeader = document.createElement('th')
    titleHeader.textContent = 'Title'
    titleHeader.style.cssText =
      'position:sticky;top:0;z-index:4;background:#f8fafc;padding:8px 10px;text-align:left;border-bottom:1px solid #dbe2ee;vertical-align:middle;'

    const actionHeader = document.createElement('th')
    actionHeader.textContent = 'Action'
    actionHeader.style.cssText =
      'position:sticky;top:0;z-index:4;background:#f8fafc;padding:8px 8px;text-align:center;border-bottom:1px solid #dbe2ee;white-space:nowrap;vertical-align:middle;width:1%;'

    headerRow.appendChild(workspaceHeader)
    headerRow.appendChild(fieldHeader)
    headerRow.appendChild(titleHeader)
    headerRow.appendChild(actionHeader)
    thead.appendChild(headerRow)

    const tbody = document.createElement('tbody')

    table.appendChild(thead)
    table.appendChild(tbody)
    tableWrap.appendChild(table)
    menu.appendChild(title)
    menu.appendChild(subtitle)
    menu.appendChild(tableWrap)
    anchor.appendChild(menu)

    const tenant = getTenantFromLocation(window.location.href)
    const context = getCurrentItemContextFromLocation(window.location.href)
    if (!tenant || !context) {
      subtitle.textContent = 'No linked items found'
      renderRows(tbody, [])
      return
    }

    const cacheKey = toContextCacheKey(tenant, context)
    const cachedItems = getCachedLinkedItems(cacheKey)
    if (cachedItems) {
      subtitle.textContent = cachedItems.length > 0 ? `${cachedItems.length} linked item(s)` : 'No linked items found'
      renderRows(tbody, cachedItems)
    } else {
      const immediateItemData = getCachedItemDetails(tenant, context)
      const immediateItems = immediateItemData ? extractLinkedItemsFromItemDetailsData(immediateItemData, tenant) : []
      if (immediateItems.length > 0) {
        subtitle.textContent = `${immediateItems.length} linked item(s)`
        renderRows(tbody, immediateItems)
      } else {
        subtitle.textContent = 'Loading linked items...'
        const loadingRow = document.createElement('tr')
        const loadingCell = document.createElement('td')
        loadingCell.colSpan = 4
        loadingCell.textContent = 'Loading...'
        loadingCell.style.cssText = 'padding:12px 10px;color:#64748b;'
        loadingRow.appendChild(loadingCell)
        tbody.appendChild(loadingRow)
      }
    }

    void (async () => {
      const linkedItems = await loadLinkedItems(tenant, context)
      if (!menu.isConnected) return
      setCachedLinkedItems(cacheKey, linkedItems)
      subtitle.textContent = linkedItems.length > 0 ? `${linkedItems.length} linked item(s)` : 'No linked items found'
      renderRows(tbody, linkedItems)
    })()

    outsideClickAttachTimer = window.setTimeout(() => {
      outsideClickAttachTimer = null
      outsideClickHandler = (event: Event) => {
        const target = event.target as Node | null
        if (target && !anchor.contains(target)) close()
      }
      document.addEventListener('click', outsideClickHandler, true)
    }, 0)
  }

  return { close, open }
}
