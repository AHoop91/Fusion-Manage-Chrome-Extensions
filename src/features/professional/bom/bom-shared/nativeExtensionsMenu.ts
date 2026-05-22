import { ensureStyleTag } from '../../../../shared/dom/styles'

type NativeExtensionsMenuRuntime = {
  findByIdDeep: (root: Document | ShadowRoot | Element | null, id: string) => HTMLElement | null
}

const EXTENSIONS_MENU_STYLE_ID = 'plm-extension-bom-native-extensions-menu-style'
const EXTENSIONS_MENU_ID = 'plm-extension-bom-advanced-attachment-download-menu'
const EXTENSIONS_TRIGGER_ID = 'plm-extension-bom-extensions-trigger'
const EXTENSIONS_ROOT_MENU_CLASS = 'plm-extension-bom-command-menu'
const EXTENSIONS_ROOT_MENU_LIST_CLASS = 'plm-extension-bom-command-menu-list'
export const EXTENSIONS_SUBMENU_CLASS = 'plm-extension-bom-native-submenu'
export const EXTENSIONS_SUBMENU_MENU_CLASS = 'plm-extension-bom-native-submenu-menu'
export const EXTENSIONS_SUBMENU_CHEVRON_CLASS = 'plm-extension-bom-native-submenu-chevron'

function buildNativeExtensionsMenuStyles(): string {
  return `
.${EXTENSIONS_ROOT_MENU_CLASS}{
  --plm-bom-font-sans:"ArtifaktElement","Segoe UI",Arial,sans-serif;
  position:relative;
  display:inline-flex;
  align-items:center;
  margin-left:2px;
}
.${EXTENSIONS_ROOT_MENU_CLASS} > button{
  min-width:128px !important;
  min-height:34px !important;
  width:128px !important;
  max-width:128px !important;
  flex:0 0 auto !important;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:2px;
  padding-left:9px !important;
  padding-right:8px !important;
}
.${EXTENSIONS_ROOT_MENU_CLASS} > button .label{
  padding:0 3px;
}
.${EXTENSIONS_ROOT_MENU_CLASS} > button .${EXTENSIONS_SUBMENU_CHEVRON_CLASS}{
  position:static;
  transform:none;
  font-size:16px;
  line-height:1;
}
.${EXTENSIONS_ROOT_MENU_LIST_CLASS}{
  position:absolute;
  top:calc(100% + 2px);
  left:0;
  min-width:max-content;
  width:max-content;
  max-width:min(360px, calc(100vw - 24px));
  margin:0;
  padding:4px 0;
  display:none;
  list-style:none;
  background:#fff;
  border:1px solid #cfd9e6;
  border-radius:4px;
  box-shadow:0 8px 20px rgba(16, 24, 36, .2);
  z-index:145;
}
.${EXTENSIONS_ROOT_MENU_CLASS}:hover > .${EXTENSIONS_ROOT_MENU_LIST_CLASS},
.${EXTENSIONS_ROOT_MENU_CLASS}:focus-within > .${EXTENSIONS_ROOT_MENU_LIST_CLASS}{
  display:block;
}
.${EXTENSIONS_ROOT_MENU_LIST_CLASS} > li{
  list-style:none;
}
.${EXTENSIONS_ROOT_MENU_LIST_CLASS} a{
  display:block;
  padding:8px 12px;
  font:600 13px/1.2 var(--plm-bom-font-sans);
  color:#203a56;
  text-decoration:none;
  white-space:nowrap;
}
.${EXTENSIONS_ROOT_MENU_LIST_CLASS} a:hover,
.${EXTENSIONS_ROOT_MENU_LIST_CLASS} a:focus-visible{
  background:#eef6ff;
  outline:none;
}
.${EXTENSIONS_SUBMENU_CLASS}{
  position:relative;
  list-style:none;
}
.${EXTENSIONS_SUBMENU_CLASS} > a{
  display:block;
  position:relative;
  padding-right:24px;
}
.${EXTENSIONS_SUBMENU_CHEVRON_CLASS}{
  position:absolute;
  right:8px;
  top:50%;
  transform:translateY(-50%);
  font-size:15px;
  line-height:1;
  color:inherit;
}
.${EXTENSIONS_SUBMENU_MENU_CLASS}{
  position:absolute;
  top:0;
  left:100%;
  min-width:max-content;
  width:max-content;
  margin:0;
  padding:0;
  display:none;
  list-style:none;
  background:#fff;
  border:1px solid #d6dde5;
  border-radius:3px;
  box-shadow:0 3px 8px rgba(0, 0, 0, .18);
  z-index:146;
}
.${EXTENSIONS_SUBMENU_CLASS}:hover > .${EXTENSIONS_SUBMENU_MENU_CLASS},
.${EXTENSIONS_SUBMENU_CLASS}:focus-within > .${EXTENSIONS_SUBMENU_MENU_CLASS}{
  display:block;
}
.${EXTENSIONS_SUBMENU_MENU_CLASS} > li{
  list-style:none;
}
.${EXTENSIONS_SUBMENU_MENU_CLASS} > li > a{
  display:block;
}
`
}

