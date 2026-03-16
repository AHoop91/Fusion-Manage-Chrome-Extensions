import {
  COMMAND_BAR_SEARCH_ID,
  COMMAND_BAR_SEARCH_INPUT_ID,
  COMMAND_BAR_SEARCH_TOGGLE_ID,
  EXTENSION_HIDDEN_ATTR,
  EXTENSION_LIST_HIDDEN_ATTR,
  EXTENSION_LIST_WRAPPER_HIDDEN_ATTR,
  EXTENSION_MATRIX_HIDDEN_ATTR,
  EXTENSION_MATRIX_ROW_HIDDEN_ATTR,
  EXTENSION_ROW_HIDDEN_ATTR,
  FIELD_LIST_SELECTOR,
  FIELD_ROW_SELECTOR,
  FIELD_TITLE_SELECTOR,
  FIELD_VALUE_SELECTOR,
  MATRIX_ROW_NAME_SELECTOR,
  MATRIX_SELECTOR,
  SECTION_HEADER_SELECTOR,
  SECTION_SELECTOR
} from '../item-details.constants'
import type { ItemDetailsRuntime } from '../item-details.types'
import { applySearchWrapperStyles, createSearchDom } from '../view/item-details.search-control.view'
import type { SearchDomRefs } from '../view/item-details.search-control.view'
import type { CompactActionButtonParams } from '../view/item-details.command-bar.view'
import { loadItemDetailsForCurrentPage } from '../services/item-details.data-cache.service'
import {
  buildDomSectionLookups,
  collectFieldSearchCandidates,
  collectMatchedJsonFieldTitlesBySection,
  getCachedItemDataForCurrentPage,
  getMatrixHeaderLabels,
  resolveDomSectionForJsonMatch,
  titleMatchesJsonSearch,
  toSearchableText
} from './searchControlHelpers'
import { ensureStyleTag } from '../../../dom/styles'

type SearchControlDeps = {
  ext: ItemDetailsRuntime
  suspendSearchOverrides: () => void
  resumeSearchOverrides: () => void
  createCompactActionButton: (params: CompactActionButtonParams) => HTMLButtonElement
  getReferenceWrapperClassName: (commandBar: HTMLElement) => string
}

type SearchControlFeature = {
  ensureSearchControl: (commandBar: HTMLElement, anchorWrapper: HTMLElement) => void
  removeSearchControl: () => void
  cleanup: () => void
}

