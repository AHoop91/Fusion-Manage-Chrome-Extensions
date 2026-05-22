import {
  COMMAND_BAR_LINKED_ITEMS_ID,
  COMMAND_BAR_LINKED_ITEMS_MENU_ID,
  COMMAND_BAR_OPTIONS_ID,
  COMMAND_BAR_OPTIONS_MENU_ID,
  COMMAND_BAR_SEARCH_ID,
  COMMAND_BAR_SEARCH_INPUT_ID,
  COMMAND_BAR_SEARCH_TOGGLE_ID,
  OPTIONS_SHOW_STABLE_MS
} from '../item-details.constants'
import { createSearchControlFeature } from './searchControl'
import { createSectionActionsController } from './sectionActions'
import type { ItemDetailsOptionsMode, ItemDetailsRuntime } from '../item-details.types'
import { createLinkedItemsMenuController } from '../view/item-details.linked-items-menu.view'
import { createOptionsMenuController } from '../view/item-details.options-menu.view'
import { createCompactActionButton, getReferenceWrapperClassName } from '../view/item-details.command-bar.view'

/**
 * Command-bar feature orchestrator for item details:
 * - options entry button and popover
 * - section expand/collapse actions
 * - field search control
 */
type OptionsButtonDeps = {
  ext: ItemDetailsRuntime
  isPageSupported: (url: string) => boolean
  isLoading: () => boolean
  getOptionsMode: () => ItemDetailsOptionsMode
  suspendSearchOverrides: () => void
  resumeSearchOverrides: () => void
  isHideEmptyEnabled: () => boolean
  setHideEmptyEnabled: (next: boolean) => Promise<void>
  isRequiredOnlyEnabled: () => boolean
  setRequiredOnlyEnabled: (next: boolean) => Promise<void>
  openSectionsModal: () => Promise<void>
}

type OptionsButtonFeature = {
  scheduleVisibility: (isLoading: boolean) => void
  ensurePresenceObserver: (url: string) => void
  closeOptionsMenu: () => void
  removeButton: () => void
  cleanup: () => void
}

const COMMAND_BAR_ID = 'command-bar-react'
const COMMAND_BAR_RIGHT_ACTIONS_ID = 'plm-extension-command-right-actions'