function findById(runtime: NativeExtensionsMenuRuntime, id: string): HTMLElement | null {
  return runtime.findByIdDeep(document, id) || document.getElementById(id)
}

function findActionButtonsHost(): HTMLElement | null {
  const host = document.querySelector('#transcluded-buttons') as HTMLElement | null
  if (!host) return null
  const commandBar = (host.querySelector('.bom-command-bar') || host.querySelector('.grid-command-bar')) as HTMLElement | null
  return commandBar || host
}

function ensureLabel(container: HTMLElement): HTMLSpanElement {
  let label = container.querySelector('.label') as HTMLSpanElement | null
  if (!label) {
    label = document.createElement('span')
    label.className = 'label'
    container.replaceChildren(label)
  }
  return label
}

function ensureChevron(container: HTMLElement, direction: 'down' | 'right'): void {
  let chevron = container.querySelector(`.${EXTENSIONS_SUBMENU_CHEVRON_CLASS}`) as HTMLSpanElement | null
  const iconClass = direction === 'down' ? 'zmdi-chevron-down' : 'zmdi-chevron-right'
  if (chevron) return
  chevron = document.createElement('span')
  chevron.className = `zmdi ${iconClass} ${EXTENSIONS_SUBMENU_CHEVRON_CLASS}`
  chevron.setAttribute('aria-hidden', 'true')
  container.appendChild(chevron)
}

function isCurrentExtensionsMenuShape(element: HTMLElement | null): element is HTMLDivElement {
  if (!(element instanceof HTMLDivElement)) return false
  const trigger = element.querySelector(`#${EXTENSIONS_TRIGGER_ID}`)
  const submenu = element.querySelector(`.${EXTENSIONS_ROOT_MENU_LIST_CLASS}`)
  return trigger instanceof HTMLButtonElement && submenu instanceof HTMLUListElement
}

function isBomPageRoute(): boolean {
  try {
    const url = new URL(window.location.href)
    return /^\/plm\/workspaces\/\d+\/items\/bom\/nested$/i.test(url.pathname)
  } catch {
    return false
  }
}

export function ensureBomExtensionsMenu(
  runtime: NativeExtensionsMenuRuntime
): { menuItem: HTMLElement; submenu: HTMLUListElement } | null {
  ensureStyleTag(EXTENSIONS_MENU_STYLE_ID, buildNativeExtensionsMenuStyles())

  const host = findActionButtonsHost()
  if (!host) return null

  const existingMenuItem = document.getElementById(EXTENSIONS_MENU_ID)
  if (existingMenuItem && !isCurrentExtensionsMenuShape(existingMenuItem)) {
    existingMenuItem.remove()
  }

  let menuItem = document.getElementById(EXTENSIONS_MENU_ID) as HTMLDivElement | null
  if (!menuItem) {
    menuItem = document.createElement('div')
    menuItem.id = EXTENSIONS_MENU_ID
    menuItem.className = EXTENSIONS_ROOT_MENU_CLASS

    const triggerButton = document.createElement('button')
    triggerButton.type = 'button'
    triggerButton.id = EXTENSIONS_TRIGGER_ID
    triggerButton.className = [
      'md-button',
      'md-secondary',
      'md-default-theme',
      'command-bar-button',
      'md-button',
      'md-ink-ripple',
      'plm-extension-btn',
      'plm-extension-btn--secondary'
    ].join(' ')
    menuItem.appendChild(triggerButton)

    const submenu = document.createElement('ul')
    submenu.className = EXTENSIONS_ROOT_MENU_LIST_CLASS
    menuItem.appendChild(submenu)
  }

  const triggerButton = menuItem.querySelector(`#${EXTENSIONS_TRIGGER_ID}`) as HTMLButtonElement | null
  const submenu = menuItem.querySelector(`.${EXTENSIONS_ROOT_MENU_LIST_CLASS}`) as HTMLUListElement | null
  if (!triggerButton || !submenu) return null

  triggerButton.title = 'Extensions'
  triggerButton.setAttribute('aria-label', 'Extensions')
  ensureLabel(triggerButton).textContent = 'Extensions'
  ensureChevron(triggerButton, 'down')
  triggerButton.onclick = (event): void => {
    event.preventDefault()
    event.stopPropagation()
  }

  const actionButton = findById(runtime, 'bom-actions-button')
  if (actionButton?.nextElementSibling !== menuItem && actionButton?.parentElement) {
    menuItem.remove()
    actionButton.insertAdjacentElement('afterend', menuItem)
  } else if (menuItem.parentElement !== host) {
    menuItem.remove()
    host.appendChild(menuItem)
  }

  return { menuItem, submenu }
}

export function removeBomExtensionsMenuItem(itemId: string): void {
  const item = document.getElementById(itemId)
  const submenu = item?.parentElement
  if (item) item.remove()

  if (!(submenu instanceof HTMLUListElement)) return
  if (submenu.querySelector('li')) return
  if (isBomPageRoute()) return

  const menuItem = submenu.closest(`#${EXTENSIONS_MENU_ID}`)
  if (menuItem) menuItem.remove()
}
