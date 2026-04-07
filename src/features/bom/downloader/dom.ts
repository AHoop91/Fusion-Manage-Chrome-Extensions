import { ensureStyleTag } from '../../../dom/styles'
import type { ModalAction } from '../../../shared/runtime/types'
import { buildAttachmentDownloadLauncherStyles, buildAttachmentDownloadStyles } from './styles'
import { isBomTabRoute } from '../shared/page'

type AttachmentDownloadDomRuntime = {
  openModal: (modalId: string, action: ModalAction) => void
  closeModal: (modalId: string) => void
  findByIdDeep: (root: Document | ShadowRoot | Element | null, id: string) => HTMLElement | null
}

export type AttachmentDownloadDomAdapter = {
  isBomTab: (urlString: string) => boolean
  ensureAttachmentDownloadButton: (onSelect: () => void, options?: { disabled?: boolean; title?: string }) => HTMLLIElement | null
  isAttachmentDownloadButtonPresent: () => boolean
  observeButtonPresence: (onNeedsSync: (delayMs: number) => void) => () => void
  removeAttachmentDownloadButton: () => void
  openAttachmentDownloadModalShell: () => HTMLDivElement | null
  closeAttachmentDownloadModalShell: () => void
}

const ATTACHMENT_DOWNLOAD_MODAL_ID = 'plm-extension-bom-attachment-download-modal'
const ATTACHMENT_DOWNLOAD_STYLE_ID = 'plm-extension-bom-attachment-download-style'
const ATTACHMENT_DOWNLOAD_MENU_STYLE_ID = 'plm-extension-bom-attachment-download-menu-style'
const ATTACHMENT_DOWNLOAD_MENU_ID = 'plm-extension-bom-advanced-attachment-download-menu'
const ATTACHMENT_DOWNLOAD_ITEM_ID = 'plm-extension-bom-advanced-attachment-download-item'
const ATTACHMENT_DOWNLOAD_BUTTON_ID = 'plm-extension-bom-advanced-attachment-download-button'
const ATTACHMENT_DOWNLOAD_TRIGGER_ID = 'plm-extension-bom-advanced-attachment-download-trigger'
const OVERLAY_CLOSE_BLOCKED_ATTR = 'data-plm-bom-overlay-close-blocked'

function findById(runtime: AttachmentDownloadDomRuntime, id: string): HTMLElement | null {
  return runtime.findByIdDeep(document, id) || document.getElementById(id)
}

function findActionDropdownContainer(runtime: AttachmentDownloadDomRuntime): HTMLElement | null {
  return findById(runtime, 'bom-actions-dropdown')
}

function findAttachmentActionList(runtime: AttachmentDownloadDomRuntime): HTMLUListElement | null {
  const container = findActionDropdownContainer(runtime)
  if (!container) return null
  const list = container.querySelector('ul')
  return list instanceof HTMLUListElement ? list : null
}

function findNativeActionLinkTemplate(list: HTMLUListElement): HTMLAnchorElement | null {
  const link = list.querySelector('li a')
  return link instanceof HTMLAnchorElement ? link : null
}

function findNativeAttachmentDownloadButton(runtime: AttachmentDownloadDomRuntime): HTMLButtonElement | null {
  const button = findById(runtime, 'bulk-download-bom')
  return button instanceof HTMLButtonElement ? button : null
}

function blockBackdropClose(modal: HTMLDivElement): void {
  if (modal.getAttribute(OVERLAY_CLOSE_BLOCKED_ATTR) === 'true') return
  modal.setAttribute(OVERLAY_CLOSE_BLOCKED_ATTR, 'true')
  modal.addEventListener('click', (event) => {
    if (event.target !== modal) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }, true)
}

function ensureStyles(): void {
  ensureStyleTag(ATTACHMENT_DOWNLOAD_STYLE_ID, buildAttachmentDownloadStyles(ATTACHMENT_DOWNLOAD_MODAL_ID))
  ensureStyleTag(ATTACHMENT_DOWNLOAD_MENU_STYLE_ID, buildAttachmentDownloadLauncherStyles())
}

