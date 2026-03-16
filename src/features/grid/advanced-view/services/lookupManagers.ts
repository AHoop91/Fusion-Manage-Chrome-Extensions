import { normalizeText } from '../../../../shared/utils/text'
import { createRequestAbortManager } from '../../../../shared/utils/requestAbort'
import {
  fetchLookupOptionsByQuery,
  splitCommaSeparated,
  type LookupSearchPage
} from '../../../../shared/form/lookupOptions'
import { el } from '../view/domBuilder'
import type { LookupOption } from '../types'

export { splitCommaSeparated }

const lookupOptionLinkByInput = new WeakMap<HTMLInputElement, Map<string, string>>()

function joinCommaSeparated(values: string[]): string {
  return values
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .join(',')
}

/**
 * Lookup-chip manager API for rendering and mutating selected values.
 */
export interface LookupChipManager {
  syncState: () => void
  render: () => void
  add: (option: LookupOption) => boolean
  removeAt: (index: number) => void
  setLinks: (links: string[]) => void
  containsLabel: (label: string) => boolean
  getLabels: () => string[]
  getLinks: () => string[]
}

/**
 * Lookup-menu manager API for list rendering, positioning and query scheduling.
 */
export interface LookupMenuManager {
  openMenu: () => void
  closeMenu: () => void
  renderLoading: () => void
  renderOptions: (options: LookupOption[]) => void
  scheduleQuery: (query: string) => void
}

/**
 * Preloads lookup option datasets for unique picklist paths in parallel.
 */
export function preloadLookupOptions(paths: string[]): void {
  const unique = Array.from(
    new Set(
      paths
        .map((path) => String(path || '').trim())
        .filter(Boolean)
    )
  )
  if (unique.length === 0) return
  void Promise.allSettled(unique.map((path) => fetchLookupOptionsByQuery(path, '')))
}

/**
 * Returns option-link map associated with lookup input.
 */
export function getLookupOptionLinkMap(input: HTMLInputElement): Map<string, string> {
  const map = lookupOptionLinkByInput.get(input)
  if (map) return map
  const created = new Map<string, string>()
  lookupOptionLinkByInput.set(input, created)
  return created
}

/**
 * Creates chip state manager for single and multi lookup controls.
 */
export function buildLookupChipManager(options: {
  input: HTMLInputElement
  lookupWrap: HTMLElement | null
  isMultiSelect: boolean
  onChange: () => void
}): LookupChipManager {
  const { input, lookupWrap, isMultiSelect, onChange } = options
  const labelToLink = getLookupOptionLinkMap(input)

  let selectedLabels = isMultiSelect ? splitCommaSeparated(input.dataset.plmLookupCurrentLabel || input.value || '') : []
  let selectedLinks = isMultiSelect ? splitCommaSeparated(input.dataset.plmLookupCurrentLink || '') : []
  const chipRoot = isMultiSelect ? el('div').cls('plm-extension-grid-form-lookup-chips').build() : null

  if (chipRoot && lookupWrap) {
    lookupWrap.classList.add('is-multi')
    lookupWrap.insertBefore(chipRoot, input)
    input.value = ''
  }

  const syncState = (): void => {
    if (!isMultiSelect) return
    if (selectedLinks.length < selectedLabels.length) {
      selectedLinks = [...selectedLinks, ...new Array(selectedLabels.length - selectedLinks.length).fill('')]
    }
    if (selectedLinks.length > selectedLabels.length) {
      selectedLinks = selectedLinks.slice(0, selectedLabels.length)
    }
    input.dataset.plmLookupCurrentLabel = joinCommaSeparated(selectedLabels)
    input.dataset.plmLookupCurrentLink = joinCommaSeparated(selectedLinks)
  }

  const removeAt = (index: number): void => {
    if (!isMultiSelect) return
    selectedLabels.splice(index, 1)
    selectedLinks.splice(index, 1)
    syncState()
    render()
    onChange()
  }

  const setLinks = (links: string[]): void => {
    if (!isMultiSelect) return
    selectedLinks = [...links]
    syncState()
  }

  const render = (): void => {
    if (!chipRoot) return
    chipRoot.textContent = ''
    for (let index = 0; index < selectedLabels.length; index += 1) {
      const label = selectedLabels[index]
      const chipText = el('span').cls('plm-extension-grid-form-lookup-chip-text').text(label).build()
      const chipRemove = el('button')
        .type('button')
        .cls('plm-extension-grid-form-lookup-chip-remove')
        .attr('aria-label', `Remove ${label}`)
        .text('x')
        .on('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          removeAt(index)
        })
        .build()
      const chip = el('span').cls('plm-extension-grid-form-lookup-chip').append(chipText, chipRemove).build()
      chipRoot.appendChild(chip)
    }
  }

  const containsLabel = (label: string): boolean =>
    selectedLabels.some((entry) => normalizeText(entry) === normalizeText(label))

  const add = (option: LookupOption): boolean => {
    if (isMultiSelect) {
      if (containsLabel(option.label)) return false
      selectedLabels.push(option.label)
      selectedLinks.push(option.value)
      labelToLink.set(normalizeText(option.label), option.value)
      syncState()
      render()
      onChange()
      return true
    }
    labelToLink.set(normalizeText(option.label), option.value)
    input.value = option.label
    input.dataset.plmLookupCurrentLabel = option.label
    input.dataset.plmLookupCurrentLink = option.value
    onChange()
    return true
  }

  syncState()
  render()
  return {
    syncState,
    render,
    add,
    removeAt,
    setLinks,
    containsLabel,
    getLabels: () => [...selectedLabels],
    getLinks: () => [...selectedLinks]
  }
}

