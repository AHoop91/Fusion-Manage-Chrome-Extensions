import { COMMAND_BAR_SEARCH_INPUT_ID, COMMAND_BAR_SEARCH_TOGGLE_ID } from '../item-details.constants'
import type { CompactActionButtonParams } from './item-details.command-bar.view'

type SearchMode = 'highlight' | 'filter'

export type SearchDomIds = {
  mainId: string
  modeGroupId: string
  highlightModeId: string
  filterModeId: string
  navId: string
  prevId: string
  nextId: string
  statusId: string
}

export type SearchDomRefs = {
  searchWrapper: HTMLElement
  searchMain: HTMLElement
  toggle: HTMLButtonElement
  modeGroup: HTMLElement
  highlightMode: HTMLButtonElement
  filterMode: HTMLButtonElement
  input: HTMLInputElement
  nav: HTMLElement
  prev: HTMLButtonElement
  next: HTMLButtonElement
  status: HTMLElement
}

type SearchDomCallbacks = {
  onToggleClick: () => void
  onModeChange: (mode: SearchMode, inputValue: string) => void
  onInputChange: (value: string, isFocused: boolean, searchMain: HTMLElement) => void
  onInputFocus: (value: string, searchMain: HTMLElement) => void
  onInputBlur: (value: string, searchMain: HTMLElement) => void
  onInputEscape: () => void
  onInputEnter: (shiftKey: boolean) => void
  onPrevClick: () => void
  onNextClick: () => void
}

type CreateSearchDomParams = {
  searchWrapper: HTMLElement
  ids: SearchDomIds
  createCompactActionButton: (params: CompactActionButtonParams) => HTMLButtonElement
  callbacks: SearchDomCallbacks
}

export function applySearchWrapperStyles(searchWrapper: HTMLElement, gapPx: number): void {
  searchWrapper.style.cssText = [
    `margin-left:${gapPx}px`,
    'display:inline-flex',
    'align-items:center',
    'gap:0',
    'height:34px',
    'vertical-align:middle'
  ].join(';')
}

function createSearchModeButton(params: {
  id: string
  title: string
  ariaLabel: string
  iconClassName: string
  onClick: () => void
}): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.id = params.id
  button.title = params.title
  button.setAttribute('aria-label', params.ariaLabel)
  button.style.cssText = [
    'min-width:34px',
    'width:34px',
    'height:34px',
    'padding:0',
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'border:none',
    'border-right:1px solid #e2e8f0',
    'border-radius:0',
    'background:transparent',
    'color:#475569',
    'cursor:pointer'
  ].join(';')

  const icon = document.createElement('span')
  icon.className = params.iconClassName
  icon.setAttribute('aria-hidden', 'true')
  icon.style.cssText = 'display:block;font-size:18px;line-height:1;'
  button.appendChild(icon)
  button.addEventListener('click', params.onClick)
  return button
}

function createSearchNavigation(
  ids: SearchDomIds,
  createCompactActionButton: (params: CompactActionButtonParams) => HTMLButtonElement,
  callbacks: Pick<SearchDomCallbacks, 'onPrevClick' | 'onNextClick'>
): Pick<SearchDomRefs, 'nav' | 'prev' | 'next' | 'status'> {
  const nav = document.createElement('div')
  nav.id = ids.navId
  nav.style.cssText = ['display:none', 'align-items:center', 'gap:4px', 'margin-left:0'].join(';')

  const statusGroup = document.createElement('div')
  statusGroup.className = 'md-button-group'
  statusGroup.style.cssText = 'display:inline-flex;width:auto;'

  const prev = createCompactActionButton({
    id: ids.prevId,
    title: 'Previous result',
    ariaLabel: 'Previous result',
    iconClassName: 'zmdi zmdi-chevron-up',
    iconSizePx: 16,
    onClick: callbacks.onPrevClick
  })

  const status = document.createElement('span')
  status.id = ids.statusId
  status.style.cssText = [
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'min-width:68px',
    'height:34px',
    'padding:0 10px',
    'border:1px solid #cfd8e6',
    'border-radius:4px',
    'background:#ffffff',
    'font:700 11px/1 Segoe UI,Arial,sans-serif',
    'color:#475569',
    'white-space:nowrap'
  ].join(';')

  const next = createCompactActionButton({
    id: ids.nextId,
    title: 'Next result',
    ariaLabel: 'Next result',
    iconClassName: 'zmdi zmdi-chevron-down',
    iconSizePx: 16,
    onClick: callbacks.onNextClick
  })

  const chevronGroup = document.createElement('div')
  chevronGroup.className = 'md-button-group'
  chevronGroup.style.cssText = 'display:inline-flex;width:auto;'
  chevronGroup.appendChild(prev)
  chevronGroup.appendChild(next)

  statusGroup.appendChild(status)
  nav.appendChild(statusGroup)
  nav.appendChild(chevronGroup)

  return { nav, prev, next, status }
}

