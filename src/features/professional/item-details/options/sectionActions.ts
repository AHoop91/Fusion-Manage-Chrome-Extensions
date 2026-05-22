import {
  COMMAND_BAR_EXPAND_ALL_ID,
  COMMAND_BAR_HIDE_ALL_ID,
  COMMAND_BAR_LINKED_ITEMS_ID,
  COMMAND_BAR_OPTIONS_ID,
  COMMAND_BAR_SEARCH_ID,
  SECTION_HEADER_SELECTOR
} from '../item-details.constants'
import type { ItemDetailsRuntime } from '../item-details.types'
import type { CompactActionButtonParams } from '../view/item-details.command-bar.view'

type SectionActionsDeps = {
  ext: ItemDetailsRuntime
  createCompactActionButton: (params: CompactActionButtonParams) => HTMLButtonElement
  getReferenceWrapperClassName: (commandBar: HTMLElement) => string
}

type SectionActionsController = {
  ensure: (commandBar: HTMLElement) => HTMLElement
  remove: () => void
  isPresent: () => boolean
  toggleAllSections: (expand: boolean) => void
}

export const COMMAND_LEFT_ACTION_GROUP_ID = 'plm-extension-command-sections-group'
export const COMMAND_LEFT_ACTION_IDS = [COMMAND_BAR_EXPAND_ALL_ID, COMMAND_BAR_HIDE_ALL_ID] as const

const COMMAND_LEFT_ACTION_GAP_PX = 12
const COMMAND_EXTENSION_WRAPPER_IDS = new Set<string>([
  COMMAND_LEFT_ACTION_GROUP_ID,
  COMMAND_BAR_SEARCH_ID,
  COMMAND_BAR_LINKED_ITEMS_ID,
  COMMAND_BAR_OPTIONS_ID,
  ...COMMAND_LEFT_ACTION_IDS
])

function getCommandBarWrappers(commandBar: HTMLElement): HTMLElement[] {
  return Array.from(commandBar.children).filter((child) => {
    return child instanceof HTMLElement && child.classList.contains('weave-button-wrapper')
  }) as HTMLElement[]
}

/**
 * Keep extension actions after the host action cluster so they do not render
 * between host controls during view/edit transitions.
 */
function findLastHostActionWrapper(commandBar: HTMLElement): HTMLElement | null {
  const wrappers = getCommandBarWrappers(commandBar).filter((wrapper) => !COMMAND_EXTENSION_WRAPPER_IDS.has(wrapper.id))
  if (wrappers.length === 0) return null

  const wrappersWithButtons = wrappers.filter((wrapper) => Boolean(wrapper.querySelector('button')))
  if (wrappersWithButtons.length > 0) {
    return wrappersWithButtons[wrappersWithButtons.length - 1] || null
  }

  return wrappers[wrappers.length - 1] || null
}

function isVisibleElement(element: HTMLElement): boolean {
  if (!element.isConnected) return false
  if (element.getClientRects().length === 0) return false

  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

export function createSectionActionsController({
  ext,
  createCompactActionButton,
  getReferenceWrapperClassName
}: SectionActionsDeps): SectionActionsController {
  /**
   * Expand/collapse all visible section headers in the current page.
   */
  function toggleAllSections(expand: boolean): void {
    const requiredExpandedState = expand ? 'false' : 'true'
    const headers = Array.from(
      document.querySelectorAll(`${SECTION_HEADER_SELECTOR}[aria-expanded="${requiredExpandedState}"]`)
    ) as HTMLElement[]

    for (const header of headers) {
      if (!isVisibleElement(header)) continue
      header.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        })
      )
    }
  }

  function ensure(commandBar: HTMLElement): HTMLElement {
    const lastHostWrapper = findLastHostActionWrapper(commandBar)
    let groupWrapper = ext.findByIdDeep(commandBar, COMMAND_LEFT_ACTION_GROUP_ID) as HTMLElement | null

    if (!groupWrapper) {
      groupWrapper = document.createElement('div')
      groupWrapper.id = COMMAND_LEFT_ACTION_GROUP_ID
      groupWrapper.className = getReferenceWrapperClassName(commandBar)
      groupWrapper.style.cssText = [
        `margin-left:${COMMAND_LEFT_ACTION_GAP_PX}px`,
        'display:inline-flex',
        'align-items:center',
        'height:34px',
        'vertical-align:middle'
      ].join(';')

      const group = document.createElement('div')
      group.id = `${COMMAND_LEFT_ACTION_GROUP_ID}-buttons`
      group.className = 'md-button-group'
      group.setAttribute('role', 'group')
      group.setAttribute('aria-label', 'Section controls')
      group.style.cssText = 'display:inline-flex;width:auto;'

      const hideButton = createCompactActionButton({
        id: COMMAND_BAR_HIDE_ALL_ID,
        title: 'Hide all sections',
        ariaLabel: 'Actions',
        iconClassName: 'zmdi zmdi-minus-square',
        onClick: () => toggleAllSections(false)
      })

      const expandButton = createCompactActionButton({
        id: COMMAND_BAR_EXPAND_ALL_ID,
        title: 'Expand all sections',
        ariaLabel: 'Actions',
        iconClassName: 'zmdi zmdi-collection-plus',
        onClick: () => toggleAllSections(true)
      })

      group.appendChild(hideButton)
      group.appendChild(expandButton)
      groupWrapper.appendChild(group)
      commandBar.appendChild(groupWrapper)
    } else {
      groupWrapper.className = getReferenceWrapperClassName(commandBar)
      groupWrapper.style.cssText = [
        `margin-left:${COMMAND_LEFT_ACTION_GAP_PX}px`,
        'display:inline-flex',
        'align-items:center',
        'height:34px',
        'vertical-align:middle'
      ].join(';')
    }

    if (!lastHostWrapper) {
      if (groupWrapper.parentElement !== commandBar) {
        commandBar.appendChild(groupWrapper)
      }
      return groupWrapper
    }

    const desiredNextSibling = lastHostWrapper.nextSibling
    if (groupWrapper.parentElement !== commandBar) {
      commandBar.appendChild(groupWrapper)
    }
    if (groupWrapper !== desiredNextSibling) {
      commandBar.insertBefore(groupWrapper, desiredNextSibling)
    }
    return groupWrapper
  }

  function remove(): void {
    const groupWrapper = ext.findByIdDeep(document, COMMAND_LEFT_ACTION_GROUP_ID)
    if (groupWrapper) groupWrapper.remove()

    for (const id of COMMAND_LEFT_ACTION_IDS) {
      const action = ext.findByIdDeep(document, id)
      if (action) action.remove()
    }
  }

  function isPresent(): boolean {
    return (
      Boolean(ext.findByIdDeep(document, COMMAND_LEFT_ACTION_GROUP_ID)) &&
      COMMAND_LEFT_ACTION_IDS.every((id) => Boolean(ext.findByIdDeep(document, id)))
    )
  }

  return {
    ensure,
    remove,
    isPresent,
    toggleAllSections
  }
}
