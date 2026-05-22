import type { TableausApi } from '../services/tableaus.api'

const FLYOUT_SELECTOR = '.views-switcher-flyout__panel-container'
const IMPORT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
const EXPORT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
const MANAGE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'
const HEADER_SELECTOR = '.views-switcher-content--header'
const INJECT_MARKER = 'data-plm-ext-tableaus'

export type TableausViewDeps = {
  api: TableausApi
  getWsId: () => string | null
  getActiveTableauId: () => string | null
}

export type TableausView = {
  mount: () => void
  update: () => void
  unmount: () => void
}

export function createTableausView(deps: TableausViewDeps): TableausView {
  let observer: MutationObserver | null = null
  let exportPanel: { remove: () => void } | null = null
  let importDialog: { remove: () => void } | null = null
  let manageDialog: { remove: () => void } | null = null
  let fileInput: HTMLInputElement | null = null

  function getHeader(): HTMLElement | null {
    return document.querySelector<HTMLElement>(HEADER_SELECTOR)
  }

  function isInjected(): boolean {
    return !!document.querySelector(`[${INJECT_MARKER}]`)
  }

  let menuEl: HTMLElement | null = null
  let menuTrigger: HTMLElement | null = null

  function createMenuTrigger(): HTMLElement {
    const wrapper = document.createElement('div')
    wrapper.className = 'views-switcher-btn-wrapper'

    const inner = document.createElement('div')
    inner.className = 'weave-button-wrapper'

    const button = document.createElement('button')
    button.className =
      'MuiButtonBase-root MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeMedium MuiButton-textSizeMedium MuiButton-colorPrimary css-1f19ir3'
    button.type = 'button'
    button.setAttribute('aria-label', 'Views options')
    button.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:24px;height:30px;min-width:0;padding:0;margin-left:5px;background:#f3f3f3;border-radius:4px;line-height:0;'

    // Feather-style settings gear icon
    button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="display:block;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'

    button.addEventListener('click', onTriggerClick)

    inner.appendChild(button)
    wrapper.appendChild(inner)
    menuTrigger = button
    return wrapper
  }

  function createMenu(onExport: () => void, onImport: () => void, onManage: () => void): HTMLElement {
    const menu = document.createElement('div')
    menu.setAttribute('role', 'menu')
    menu.style.cssText = [
      'position:fixed',
      'z-index:9999',
      'background:#fff',
      'border:1px solid #ccc',
      'border-radius:4px',
      'box-shadow:0 2px 8px rgba(0,0,0,0.15)',
      'padding:4px 0',
      'min-width:160px',
      'font-size:13px'
    ].join(';')

    function createItem(icon: string, label: string, onClick: () => void): HTMLElement {
      const item = document.createElement('button')
      item.type = 'button'
      item.setAttribute('role', 'menuitem')
      item.style.cssText = [
        'display:flex',
        'align-items:center',
        'gap:8px',
        'width:100%',
        'text-align:left',
        'padding:8px 16px',
        'border:none',
        'background:none',
        'cursor:pointer',
        'font-size:13px',
        'color:#333'
      ].join(';')
      const iconEl = document.createElement('span')
      iconEl.innerHTML = icon
      const labelEl = document.createElement('span')
      labelEl.textContent = label
      item.appendChild(iconEl)
      item.appendChild(labelEl)
      item.addEventListener('mouseover', () => { item.style.background = '#f5f5f5' })
      item.addEventListener('mouseout', () => { item.style.background = 'none' })
      item.addEventListener('click', () => { closeMenu(); onClick() })
      return item
    }

    menu.appendChild(createItem(MANAGE_ICON, 'Manage Views', onManage))
    menu.appendChild(createItem(IMPORT_ICON, 'Import Views', onImport))
    menu.appendChild(createItem(EXPORT_ICON, 'Export Views', onExport))
    return menu
  }

  function positionMenu(menu: HTMLElement): void {
    if (!menuTrigger) return
    const rect = menuTrigger.getBoundingClientRect()
    menu.style.top = `${rect.bottom + 4}px`
    menu.style.left = `${rect.left}px`
  }

  function closeMenu(): void {
    menuEl?.remove()
    menuEl = null
    document.removeEventListener('click', onMenuOutsideClick, true)
    if (menuTrigger) {
      menuTrigger.style.background = '#f3f3f3'
      menuTrigger.style.color = ''
    }
  }

  function onMenuOutsideClick(event: MouseEvent): void {
    if (menuEl && !menuEl.contains(event.target as Node) && !menuTrigger?.contains(event.target as Node)) {
      closeMenu()
    }
  }

  function onTriggerClick(event: MouseEvent): void {
    event.stopPropagation()
    if (menuEl) { closeMenu(); return }
    const wsId = deps.getWsId()
    const activeId = deps.getActiveTableauId()
    if (!wsId) return

    if (menuTrigger) {
      menuTrigger.style.background = '#0696d7'
      menuTrigger.style.color = '#fff'
    }

    menuEl = createMenu(
      () => onExportClick(wsId, activeId),
      () => ensureFileInput().click(),
      () => onManageClick(wsId)
    )
    document.body.appendChild(menuEl)
    positionMenu(menuEl)
    window.setTimeout(() => {
      document.addEventListener('click', onMenuOutsideClick, true)
    }, 0)
  }

  function ensureFileInput(): HTMLInputElement {
    if (fileInput) return fileInput
    fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.plmview'
    fileInput.style.display = 'none'
    fileInput.addEventListener('change', onFileSelected)
    document.body.appendChild(fileInput)
    return fileInput
  }

  function onFileSelected(): void {
    const file = fileInput?.files?.[0]
    if (!file) return
    if (fileInput) fileInput.value = ''

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = typeof event.target?.result === 'string' ? event.target.result : ''
      void handleImportFile(text)
    }
    reader.readAsText(file)
  }

  async function handleImportFile(text: string): Promise<void> {
    const wsId = deps.getWsId()
    if (!wsId) return

    try {
      const { runImportFlow } = await import('./import/importDialog')
      importDialog = await runImportFlow({ text, wsId, api: deps.api })
    } catch {
      importDialog = null
    }
  }

  function onManageClick(wsId: string): void {
    if (manageDialog) return

    void (async () => {
      try {
        const { createManageDialog } = await import('./manage/manageDialog')
        manageDialog = await createManageDialog({
          wsId,
          api: deps.api,
          onClose: () => {
            manageDialog = null
          }
        })
      } catch {
        manageDialog = null
      }
    })()
  }

  function onExportClick(wsId: string, activeId: string | null): void {
    if (exportPanel) return

    void (async () => {
      try {
        const { createExportDialog } = await import('./export/exportDialog')
        exportPanel = await createExportDialog({
          wsId,
          activeTableauId: activeId,
          api: deps.api,
          onClose: () => {
            exportPanel = null
          }
        })
      } catch {
        exportPanel = null
      }
    })()
  }

  function inject(): void {
    const header = getHeader()
    if (!header || isInjected()) return

    const container = document.createElement('div')
    container.setAttribute(INJECT_MARKER, '')
    container.style.display = 'contents'

    container.appendChild(createMenuTrigger())
    header.appendChild(container)
  }

  function cleanup(): void {
    closeMenu()
    document.querySelectorAll<HTMLElement>(`[${INJECT_MARKER}]`).forEach((node) => node.remove())
    menuTrigger = null
    exportPanel?.remove()
    exportPanel = null
    importDialog?.remove()
    importDialog = null
    manageDialog?.remove()
    manageDialog = null
  }

  function checkAndInject(): void {
    const flyout = document.querySelector(FLYOUT_SELECTOR)
    if (flyout) {
      inject()
    } else {
      cleanup()
    }
  }

  function startObserver(): void {
    if (observer) return
    observer = new MutationObserver(() => {
      checkAndInject()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    checkAndInject()
  }

  function stopObserver(): void {
    observer?.disconnect()
    observer = null
    cleanup()
    fileInput?.remove()
    fileInput = null
  }

  return {
    mount() {
      startObserver()
    },
    update() {
      if (!observer) startObserver()
    },
    unmount() {
      stopObserver()
    }
  }
}