export function createOptionsButtonFeature({
  ext,
  isPageSupported,
  isLoading,
  getOptionsMode,
  suspendSearchOverrides,
  resumeSearchOverrides,
  isHideEmptyEnabled,
  setHideEmptyEnabled,
  isRequiredOnlyEnabled,
  setRequiredOnlyEnabled,
  openSectionsModal
}: OptionsButtonDeps): OptionsButtonFeature {
  let optionsVisibilityTimer: number | null = null
  let commandBarPresenceObserver: MutationObserver | null = null
  let commandBarReflowRaf: number | null = null

  const optionsMenu = createOptionsMenuController({
    getOptionsMode,
    isHideEmptyEnabled,
    setHideEmptyEnabled,
    isRequiredOnlyEnabled,
    setRequiredOnlyEnabled,
    openSectionsModal
  })
  const linkedItemsMenu = createLinkedItemsMenuController({ ext })

  const sectionActions = createSectionActionsController({
    ext,
    createCompactActionButton,
    getReferenceWrapperClassName
  })

  const searchControl = createSearchControlFeature({
    ext,
    suspendSearchOverrides,
    resumeSearchOverrides,
    createCompactActionButton,
    getReferenceWrapperClassName
  })

  function closeOptionsMenu(): void {
    optionsMenu.close()
  }

  function closeLinkedItemsMenu(): void {
    linkedItemsMenu.close()
  }

  function ensureActionControls(commandBar: HTMLElement): void {
    const anchorWrapper = sectionActions.ensure(commandBar)
    searchControl.ensureSearchControl(commandBar, anchorWrapper)
  }

  function removeButton(): void {
    const linkedItems = ext.findByIdDeep(document, COMMAND_BAR_LINKED_ITEMS_ID)
    if (linkedItems) linkedItems.remove()
    closeLinkedItemsMenu()

    const options = ext.findByIdDeep(document, COMMAND_BAR_OPTIONS_ID)
    if (options) options.remove()

    sectionActions.remove()
    searchControl.removeSearchControl()

    const rightActionsHost = ext.findByIdDeep(document, COMMAND_BAR_RIGHT_ACTIONS_ID)
    if (rightActionsHost) rightActionsHost.remove()
  }

  function stopOptionsVisibilityTimer(): void {
    if (optionsVisibilityTimer !== null) {
      window.clearTimeout(optionsVisibilityTimer)
      optionsVisibilityTimer = null
    }
  }

  function stopCommandBarPresenceObserver(): void {
    if (commandBarPresenceObserver) {
      commandBarPresenceObserver.disconnect()
      commandBarPresenceObserver = null
    }
  }

  function stopCommandBarReflowRaf(): void {
    if (commandBarReflowRaf !== null) {
      window.cancelAnimationFrame(commandBarReflowRaf)
      commandBarReflowRaf = null
    }
  }

  function scheduleCommandBarReflow(): void {
    if (commandBarReflowRaf !== null) return

    commandBarReflowRaf = window.requestAnimationFrame(() => {
      commandBarReflowRaf = null
      if (!isPageSupported(window.location.href) || isLoading()) return

      const commandBar = ext.findByIdDeep(document, COMMAND_BAR_ID)
      if (!commandBar) return
      ensureActionControls(commandBar)
    })
  }

  function ensureOptionsButton(commandBar: HTMLElement): void {
    const rightActionsHost = ensureRightActionsHost(commandBar)
    const existing = ext.findByIdDeep(document, COMMAND_BAR_OPTIONS_ID)
    if (existing) {
      existing.className = getReferenceWrapperClassName(commandBar)
      if (existing.parentElement !== rightActionsHost) rightActionsHost.appendChild(existing)
      existing.style.cssText = 'position:relative;margin:0;'
      return
    }

    const wrapper = document.createElement('div')
    wrapper.id = COMMAND_BAR_OPTIONS_ID
    wrapper.className = getReferenceWrapperClassName(commandBar)
    wrapper.style.cssText = 'position:relative;margin:0;'

    const button = createCompactActionButton({
      title: 'Options',
      ariaLabel: 'Options',
      labelText: 'Options',
      iconClassName: 'zmdi zmdi-settings',
      iconSizePx: 19,
      onClick: () => {
        const open = document.getElementById(COMMAND_BAR_OPTIONS_MENU_ID)
        if (open) {
          closeOptionsMenu()
        } else {
          closeLinkedItemsMenu()
          void optionsMenu.open(wrapper)
        }
      }
    })

    wrapper.appendChild(button)
    rightActionsHost.appendChild(wrapper)
  }

  function ensureLinkedItemsButton(commandBar: HTMLElement): void {
    const rightActionsHost = ensureRightActionsHost(commandBar)
    const existing = ext.findByIdDeep(document, COMMAND_BAR_LINKED_ITEMS_ID)
    if (existing) {
      existing.className = getReferenceWrapperClassName(commandBar)
      if (existing.parentElement !== rightActionsHost) rightActionsHost.appendChild(existing)
      existing.style.cssText = 'position:relative;margin:0;'
      return
    }

    const wrapper = document.createElement('div')
    wrapper.id = COMMAND_BAR_LINKED_ITEMS_ID
    wrapper.className = getReferenceWrapperClassName(commandBar)
    wrapper.style.cssText = 'position:relative;margin:0;'

    const button = createCompactActionButton({
      title: 'Related Links',
      ariaLabel: 'Related Links',
      labelText: 'Related Links',
      iconClassName: 'zmdi zmdi-attachment-alt',
      iconSizePx: 19,
      onClick: () => {
        const open = document.getElementById(COMMAND_BAR_LINKED_ITEMS_MENU_ID)
        if (open) {
          closeLinkedItemsMenu()
        } else {
          closeOptionsMenu()
          void linkedItemsMenu.open(wrapper)
        }
      }
    })

    wrapper.appendChild(button)
    rightActionsHost.appendChild(wrapper)
  }

  function ensureRightActionsHost(commandBar: HTMLElement): HTMLElement {
    let host = ext.findByIdDeep(commandBar, COMMAND_BAR_RIGHT_ACTIONS_ID) as HTMLElement | null
    if (!host) {
      host = document.createElement('div')
      host.id = COMMAND_BAR_RIGHT_ACTIONS_ID
      host.style.cssText = [
        'position:absolute',
        'right:35px',
        'top:50%',
        'transform:translateY(-50%)',
        'display:inline-flex',
        'align-items:center',
        'gap:8px',
        'z-index:2'
      ].join(';')
      commandBar.appendChild(host)
    }
    return host
  }

  function injectButton(url: string): void {
    if (!isPageSupported(url) || isLoading()) {
      removeButton()
      closeOptionsMenu()
      closeLinkedItemsMenu()
      return
    }

    const commandBar = ext.findByIdDeep(document, COMMAND_BAR_ID)
    if (!commandBar) return

    commandBar.style.position = commandBar.style.position || 'relative'
    commandBar.style.paddingRight = commandBar.style.paddingRight || '130px'
    ensureActionControls(commandBar)
    ensureLinkedItemsButton(commandBar)
    ensureOptionsButton(commandBar)
  }

  function scheduleVisibility(loadingState: boolean): void {
    stopOptionsVisibilityTimer()

    if (!loadingState && !isLoading()) {
      injectButton(window.location.href)
      return
    }

    const delayMs = loadingState ? 0 : OPTIONS_SHOW_STABLE_MS
    optionsVisibilityTimer = window.setTimeout(() => {
      optionsVisibilityTimer = null
      if (isLoading() !== loadingState) return
      if (loadingState) {
        closeOptionsMenu()
        closeLinkedItemsMenu()
      } else {
        injectButton(window.location.href)
      }
    }, delayMs)
  }

  function ensurePresenceObserver(url: string): void {
    if (commandBarPresenceObserver || !isPageSupported(url)) return

    commandBarPresenceObserver = new MutationObserver(() => {
      if (!isPageSupported(window.location.href)) return
      if (isLoading()) {
        closeOptionsMenu()
        closeLinkedItemsMenu()
        return
      }
      scheduleCommandBarReflow()

      const linkedItemsExists = Boolean(ext.findByIdDeep(document, COMMAND_BAR_LINKED_ITEMS_ID))
      const optionsExists = Boolean(ext.findByIdDeep(document, COMMAND_BAR_OPTIONS_ID))
      const sectionActionsExist = sectionActions.isPresent()
      const searchExists =
        Boolean(ext.findByIdDeep(document, COMMAND_BAR_SEARCH_ID)) &&
        Boolean(ext.findByIdDeep(document, COMMAND_BAR_SEARCH_TOGGLE_ID)) &&
        Boolean(ext.findByIdDeep(document, COMMAND_BAR_SEARCH_INPUT_ID))

      if (!linkedItemsExists || !optionsExists || !sectionActionsExist || !searchExists) {
        scheduleVisibility(false)
      }
    })

    commandBarPresenceObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    })
  }

  function cleanup(): void {
    removeButton()
    closeOptionsMenu()
    closeLinkedItemsMenu()
    searchControl.cleanup()
    stopOptionsVisibilityTimer()
    stopCommandBarReflowRaf()
    stopCommandBarPresenceObserver()
  }

  return {
    scheduleVisibility,
    ensurePresenceObserver,
    closeOptionsMenu,
    removeButton,
    cleanup
  }
}