export function createSearchControlFeature({
  ext,
  suspendSearchOverrides,
  resumeSearchOverrides,
  createCompactActionButton,
  getReferenceWrapperClassName
}: SearchControlDeps): SearchControlFeature {
  let searchOutsideClickHandler: ((event: MouseEvent) => void) | null = null
  let searchMatches: HTMLElement[] = []
  let searchMatchSet = new Set<HTMLElement>()
  let activeSearchMatchIndex = -1
  let searchOverridesSuspended = false
  let searchReapplyTimer: number | null = null
  let searchReapplyTerm = ''
  let searchReapplyAttempts = 0
  let suppressOutsideCloseUntil = 0
  let searchMode: 'highlight' | 'filter' = 'highlight'
  let searchDomRefs: SearchDomRefs | null = null

  const SEARCH_CONTROL_GAP_PX = 0
  const SEARCH_EXPANDED_ATTR = 'data-plm-extension-search-expanded'
  const SEARCH_MATCH_ATTR = 'data-plm-extension-search-match'
  const SEARCH_ACTIVE_MATCH_ATTR = 'data-plm-extension-search-active-match'
  const SEARCH_STYLE_ID = 'plm-extension-command-search-style'
  const SEARCH_INPUT_WIDTH_PX = 220
  const SEARCH_MAIN_ID = `${COMMAND_BAR_SEARCH_ID}-main`
  const SEARCH_MODE_GROUP_ID = `${COMMAND_BAR_SEARCH_ID}-mode`
  const SEARCH_MODE_HIGHLIGHT_ID = `${COMMAND_BAR_SEARCH_ID}-mode-highlight`
  const SEARCH_MODE_FILTER_ID = `${COMMAND_BAR_SEARCH_ID}-mode-filter`
  const SEARCH_NAV_ID = `${COMMAND_BAR_SEARCH_ID}-nav`
  const SEARCH_NAV_PREV_ID = `${COMMAND_BAR_SEARCH_ID}-prev`
  const SEARCH_NAV_NEXT_ID = `${COMMAND_BAR_SEARCH_ID}-next`
  const SEARCH_NAV_STATUS_ID = `${COMMAND_BAR_SEARCH_ID}-status`
  const SEARCH_REVEAL_ATTR = 'data-plm-extension-search-revealed'
  const SEARCH_REVEAL_PREV_DISPLAY_ATTR = 'data-plm-extension-search-revealed-prev-display'
  const SEARCH_FILTER_HIDDEN_ATTR = 'data-plm-extension-search-filter-hidden'
  const SEARCH_FILTER_PREV_DISPLAY_ATTR = 'data-plm-extension-search-filter-prev-display'

  function resolveSearchDomRefs(): SearchDomRefs | null {
    const searchWrapper = ext.findByIdDeep(document, COMMAND_BAR_SEARCH_ID) as HTMLElement | null
    const searchMain = ext.findByIdDeep(document, SEARCH_MAIN_ID) as HTMLElement | null
    const toggle = ext.findByIdDeep(document, COMMAND_BAR_SEARCH_TOGGLE_ID) as HTMLButtonElement | null
    const modeGroup = ext.findByIdDeep(document, SEARCH_MODE_GROUP_ID) as HTMLElement | null
    const highlightMode = ext.findByIdDeep(document, SEARCH_MODE_HIGHLIGHT_ID) as HTMLButtonElement | null
    const filterMode = ext.findByIdDeep(document, SEARCH_MODE_FILTER_ID) as HTMLButtonElement | null
    const input = ext.findByIdDeep(document, COMMAND_BAR_SEARCH_INPUT_ID) as HTMLInputElement | null
    const nav = ext.findByIdDeep(document, SEARCH_NAV_ID) as HTMLElement | null
    const prev = ext.findByIdDeep(document, SEARCH_NAV_PREV_ID) as HTMLButtonElement | null
    const next = ext.findByIdDeep(document, SEARCH_NAV_NEXT_ID) as HTMLButtonElement | null
    const status = ext.findByIdDeep(document, SEARCH_NAV_STATUS_ID) as HTMLElement | null

    if (
      !searchWrapper ||
      !searchMain ||
      !toggle ||
      !modeGroup ||
      !highlightMode ||
      !filterMode ||
      !input ||
      !nav ||
      !prev ||
      !next ||
      !status
    ) {
      return null
    }

    return {
      searchWrapper,
      searchMain,
      toggle,
      modeGroup,
      highlightMode,
      filterMode,
      input,
      nav,
      prev,
      next,
      status
    }
  }

  function getSearchDomRefs(): SearchDomRefs | null {
    if (searchDomRefs && searchDomRefs.searchWrapper.isConnected) return searchDomRefs
    searchDomRefs = resolveSearchDomRefs()
    return searchDomRefs
  }

  function suspendForSearchIfNeeded(): void {
    if (searchOverridesSuspended) return
    suspendSearchOverrides()
    searchOverridesSuspended = true
  }

  function resumeAfterSearchIfNeeded(): void {
    if (!searchOverridesSuspended) return
    resumeSearchOverrides()
    searchOverridesSuspended = false
  }

  function stopSearchOutsideClickHandler(): void {
    if (!searchOutsideClickHandler) return
    document.removeEventListener('click', searchOutsideClickHandler, true)
    searchOutsideClickHandler = null
  }

  function suppressOutsideCloseFor(ms: number): void {
    const until = Date.now() + Math.max(0, ms)
    if (until > suppressOutsideCloseUntil) {
      suppressOutsideCloseUntil = until
    }
  }

  function stopSearchReapplyTimer(): void {
    if (searchReapplyTimer !== null) {
      window.clearTimeout(searchReapplyTimer)
      searchReapplyTimer = null
    }
  }

  function startSearchOutsideClickHandler(searchWrapper: HTMLElement): void {
    stopSearchOutsideClickHandler()
    searchOutsideClickHandler = (event: MouseEvent) => {
      if (Date.now() < suppressOutsideCloseUntil) return
      const target = event.target as Node | null
      if (target && searchWrapper.contains(target)) return
      setSearchExpanded(false)
    }

    // Delay registration to avoid closing immediately from the opening click.
    window.setTimeout(() => {
      if (!searchOutsideClickHandler) return
      document.addEventListener('click', searchOutsideClickHandler as EventListener, true)
    }, 0)
  }

  function ensureSearchHighlightStyle(): void {
    ensureStyleTag(SEARCH_STYLE_ID, [
      `[${SEARCH_MATCH_ATTR}="1"]{background:rgba(25,146,206,0.12)!important;box-shadow:inset 0 0 0 1px rgba(25,146,206,0.45)!important;border-radius:8px;}`,
      `[${SEARCH_ACTIVE_MATCH_ATTR}="1"]{background:rgba(25,146,206,0.2)!important;box-shadow:inset 0 0 0 2px rgba(25,146,206,0.7)!important;border-radius:8px;}`,
      `tr[${SEARCH_MATCH_ATTR}="1"]>td{background:rgba(25,146,206,0.1)!important;box-shadow:inset 0 -1px 0 rgba(25,146,206,0.2)!important;}`,
      `tr[${SEARCH_ACTIVE_MATCH_ATTR}="1"]>td{background:rgba(25,146,206,0.18)!important;box-shadow:inset 0 -1px 0 rgba(25,146,206,0.35)!important;}`,
      `tr[${SEARCH_MATCH_ATTR}="1"]>td:first-child,tr[${SEARCH_ACTIVE_MATCH_ATTR}="1"]>td:first-child{border-top-left-radius:8px;border-bottom-left-radius:8px;}`,
      `tr[${SEARCH_MATCH_ATTR}="1"]>td:last-child,tr[${SEARCH_ACTIVE_MATCH_ATTR}="1"]>td:last-child{border-top-right-radius:8px;border-bottom-right-radius:8px;}`
    ].join(''))
  }

  function clearSearchHighlights(): void {
    const highlighted = Array.from(
      document.querySelectorAll(`[${SEARCH_MATCH_ATTR}="1"],[${SEARCH_ACTIVE_MATCH_ATTR}="1"]`)
    ) as HTMLElement[]

    for (const node of highlighted) {
      node.removeAttribute(SEARCH_MATCH_ATTR)
      node.removeAttribute(SEARCH_ACTIVE_MATCH_ATTR)
    }

    searchMatches = []
    searchMatchSet.clear()
    activeSearchMatchIndex = -1
  }

  function addSearchMatch(target: HTMLElement): boolean {
    if (searchMatchSet.has(target)) return false
    searchMatchSet.add(target)
    searchMatches.push(target)
    return true
  }

  function clearSearchFiltering(): void {
    const revealedNodes = Array.from(document.querySelectorAll(`[${SEARCH_REVEAL_ATTR}="1"]`)) as HTMLElement[]
    for (const node of revealedNodes) {
      restoreSearchRevealedDisplay(node)
    }

    // Backward-compat cleanup for older in-flight filtering attributes.
    const staleNodes = Array.from(document.querySelectorAll(`[${SEARCH_FILTER_HIDDEN_ATTR}="1"]`)) as HTMLElement[]
    for (const node of staleNodes) {
      const previousDisplay = node.getAttribute(SEARCH_FILTER_PREV_DISPLAY_ATTR) || ''
      if (previousDisplay) {
        node.style.display = previousDisplay
      } else {
        node.style.removeProperty('display')
      }
      node.removeAttribute(SEARCH_FILTER_HIDDEN_ATTR)
      node.removeAttribute(SEARCH_FILTER_PREV_DISPLAY_ATTR)
    }
  }

  function setSearchFilteredHidden(target: HTMLElement, hidden: boolean): void {
    if (hidden) {
      if (!target.hasAttribute(SEARCH_FILTER_HIDDEN_ATTR)) {
        target.setAttribute(SEARCH_FILTER_PREV_DISPLAY_ATTR, target.style.display || '')
        target.setAttribute(SEARCH_FILTER_HIDDEN_ATTR, '1')
      }
      target.style.display = 'none'
      return
    }

    if (!target.hasAttribute(SEARCH_FILTER_HIDDEN_ATTR)) return
    const previousDisplay = target.getAttribute(SEARCH_FILTER_PREV_DISPLAY_ATTR) || ''
    if (previousDisplay) {
      target.style.display = previousDisplay
    } else {
      target.style.removeProperty('display')
    }
    target.removeAttribute(SEARCH_FILTER_HIDDEN_ATTR)
    target.removeAttribute(SEARCH_FILTER_PREV_DISPLAY_ATTR)
  }

  function markSearchRevealedVisible(target: HTMLElement): void {
    if (!target.hasAttribute(SEARCH_REVEAL_ATTR)) {
      target.setAttribute(SEARCH_REVEAL_PREV_DISPLAY_ATTR, target.style.display || '')
      target.setAttribute(SEARCH_REVEAL_ATTR, '1')
    }
    target.style.removeProperty('display')
  }

  function restoreSearchRevealedDisplay(target: HTMLElement): void {
    const previousDisplay = target.getAttribute(SEARCH_REVEAL_PREV_DISPLAY_ATTR) || ''
    if (previousDisplay) {
      target.style.display = previousDisplay
    } else {
      target.style.removeProperty('display')
    }
    target.removeAttribute(SEARCH_REVEAL_ATTR)
    target.removeAttribute(SEARCH_REVEAL_PREV_DISPLAY_ATTR)
  }

  function revealHideEmptyFieldRowForSearch(row: HTMLElement): void {
    if (row.hasAttribute(EXTENSION_ROW_HIDDEN_ATTR)) {
      markSearchRevealedVisible(row)
    }

    const titleCell = row.querySelector(FIELD_TITLE_SELECTOR) as HTMLElement | null
    if (titleCell?.hasAttribute(EXTENSION_HIDDEN_ATTR)) {
      markSearchRevealedVisible(titleCell)
    }

    const valueCell = row.querySelector(FIELD_VALUE_SELECTOR) as HTMLElement | null
    if (valueCell?.hasAttribute(EXTENSION_HIDDEN_ATTR)) {
      markSearchRevealedVisible(valueCell)
    }

    const fieldList = row.closest(FIELD_LIST_SELECTOR) as HTMLElement | null
    if (fieldList?.hasAttribute(EXTENSION_LIST_HIDDEN_ATTR)) {
      markSearchRevealedVisible(fieldList)
    }

    const listWrapper = fieldList?.parentElement as HTMLElement | null
    if (listWrapper?.hasAttribute(EXTENSION_LIST_WRAPPER_HIDDEN_ATTR)) {
      markSearchRevealedVisible(listWrapper)
    }
  }

  function revealHideEmptyMatrixCellForSearch(cell: HTMLElement): void {
    const row = cell.closest('tr') as HTMLElement | null
    if (row?.hasAttribute(EXTENSION_MATRIX_ROW_HIDDEN_ATTR)) {
      markSearchRevealedVisible(row)
    }

    const matrix = cell.closest(MATRIX_SELECTOR) as HTMLElement | null
    if (matrix?.hasAttribute(EXTENSION_MATRIX_HIDDEN_ATTR)) {
      markSearchRevealedVisible(matrix)
    }
  }

  function setActiveSearchMatch(index: number): void {
    if (searchMatches.length === 0) {
      activeSearchMatchIndex = -1
      updateSearchNavigationState(true)
      return
    }

    for (const target of searchMatches) {
      target.removeAttribute(SEARCH_ACTIVE_MATCH_ATTR)
    }

    const safeIndex = ((index % searchMatches.length) + searchMatches.length) % searchMatches.length
    activeSearchMatchIndex = safeIndex
    const activeTarget = searchMatches[safeIndex]
    activeTarget.setAttribute(SEARCH_ACTIVE_MATCH_ATTR, '1')
    if (ensureMatchSectionExpanded(activeTarget)) {
      scheduleSearchReapply(searchReapplyTerm)
    }
    updateSearchNavigationState(true)
  }

  function focusSearchMatch(index: number): void {
    if (searchMatches.length === 0) return

    setActiveSearchMatch(index)
    const target = searchMatches[activeSearchMatchIndex]

    window.setTimeout(() => {
      if (!target.isConnected) return
      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    }, 140)
  }

  function setButtonEnabled(button: HTMLButtonElement | null, enabled: boolean): void {
    if (!button) return
    button.disabled = !enabled
    button.style.opacity = enabled ? '1' : '0.45'
    button.style.cursor = enabled ? 'pointer' : 'default'
  }

  function updateSearchNavigationState(hasTerm: boolean): void {
    const refs = getSearchDomRefs()
    if (!refs) return
    const { nav, prev, next, status } = refs

    if (!hasTerm) {
      nav.style.display = 'none'
      status.textContent = ''
      setButtonEnabled(prev, false)
      setButtonEnabled(next, false)
      return
    }

    const total = searchMatches.length
    const active = activeSearchMatchIndex >= 0 ? activeSearchMatchIndex + 1 : 0
    status.textContent = total > 0 ? `${active} of ${total}` : '0 of 0'
    nav.style.display = 'inline-flex'
    const hasMatches = total > 0
    setButtonEnabled(prev, hasMatches)
    setButtonEnabled(next, hasMatches)
  }

  function findCollapsedSectionToggle(section: HTMLElement): HTMLElement | null {
    const collapsedSelectors = [
      `${SECTION_HEADER_SELECTOR}[aria-expanded="false"]`,
      `${SECTION_HEADER_SELECTOR} [aria-expanded="false"]`,
      '.MuiExpansionPanelSummary-root[aria-expanded="false"]',
      '[aria-expanded="false"]'
    ]

    for (const selector of collapsedSelectors) {
      const toggle = section.querySelector(selector) as HTMLElement | null
      if (toggle) return toggle
    }

    return null
  }

  function expandSectionIfClosed(section: HTMLElement): boolean {
    const toggle = findCollapsedSectionToggle(section)
    if (!toggle) return false

    // Prevent our own synthetic click from closing search via outside-click handler.
    suppressOutsideCloseFor(250)
    try {
      toggle.click()
    } catch {
      toggle.dispatchEvent(
        new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        })
      )
    }

    return true
  }

  function ensureMatchSectionExpanded(target: HTMLElement): boolean {
    const section = target.closest(SECTION_SELECTOR) as HTMLElement | null
    if (!section) return false
    return expandSectionIfClosed(section)
  }

  function applyApiJsonFieldSearch(term: string): {
    usedApi: boolean
    expandedClosedSection: boolean
    hasJsonMatches: boolean
    hasDomSectionMatch: boolean
  } {
    const itemData = getCachedItemDataForCurrentPage()
    if (!itemData) {
      void loadItemDetailsForCurrentPage(ext).then((loaded) => {
        if (!loaded) return
        const refs = getSearchDomRefs()
        if (!refs) return
        const currentTerm = toSearchableText(refs.input.value)
        if (!currentTerm || currentTerm !== term) return
        applyFieldSearch(refs.input.value)
      })
      return { usedApi: false, expandedClosedSection: false, hasJsonMatches: false, hasDomSectionMatch: false }
    }

    const sectionMatches = collectMatchedJsonFieldTitlesBySection(itemData, term)
    if (!sectionMatches)
      return { usedApi: false, expandedClosedSection: false, hasJsonMatches: false, hasDomSectionMatch: false }

    const domSectionLookups = buildDomSectionLookups()
    let expandedClosedSection = false
    let hasDomSectionMatch = false

    for (const sectionMatch of sectionMatches) {
      const domSection = resolveDomSectionForJsonMatch(sectionMatch, domSectionLookups)
      if (!domSection) continue
      hasDomSectionMatch = true
      if (expandSectionIfClosed(domSection)) {
        expandedClosedSection = true
      }

      const sectionRows = Array.from(domSection.querySelectorAll(FIELD_ROW_SELECTOR)) as HTMLElement[]
      const sectionCandidates = collectFieldSearchCandidates(sectionRows)

      for (const candidate of sectionCandidates) {
        if (!titleMatchesJsonSearch(candidate.searchableText, sectionMatch.matchedTitleKeys)) continue
        if (!addSearchMatch(candidate.target)) continue
        candidate.target.setAttribute(SEARCH_MATCH_ATTR, '1')
        revealHideEmptyFieldRowForSearch(candidate.container)
      }
    }

    return {
      usedApi: true,
      expandedClosedSection,
      hasJsonMatches: sectionMatches.length > 0,
      hasDomSectionMatch
    }
  }

  function scheduleSearchReapply(term: string): void {
    if (searchReapplyAttempts >= 2) return
    stopSearchReapplyTimer()
    searchReapplyTerm = term
    searchReapplyAttempts += 1
    searchReapplyTimer = window.setTimeout(() => {
      searchReapplyTimer = null
      const refs = getSearchDomRefs()
      if (!refs) return
      const { input } = refs
      const currentTerm = toSearchableText(input.value)
      if (!currentTerm || currentTerm !== searchReapplyTerm) return
      applyFieldSearch(input.value)
    }, 170)
  }

  function updateSearchModeUi(): void {
    const refs = getSearchDomRefs()
    if (!refs) return
    const buttons = [refs.highlightMode, refs.filterMode]
    for (const button of buttons) {
      if (!button) continue
      const isActive =
        (button.id === SEARCH_MODE_HIGHLIGHT_ID && searchMode === 'highlight') ||
        (button.id === SEARCH_MODE_FILTER_ID && searchMode === 'filter')
      button.style.background = isActive ? 'rgb(6, 150, 215)' : 'transparent'
      button.style.color = isActive ? '#ffffff' : '#475569'
      button.style.fontWeight = isActive ? '700' : '600'
    }
  }

  function applyFilterModeVisibility(): void {
    if (searchMode !== 'filter') {
      clearSearchFiltering()
      return
    }

    const matchedFieldRows = new Set<HTMLElement>()
    const matchedMatrixRows = new Set<HTMLElement>()

    for (const match of searchMatches) {
      const fieldRow = match.closest(FIELD_ROW_SELECTOR) as HTMLElement | null
      if (fieldRow) matchedFieldRows.add(fieldRow)

      const matrixRow = match.closest('tbody > tr') as HTMLElement | null
      if (matrixRow && matrixRow.closest(MATRIX_SELECTOR)) {
        matchedMatrixRows.add(matrixRow)
      }
    }

    const fieldRows = Array.from(document.querySelectorAll(FIELD_ROW_SELECTOR)) as HTMLElement[]
    for (const row of fieldRows) {
      setSearchFilteredHidden(row, !matchedFieldRows.has(row))
    }

    const matrixRows = Array.from(document.querySelectorAll(`${MATRIX_SELECTOR} tbody > tr`)) as HTMLElement[]
    for (const row of matrixRows) {
      setSearchFilteredHidden(row, !matchedMatrixRows.has(row))
    }

    const sections = Array.from(document.querySelectorAll(SECTION_SELECTOR)) as HTMLElement[]
    for (const section of sections) {
      const hasVisibleFieldRows = Array.from(section.querySelectorAll(FIELD_ROW_SELECTOR)).some(
        (row) => !(row as HTMLElement).hasAttribute(SEARCH_FILTER_HIDDEN_ATTR)
      )
      const hasVisibleMatrixRows = Array.from(section.querySelectorAll(`${MATRIX_SELECTOR} tbody > tr`)).some(
        (row) => !(row as HTMLElement).hasAttribute(SEARCH_FILTER_HIDDEN_ATTR)
      )
      setSearchFilteredHidden(section, !hasVisibleFieldRows && !hasVisibleMatrixRows)
    }
  }

  function applyMatrixSearch(term: string): void {
    const matrices = Array.from(document.querySelectorAll(MATRIX_SELECTOR)) as HTMLElement[]

    for (const matrix of matrices) {
      const headerLabels = getMatrixHeaderLabels(matrix)
      const matchedColumnIndexes = new Set<number>()

      for (let columnIndex = 0; columnIndex < headerLabels.length; columnIndex += 1) {
        const label = headerLabels[columnIndex]
        if (!label) continue
        if (label.includes(term)) {
          matchedColumnIndexes.add(columnIndex)
        }
      }

      const rows = Array.from(matrix.querySelectorAll('tbody > tr')) as HTMLElement[]
      const matchedCells = new Set<HTMLElement>()

      const markMatrixCellMatch = (cell: HTMLElement): void => {
        if (matchedCells.has(cell)) return
        matchedCells.add(cell)
        if (!addSearchMatch(cell)) return
        cell.setAttribute(SEARCH_MATCH_ATTR, '1')
        revealHideEmptyMatrixCellForSearch(cell)
      }

      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll(':scope > td')) as HTMLElement[]
        const rowNameCell = row.querySelector(MATRIX_ROW_NAME_SELECTOR) as HTMLElement | null
        const rowLabelText = toSearchableText(rowNameCell?.textContent || cells[0]?.textContent || '')
        const rowMatches = Boolean(rowLabelText && rowLabelText.includes(term))

        if (rowMatches) {
          const targetCell = rowNameCell || cells[0] || null
          if (targetCell) {
            markMatrixCellMatch(targetCell)
          }
        }

        for (const columnIndex of matchedColumnIndexes) {
          const cell = cells[columnIndex]
          if (!cell) continue
          markMatrixCellMatch(cell)
        }
      }
    }
  }

  function applyFieldSearch(rawTerm: string): void {
    const term = toSearchableText(rawTerm)
    if (term !== searchReapplyTerm) {
      searchReapplyAttempts = 0
      searchReapplyTerm = term
    }

    clearSearchFiltering()
    clearSearchHighlights()
    if (!term) {
      resetSearchReapplyState()
      updateSearchNavigationState(false)
      return
    }

    ensureSearchHighlightStyle()
    const apiResult = applyApiJsonFieldSearch(term)
    const shouldUseDomFallback =
      !apiResult.usedApi || !apiResult.hasJsonMatches || !apiResult.hasDomSectionMatch
    if (searchMatches.length === 0 && shouldUseDomFallback) {
      const fieldRows = Array.from(document.querySelectorAll(FIELD_ROW_SELECTOR)) as HTMLElement[]
      const fieldCandidates = collectFieldSearchCandidates(fieldRows)

      for (const candidate of fieldCandidates) {
        const isMatch = candidate.searchableText.includes(term)
        if (!isMatch) continue
        if (!addSearchMatch(candidate.target)) continue
        candidate.target.setAttribute(SEARCH_MATCH_ATTR, '1')
        revealHideEmptyFieldRowForSearch(candidate.container)
      }
    }

    if (apiResult.usedApi && apiResult.expandedClosedSection) {
      scheduleSearchReapply(term)
    } else {
      stopSearchReapplyTimer()
      if (searchMatches.length > 0) {
        searchReapplyAttempts = 0
      }
    }

    applyMatrixSearch(term)
    applyFilterModeVisibility()

    if (searchMatches.length > 0) {
      setActiveSearchMatch(0)
    } else {
      updateSearchNavigationState(true)
    }
  }

  function resetSearchReapplyState(): void {
    stopSearchReapplyTimer()
    searchReapplyAttempts = 0
    searchReapplyTerm = ''
  }

  function applyExpandedSearchUi(refs: SearchDomRefs): void {
    refs.searchWrapper.setAttribute(SEARCH_EXPANDED_ATTR, '1')
    refs.input.disabled = false
    refs.input.style.width = `${SEARCH_INPUT_WIDTH_PX}px`
    refs.input.style.flex = '0 0 auto'
    refs.input.style.opacity = '1'
    refs.input.style.padding = '0 8px'
    refs.input.style.marginLeft = '0'
    refs.input.style.pointerEvents = 'auto'
    refs.searchMain.style.width = 'auto'
    refs.searchMain.style.borderColor = '#2563eb'
    refs.toggle.style.borderRight = '1px solid #e2e8f0'
    refs.modeGroup.style.display = 'inline-flex'
  }

  function applyCollapsedSearchUi(refs: SearchDomRefs): void {
    refs.searchWrapper.setAttribute(SEARCH_EXPANDED_ATTR, '0')
    refs.input.value = ''
    refs.input.blur()
    refs.input.disabled = true
    refs.input.style.width = '0px'
    refs.input.style.flex = '0 0 0px'
    refs.input.style.opacity = '0'
    refs.input.style.padding = '0'
    refs.input.style.marginLeft = '0'
    refs.input.style.pointerEvents = 'none'
    refs.searchMain.style.width = '34px'
    refs.searchMain.style.borderColor = '#cfd8e6'
    refs.toggle.style.borderRight = 'none'
    refs.modeGroup.style.display = 'none'
  }

  function setSearchExpanded(expanded: boolean): void {
    const refs = getSearchDomRefs()
    if (!refs) return

    if (expanded) {
      suspendForSearchIfNeeded()
      applyExpandedSearchUi(refs)
      refs.input.focus()
      refs.input.select()
      if (refs.input.value) {
        applyFieldSearch(refs.input.value)
      } else {
        updateSearchNavigationState(false)
      }
      startSearchOutsideClickHandler(refs.searchWrapper)
      return
    }

    applyCollapsedSearchUi(refs)
    updateSearchNavigationState(false)
    stopSearchOutsideClickHandler()
    resetSearchReapplyState()
    clearSearchFiltering()
    clearSearchHighlights()
    resumeAfterSearchIfNeeded()
  }

  function ensureSearchControl(commandBar: HTMLElement, anchorWrapper: HTMLElement): void {
    let searchWrapper = ext.findByIdDeep(commandBar, COMMAND_BAR_SEARCH_ID) as HTMLElement | null
    if (searchWrapper && !getSearchDomRefs()) {
      searchWrapper.remove()
      searchDomRefs = null
      searchWrapper = null
    }

    if (!searchWrapper) {
      searchWrapper = document.createElement('div')
      searchWrapper.id = COMMAND_BAR_SEARCH_ID
      searchWrapper.className = getReferenceWrapperClassName(commandBar)
      applySearchWrapperStyles(searchWrapper, SEARCH_CONTROL_GAP_PX)
      searchWrapper.setAttribute(SEARCH_EXPANDED_ATTR, '0')
      searchDomRefs = createSearchDom({
        searchWrapper,
        ids: {
          mainId: SEARCH_MAIN_ID,
          modeGroupId: SEARCH_MODE_GROUP_ID,
          highlightModeId: SEARCH_MODE_HIGHLIGHT_ID,
          filterModeId: SEARCH_MODE_FILTER_ID,
          navId: SEARCH_NAV_ID,
          prevId: SEARCH_NAV_PREV_ID,
          nextId: SEARCH_NAV_NEXT_ID,
          statusId: SEARCH_NAV_STATUS_ID
        },
        createCompactActionButton,
        callbacks: {
          onToggleClick: () => {
            const expanded = searchWrapper?.getAttribute(SEARCH_EXPANDED_ATTR) === '1'
            setSearchExpanded(!expanded)
          },
          onModeChange: (mode, inputValue) => {
            searchMode = mode
            updateSearchModeUi()
            applyFieldSearch(inputValue)
          },
          onInputChange: (value, isFocused, searchMain) => {
            applyFieldSearch(value)
            if (!isFocused) {
              searchMain.style.borderColor = value ? '#94a3b8' : '#cfd8e6'
            }
          },
          onInputFocus: (_value, searchMain) => {
            searchMain.style.borderColor = '#2563eb'
          },
          onInputBlur: (value, searchMain) => {
            searchMain.style.borderColor = value ? '#94a3b8' : '#cfd8e6'
          },
          onInputEscape: () => {
            setSearchExpanded(false)
          },
          onInputEnter: (shiftKey) => {
            if (searchMatches.length === 0) return
            const nextIndex = shiftKey ? activeSearchMatchIndex - 1 : activeSearchMatchIndex + 1
            focusSearchMatch(nextIndex)
          },
          onPrevClick: () => {
            if (searchMatches.length === 0) return
            focusSearchMatch(activeSearchMatchIndex - 1)
          },
          onNextClick: () => {
            if (searchMatches.length === 0) return
            focusSearchMatch(activeSearchMatchIndex + 1)
          }
        }
      })
      commandBar.appendChild(searchWrapper)
      setButtonEnabled(searchDomRefs.prev, false)
      setButtonEnabled(searchDomRefs.next, false)
      updateSearchModeUi()
    } else {
      searchWrapper.className = getReferenceWrapperClassName(commandBar)
      applySearchWrapperStyles(searchWrapper, SEARCH_CONTROL_GAP_PX)
    }

    const desiredSibling = anchorWrapper.nextSibling
    if (searchWrapper.parentElement !== commandBar) {
      commandBar.appendChild(searchWrapper)
    }
    if (searchWrapper !== desiredSibling) {
      commandBar.insertBefore(searchWrapper, desiredSibling)
    }
  }

  function removeSearchControl(): void {
    const search = ext.findByIdDeep(document, COMMAND_BAR_SEARCH_ID)
    if (search) search.remove()
    searchDomRefs = null
    stopSearchOutsideClickHandler()
    resetSearchReapplyState()
    clearSearchFiltering()
    clearSearchHighlights()
    resumeAfterSearchIfNeeded()
  }

  function cleanup(): void {
    removeSearchControl()
  }

  return {
    ensureSearchControl,
    removeSearchControl,
    cleanup
  }
}