export function createSearchDom({
  searchWrapper,
  ids,
  createCompactActionButton,
  callbacks
}: CreateSearchDomParams): SearchDomRefs {
  const toggle = createCompactActionButton({
    id: COMMAND_BAR_SEARCH_TOGGLE_ID,
    title: 'Search fields',
    ariaLabel: 'Search fields',
    iconClassName: 'zmdi zmdi-search',
    iconInlineStyle: 'display:block;font-size:20px;line-height:1;text-align:center;font-weight:700;',
    onClick: callbacks.onToggleClick
  })
  toggle.style.border = 'none'
  toggle.style.borderRight = 'none'
  toggle.style.borderRadius = '0'
  toggle.style.background = 'transparent'
  toggle.style.color = '#000000'
  toggle.style.margin = '0'

  const searchMain = document.createElement('div')
  searchMain.id = ids.mainId
  searchMain.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'width:34px',
    'height:34px',
    'border:1px solid #cfd8e6',
    'border-radius:4px',
    'overflow:hidden',
    'background:#ffffff',
    'box-sizing:border-box',
    'transition:border-color 120ms ease'
  ].join(';')

  const modeGroup = document.createElement('div')
  modeGroup.id = ids.modeGroupId
  modeGroup.className = 'md-button-group'
  modeGroup.style.cssText = ['display:none', 'align-items:center', 'gap:0', 'height:34px', 'margin:0'].join(';')

  const input = document.createElement('input')
  input.id = COMMAND_BAR_SEARCH_INPUT_ID
  input.type = 'text'
  input.placeholder = 'Search fields...'
  input.disabled = true
  input.autocomplete = 'off'
  input.style.cssText = [
    'width:0',
    'opacity:0',
    'padding:0',
    'margin-left:0',
    'min-width:0',
    'height:34px',
    'border:none',
    'border-radius:0',
    'outline:none',
    'box-sizing:border-box',
    'font:500 12px/34px Segoe UI,Arial,sans-serif',
    'background:transparent',
    'color:#111827',
    'pointer-events:none',
    'transition:width 140ms ease,opacity 120ms ease,padding 120ms ease,margin-left 120ms ease'
  ].join(';')

  const highlightMode = createSearchModeButton({
    id: ids.highlightModeId,
    title: 'Highlight mode',
    ariaLabel: 'Highlight mode',
    iconClassName: 'zmdi zmdi-storage',
    onClick: () => callbacks.onModeChange('highlight', input.value)
  })

  const filterMode = createSearchModeButton({
    id: ids.filterModeId,
    title: 'Filter mode',
    ariaLabel: 'Filter mode',
    iconClassName: 'zmdi zmdi-filter-list',
    onClick: () => callbacks.onModeChange('filter', input.value)
  })

  input.addEventListener('input', () => {
    callbacks.onInputChange(input.value, document.activeElement === input, searchMain)
  })
  input.addEventListener('focus', () => {
    callbacks.onInputFocus(input.value, searchMain)
  })
  input.addEventListener('blur', () => {
    callbacks.onInputBlur(input.value, searchMain)
  })
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      callbacks.onInputEscape()
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      callbacks.onInputEnter(event.shiftKey)
    }
  })

  modeGroup.appendChild(highlightMode)
  modeGroup.appendChild(filterMode)

  const navigation = createSearchNavigation(ids, createCompactActionButton, callbacks)
  searchMain.appendChild(toggle)
  searchMain.appendChild(modeGroup)
  searchMain.appendChild(input)
  searchWrapper.appendChild(searchMain)
  searchWrapper.appendChild(navigation.nav)

  return {
    searchWrapper,
    searchMain,
    toggle,
    modeGroup,
    highlightMode,
    filterMode,
    input,
    nav: navigation.nav,
    prev: navigation.prev,
    next: navigation.next,
    status: navigation.status
  }
}