/**
 * Creates menu lifecycle manager for lookup controls.
 */
export function buildLookupMenuManager(options: {
  input: HTMLInputElement
  menu: HTMLDivElement
  lookupWrap: HTMLElement | null
  picklistPath: string
  isMultiSelect: boolean
  shouldPreload: boolean
  chipManager: LookupChipManager
  onChange: () => void
}): LookupMenuManager {
  const { input, menu, lookupWrap, picklistPath, isMultiSelect, shouldPreload, chipManager, onChange } = options
  const PAGE_SIZE = 100
  const SCROLL_THRESHOLD_PX = 28

  let debounceTimer: number | null = null
  let activeRequestId = 0
  const requestAbort = createRequestAbortManager()
  let loading = false
  let loadingMore = false
  let isMenuPositionListenerBound = false
  let activeQuery = ''
  let totalResults: number | null = null
  let nextOffset = 0
  let hasMore = false
  let shownCount = 0
  const loadedOffsets = new Set<number>()
  const loadedOptions: LookupOption[] = []
  const renderedOptionKeys = new Set<string>()

  const summaryRow = el('div').cls('plm-extension-grid-form-lookup-summary').build()
  const optionsHost = el('div').cls('plm-extension-grid-form-lookup-options').build()
  const clearButton =
    !isMultiSelect && lookupWrap
      ? lookupWrap.querySelector<HTMLButtonElement>('.plm-extension-grid-form-lookup-clear')
      : null
  const loadMoreRow = el('div').cls('plm-extension-grid-form-lookup-loading-more').build()
  loadMoreRow.append(
    el('span').cls('plm-extension-grid-form-lookup-spinner').build(),
    el('span').text('Loading more results...').build()
  )

  const optionKey = (option: LookupOption): string => `${normalizeText(option.label)}::${option.value}`

  const hasSingleValue = (): boolean => {
    const currentInput = String(input.value || '').trim()
    const currentLabel = String(input.dataset.plmLookupCurrentLabel || '').trim()
    const currentLink = String(input.dataset.plmLookupCurrentLink || '').trim()
    return Boolean(currentInput || currentLabel || currentLink)
  }

  const syncSingleValueState = (): void => {
    if (isMultiSelect || !lookupWrap) return
    lookupWrap.classList.toggle('has-value', hasSingleValue())
  }

  const setSummary = (): void => {
    if (totalResults === null) {
      summaryRow.textContent = `${shownCount} result(s) displayed`
      return
    }
    summaryRow.textContent = `${shownCount} result(s) displayed, out of ${totalResults}`
  }

  const createOptionItem = (option: LookupOption): HTMLButtonElement =>
    el('button')
      .type('button')
      .cls('plm-extension-grid-form-lookup-item')
      .text(option.label)
      .on('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        chipManager.add(option)
        syncSingleValueState()
        if (!isMultiSelect) closeMenu()
        else scheduleQuery(input.value || '')
      })
      .build()

  const beginMenuRender = (): void => {
    menu.textContent = ''
    menu.appendChild(summaryRow)
    menu.appendChild(optionsHost)
  }

  const applyVisibleList = (allVisible: LookupOption[]): void => {
    shownCount = allVisible.length
    setSummary()

    optionsHost.textContent = ''
    renderedOptionKeys.clear()
    const labelToLink = getLookupOptionLinkMap(input)

    if (allVisible.length === 0) {
      optionsHost.appendChild(el('div').cls('plm-extension-grid-form-lookup-empty').text('No results').build())
      return
    }

    const fragment = document.createDocumentFragment()
    for (const option of allVisible) {
      const key = optionKey(option)
      if (renderedOptionKeys.has(key)) continue
      renderedOptionKeys.add(key)
      labelToLink.set(normalizeText(option.label), option.value)
      fragment.appendChild(createOptionItem(option))
    }
    optionsHost.appendChild(fragment)
  }

  const getVisibleOptions = (): LookupOption[] => {
    if (!isMultiSelect) return [...loadedOptions]
    return loadedOptions.filter((option) => !chipManager.containsLabel(option.label))
  }

  const renderLoadingMore = (visible: boolean): void => {
    if (visible) {
      if (!loadMoreRow.isConnected) menu.appendChild(loadMoreRow)
      return
    }
    if (loadMoreRow.isConnected) loadMoreRow.remove()
  }

  const renderLoading = (): void => {
    beginMenuRender()
    shownCount = 0
    setSummary()
    const loadingRow = el('div').cls('plm-extension-grid-form-lookup-loading').build()
    const spinner = el('span').cls('plm-extension-grid-form-lookup-spinner').build()
    const text = el('span').text('Loading...').build()
    loadingRow.appendChild(spinner)
    loadingRow.appendChild(text)
    optionsHost.textContent = ''
    optionsHost.appendChild(loadingRow)
    renderLoadingMore(false)
  }

  const renderOptions = (optionsList: LookupOption[]): void => {
    beginMenuRender()
    loadedOptions.length = 0
    loadedOptions.push(...optionsList)
    totalResults = optionsList.length
    applyVisibleList(getVisibleOptions())
    renderLoadingMore(false)
  }

  const positionMenu = (): void => {
    if (!menu.isConnected || !input.isConnected) return
    const rect = input.getBoundingClientRect()
    const belowSpace = window.innerHeight - rect.bottom - 12
    const aboveSpace = rect.top - 12
    const openUp = belowSpace < 220 && aboveSpace > belowSpace
    const maxHeight = Math.max(120, Math.min(300, openUp ? aboveSpace : belowSpace))

    menu.classList.toggle('is-open-up', openUp)
    menu.style.position = 'fixed'
    menu.style.left = `${Math.max(8, Math.round(rect.left))}px`
    menu.style.width = `${Math.max(220, Math.round(rect.width))}px`
    menu.style.right = 'auto'
    menu.style.maxHeight = `${Math.round(maxHeight)}px`
    menu.style.top = openUp ? 'auto' : `${Math.round(rect.bottom + 4)}px`
    menu.style.bottom = openUp ? `${Math.round(window.innerHeight - rect.top + 4)}px` : 'auto'
    menu.style.zIndex = '2147483647'
  }

  const onViewportChange = (): void => {
    if (!menu.classList.contains('is-open')) return
    positionMenu()
  }

  const bindMenuPositionListeners = (): void => {
    if (isMenuPositionListenerBound) return
    isMenuPositionListenerBound = true
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
  }

  const unbindMenuPositionListeners = (): void => {
    if (!isMenuPositionListenerBound) return
    isMenuPositionListenerBound = false
    window.removeEventListener('resize', onViewportChange)
    window.removeEventListener('scroll', onViewportChange, true)
  }

  const openMenu = (): void => {
    menu.classList.add('is-open')
    lookupWrap?.classList.add('is-open')
    positionMenu()
    bindMenuPositionListeners()
  }

  const cancelPendingLookupWork = (): void => {
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer)
      debounceTimer = null
    }
    activeRequestId += 1
    requestAbort.cancel()
    loading = false
    loadingMore = false
    renderLoadingMore(false)
  }

  const closeMenu = (): void => {
    cancelPendingLookupWork()
    menu.classList.remove('is-open')
    menu.classList.remove('is-open-up')
    lookupWrap?.classList.remove('is-open')
    unbindMenuPositionListeners()
    menu.style.position = ''
    menu.style.left = ''
    menu.style.width = ''
    menu.style.right = ''
    menu.style.maxHeight = ''
    menu.style.top = ''
    menu.style.bottom = ''
    menu.style.zIndex = ''
    syncSingleValueState()
  }

  const resetQueryState = (query: string): void => {
    activeQuery = query
    totalResults = null
    nextOffset = 0
    hasMore = false
    shownCount = 0
    loadedOffsets.clear()
    loadedOptions.length = 0
    renderedOptionKeys.clear()
  }

  const mergePage = (page: LookupSearchPage): void => {
    const seen = new Set<string>(loadedOptions.map((option) => optionKey(option)))
    for (const option of page.options) {
      const key = optionKey(option)
      if (seen.has(key)) continue
      seen.add(key)
      loadedOptions.push(option)
    }

    loadedOffsets.add(page.offset)
    nextOffset = page.offset + page.limit
    if (page.total !== null) totalResults = page.total
    hasMore = totalResults !== null ? loadedOptions.length < totalResults : page.options.length >= page.limit
  }

  const runPageQuery = (offset: number): void => {
    if (loading) return
    if (loadedOffsets.has(offset)) return
    loading = true
    loadingMore = offset > 0
    if (loadingMore) renderLoadingMore(true)
    const requestId = activeRequestId
    const signal = requestAbort.createSignal()

    if (offset === 0) {
      renderLoading()
      openMenu()
    }

    void fetchLookupOptionsByQuery(picklistPath, activeQuery, PAGE_SIZE, offset, { signal, useCache: false }).then((page) => {
      if (requestId !== activeRequestId) return
      loading = false
      loadingMore = false
      mergePage(page)
      beginMenuRender()
      applyVisibleList(getVisibleOptions())
      renderLoadingMore(false)
      positionMenu()

      // If list is short and there are more options, load enough to fill viewport.
      if (hasMore && menu.scrollHeight <= menu.clientHeight + 6) {
        runPageQuery(nextOffset)
      }
    })
  }

  const runQuery = (query: string): void => {
    activeRequestId += 1
    requestAbort.cancel()
    resetQueryState(query)
    runPageQuery(0)
    syncSingleValueState()
  }

  const hydrateMissingSelectedLinks = (): void => {
    if (!isMultiSelect) return
    const labels = chipManager.getLabels()
    const links = chipManager.getLinks()
    if (labels.length === 0) return
    if (links.length >= labels.length && links.every((link) => String(link || '').trim())) return

    const nextLinks = [...links]
    if (nextLinks.length < labels.length) {
      nextLinks.push(...new Array(labels.length - nextLinks.length).fill(''))
    }

    void Promise.all(
      labels.map(async (label, index) => {
        if (String(nextLinks[index] || '').trim()) return
        const page = await fetchLookupOptionsByQuery(picklistPath, label, PAGE_SIZE, 0, { useCache: true })
        const normalizedLabel = normalizeText(label)
        const exact = page.options.find((option) => normalizeText(option.label) === normalizedLabel)
        const fallback = page.options[0]
        const resolved = exact || fallback
        if (!resolved) return
        nextLinks[index] = resolved.value
        getLookupOptionLinkMap(input).set(normalizeText(resolved.label), resolved.value)
      })
    ).then(() => {
      chipManager.setLinks(nextLinks)
    })
  }

  const loadNextPage = (): void => {
    if (!menu.classList.contains('is-open')) return
    if (!hasMore || loading) return
    runPageQuery(nextOffset)
  }

  const scheduleQuery = (query: string): void => {
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer)
      debounceTimer = null
    }
    const delay = loading ? 180 : 120
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null
      runQuery(query)
    }, delay)
  }

  const getOpenQuery = (): string => {
    const inputValue = String(input.value || '').trim()
    if (!inputValue) return ''
    const currentLabel = String(input.dataset.plmLookupCurrentLabel || '').trim()
    if (!isMultiSelect && currentLabel && inputValue.toLowerCase() === currentLabel.toLowerCase()) {
      return ''
    }
    return inputValue
  }

  input.addEventListener('click', () => {
    if (menu.classList.contains('is-open')) {
      closeMenu()
      return
    }
    openMenu()
    scheduleQuery(getOpenQuery())
  })
  input.addEventListener('input', () => {
    syncSingleValueState()
    scheduleQuery(input.value || '')
  })
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      openMenu()
      if (!loading) scheduleQuery(input.value || '')
      return
    }
    if (event.key === 'Escape') {
      closeMenu()
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (!menu.classList.contains('is-open')) openMenu()
      if (!loading) scheduleQuery(input.value || '')
    }
  })
  menu.addEventListener('mousedown', (event) => {
    event.preventDefault()
  })
  menu.addEventListener('scroll', () => {
    if (!menu.classList.contains('is-open')) return
    const nearBottom = menu.scrollTop + menu.clientHeight >= menu.scrollHeight - SCROLL_THRESHOLD_PX
    if (!nearBottom) return
    loadNextPage()
  })

  // Preload only when the Advanced Editor is opened and controls are wired.
  if (shouldPreload) preloadLookupOptions([picklistPath])
  hydrateMissingSelectedLinks()
  syncSingleValueState()

  clearButton?.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    closeMenu()
    const defaultLabel = String(input.dataset.plmLookupDefaultLabel || '').trim()
    const defaultLink = String(input.dataset.plmLookupDefaultLink || '').trim()
    input.value = defaultLabel
    input.dataset.plmLookupCurrentLabel = defaultLabel
    input.dataset.plmLookupCurrentLink = defaultLink
    onChange()
    syncSingleValueState()
  })

  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as Node | null
      if (!target) return
      if (lookupWrap?.contains(target) || menu.contains(target)) return
      closeMenu()
    },
    true
  )

  return {
    openMenu,
    closeMenu,
    renderLoading,
    renderOptions,
    scheduleQuery
  }
}