export function createAttachmentDownloadDom(runtime: AttachmentDownloadDomRuntime): AttachmentDownloadDomAdapter {
  return {
    isBomTab(urlString) {
      return isBomTabRoute(urlString)
    },
    ensureAttachmentDownloadButton(onSelect, options) {
      ensureStyles()

      const list = findAttachmentActionList(runtime)
      const nativeButton = findNativeAttachmentDownloadButton(runtime)
      const nativeLinkTemplate = list ? findNativeActionLinkTemplate(list) : null
      if (!list || !nativeButton || !nativeLinkTemplate) return null
      const nativeItem = nativeButton.closest('li')
      if (!(nativeItem instanceof HTMLLIElement)) return null

      let menuItem = document.getElementById(ATTACHMENT_DOWNLOAD_MENU_ID) as HTMLLIElement | null
      if (!menuItem) {
        menuItem = nativeItem.cloneNode(false) as HTMLLIElement
        menuItem.id = ATTACHMENT_DOWNLOAD_MENU_ID
        menuItem.className = 'plm-extension-bom-native-submenu'

        const triggerLink = nativeLinkTemplate.cloneNode(true) as HTMLAnchorElement
        triggerLink.id = ATTACHMENT_DOWNLOAD_TRIGGER_ID
        menuItem.appendChild(triggerLink)

        const submenu = document.createElement('ul')
        submenu.className = 'plm-extension-bom-native-submenu-menu'
        menuItem.appendChild(submenu)
      }

      let item = document.getElementById(ATTACHMENT_DOWNLOAD_ITEM_ID) as HTMLLIElement | null
      if (!item) {
        item = nativeItem.cloneNode(false) as HTMLLIElement
        item.id = ATTACHMENT_DOWNLOAD_ITEM_ID
        const link = nativeLinkTemplate.cloneNode(true) as HTMLAnchorElement
        link.id = ATTACHMENT_DOWNLOAD_BUTTON_ID
        item.appendChild(link)
      }

      const disabled = Boolean(options?.disabled)
      const title = String(options?.title || 'Advanced Download Attachments').trim()

      const triggerLink = menuItem.querySelector(`#${ATTACHMENT_DOWNLOAD_TRIGGER_ID}`) as HTMLAnchorElement | null
      const submenu = menuItem.querySelector('.plm-extension-bom-native-submenu-menu') as HTMLUListElement | null
      const link = item.querySelector(`#${ATTACHMENT_DOWNLOAD_BUTTON_ID}`) as HTMLAnchorElement | null
      if (!triggerLink || !submenu || !link) return null

      let triggerLabel = triggerLink.querySelector('.label') as HTMLSpanElement | null
      let label = link.querySelector('.label') as HTMLSpanElement | null
      if (!triggerLabel) {
        triggerLabel = document.createElement('span')
        triggerLabel.className = 'label'
        triggerLink.replaceChildren(triggerLabel)
      }
      if (!label) {
        label = document.createElement('span')
        label.className = 'label'
        link.replaceChildren(label)
      }

      triggerLink.id = ATTACHMENT_DOWNLOAD_TRIGGER_ID
      triggerLink.href = 'javascript:;'
      triggerLink.title = 'Extensions'
      triggerLink.setAttribute('aria-label', 'Extensions')
      triggerLink.removeAttribute('ng-click')
      triggerLabel.textContent = 'Extensions'

      let triggerChevron = triggerLink.querySelector('.plm-extension-bom-native-submenu-chevron') as HTMLSpanElement | null
      if (!triggerChevron) {
        triggerChevron = document.createElement('span')
        triggerChevron.className = 'zmdi zmdi-chevron-right plm-extension-bom-native-submenu-chevron'
        triggerChevron.setAttribute('aria-hidden', 'true')
        triggerLink.appendChild(triggerChevron)
      }

      link.id = ATTACHMENT_DOWNLOAD_BUTTON_ID
      link.href = 'javascript:;'
      link.title = title
      link.setAttribute('aria-label', title)
      link.removeAttribute('ng-click')
      label.textContent = 'Advanced Download Attachments'

      if (disabled) {
        menuItem.classList.add('disabled-excel-download')
        item.className = 'disabled-excel-download'
        triggerLink.setAttribute('aria-disabled', 'true')
        link.setAttribute('aria-disabled', 'true')
      } else {
        menuItem.classList.remove('disabled-excel-download')
        item.removeAttribute('class')
        triggerLink.removeAttribute('aria-disabled')
        link.removeAttribute('aria-disabled')
      }

      triggerLink.onclick = (event): void => {
        event.preventDefault()
        event.stopPropagation()
      }

      link.onclick = (event): void => {
        event.preventDefault()
        event.stopPropagation()
        if (disabled) return
        onSelect()
      }

      if (item.parentElement !== submenu) {
        item.remove()
        submenu.appendChild(item)
      }

      if (nativeItem.parentElement === list && nativeItem.nextElementSibling !== menuItem) {
        menuItem.remove()
        nativeItem.insertAdjacentElement('afterend', menuItem)
      } else if (menuItem.parentElement !== list) {
        menuItem.remove()
        list.appendChild(menuItem)
      }

      return menuItem
    },
    isAttachmentDownloadButtonPresent() {
      const item = document.getElementById(ATTACHMENT_DOWNLOAD_ITEM_ID)
      return Boolean(item && document.contains(item))
    },
    observeButtonPresence(onNeedsSync) {
      const observer = new MutationObserver(() => {
        const shouldExist = isBomTabRoute(window.location.href)
        const nativeAttachmentButton = findNativeAttachmentDownloadButton(runtime)
        const advancedAttachmentButton = document.getElementById(ATTACHMENT_DOWNLOAD_BUTTON_ID) as HTMLElement | null

        if (!shouldExist) {
          if (advancedAttachmentButton) onNeedsSync(0)
          return
        }

        if (nativeAttachmentButton && (!advancedAttachmentButton || !document.contains(advancedAttachmentButton))) {
          onNeedsSync(16)
        }
      })
      observer.observe(document.documentElement, { childList: true, subtree: true })
      return () => observer.disconnect()
    },
    removeAttachmentDownloadButton() {
      const menu = document.getElementById(ATTACHMENT_DOWNLOAD_MENU_ID)
      if (menu) menu.remove()
      const item = document.getElementById(ATTACHMENT_DOWNLOAD_ITEM_ID)
      if (item) item.remove()
    },
    openAttachmentDownloadModalShell() {
      runtime.openModal(ATTACHMENT_DOWNLOAD_MODAL_ID, {
        id: 'bom.attachment-download',
        label: 'Advanced Download Attachments'
      })
      const modal = document.getElementById(ATTACHMENT_DOWNLOAD_MODAL_ID)
      if (!(modal instanceof HTMLDivElement)) return null
      blockBackdropClose(modal)
      return modal
    },
    closeAttachmentDownloadModalShell() {
      runtime.closeModal(ATTACHMENT_DOWNLOAD_MODAL_ID)
    }
  }
}
