/**
 * Shared command-bar UI helpers used by options/search/section controls.
 */
export type CompactActionButtonParams = {
  id?: string
  title: string
  ariaLabel: string
  iconClassName: string
  labelText?: string
  iconSizePx?: number
  buttonSizePx?: number
  iconInlineStyle?: string
  buttonClassName?: string
  buttonInlineStyle?: string
  onClick: () => void
}

function createActionIcon(iconClassName: string, sizePx = 16, iconInlineStyle?: string): HTMLSpanElement {
  const icon = document.createElement('span')
  icon.className = iconClassName
  icon.setAttribute('aria-hidden', 'true')
  icon.style.cssText = iconInlineStyle || `font-size:${sizePx}px;line-height:1;display:block;`
  return icon
}

export function getReferenceWrapperClassName(commandBar: HTMLElement): string {
  const wrapper = commandBar.querySelector('.weave-button-wrapper') as HTMLElement | null
  return wrapper?.className || 'weave-button-wrapper'
}

export function createCompactActionButton(params: CompactActionButtonParams): HTMLButtonElement {
  const buttonSize = params.buttonSizePx ?? 34
  const button = document.createElement('button')
  if (params.id) button.id = params.id
  button.type = 'button'
  button.tabIndex = 0
  button.title = params.title
  button.setAttribute('aria-label', params.ariaLabel)
  const hasLabel = Boolean(params.labelText)
  button.className =
    params.buttonClassName || (hasLabel
      ? 'md-button md-default-theme command-bar-button md-button md-ink-ripple md-secondary'
      : 'square-icon md-default-theme bom-expand-collapse-button md-button md-ink-ripple')

  if (hasLabel) {
    button.style.cssText = params.buttonInlineStyle || [
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'gap:7px',
      'height:34px',
      'padding:0 12px',
      'white-space:nowrap'
    ].join(';')

    const icon = createActionIcon(params.iconClassName, params.iconSizePx ?? 16, params.iconInlineStyle)
    const label = document.createElement('span')
    label.className = 'label'
    label.textContent = params.labelText || ''
    button.appendChild(icon)
    button.appendChild(label)
  } else {
    button.style.cssText = params.buttonInlineStyle || [
      `min-width:${buttonSize}px`,
      `width:${buttonSize}px`,
      `height:${buttonSize}px`,
      'padding:0',
      'display:inline-flex',
      'align-items:center',
      'justify-content:center'
    ].join(';')

    const icon = createActionIcon(params.iconClassName, params.iconSizePx ?? 16, params.iconInlineStyle)
    button.appendChild(icon)
  }

  button.addEventListener('click', params.onClick)
  return button
}
