import {
  DESIGN_COMPONENTS_ACTION_WRAPPER_ID,
  DESIGN_COMPONENTS_LEGACY_BUTTON_SELECTOR,
  DESIGN_COMPONENTS_MODAL_CSS,
  DESIGN_COMPONENTS_STATUS_ROW_ID,
  DESIGN_COMPONENTS_STYLE_ID
} from './components.constants'

export function ensureDesignComponentsStyles(): void {
  if (document.getElementById(DESIGN_COMPONENTS_STYLE_ID)) return
  const tag = document.createElement('style')
  tag.id = DESIGN_COMPONENTS_STYLE_ID
  tag.textContent = DESIGN_COMPONENTS_MODAL_CSS
  document.head.appendChild(tag)
}

export function getDesignComponentsStatusRowContainer(): HTMLElement | null {
  return document.getElementById(DESIGN_COMPONENTS_STATUS_ROW_ID) as HTMLElement | null
}

export function removeLegacyDesignComponentsButtons(): void {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(DESIGN_COMPONENTS_LEGACY_BUTTON_SELECTOR))
  nodes.forEach((node) => {
    if (node.closest(`#${DESIGN_COMPONENTS_ACTION_WRAPPER_ID}`)) return
    node.remove()
  })
}

export function placeDesignComponentsWrapperAtRight(container: HTMLElement, wrapper: HTMLElement): void {
  wrapper.style.cssText = 'margin-left:auto;display:inline-flex;align-items:center;'
  if (wrapper.parentElement !== container || container.lastElementChild !== wrapper) {
    container.appendChild(wrapper)
  }
}
