import {
  DEFAULT_OPTIONS,
  EXTENSION_CONTENT_COMPACT_ATTR,
  EXTENSION_HIDDEN_ATTR,
  EXTENSION_LIST_HIDDEN_ATTR,
  EXTENSION_LIST_WRAPPER_HIDDEN_ATTR,
  EXTENSION_MATRIX_HIDDEN_ATTR,
  EXTENSION_MATRIX_ROW_HIDDEN_ATTR,
  EXTENSION_ROW_HIDDEN_ATTR,
  EXTENSION_SECTION_HIDDEN_COUNT_ATTR,
  FIELD_LIST_SELECTOR,
  FIELD_ROW_SELECTOR,
  FIELD_TITLE_SELECTOR,
  FIELD_VALUE_SELECTOR,
  MATRIX_ROW_NAME_SELECTOR,
  MATRIX_ROW_SELECTOR,
  MATRIX_SELECTOR,
  OPTIONS_STORAGE_KEY,
  SECTION_BANNER_SELECTOR,
  SECTION_HEADER_SELECTOR,
  SECTION_CONTENT_SELECTOR,
  SECTION_SELECTOR
} from './item-details.constants'
import type { ItemDetailsRuntime } from './item-details.types'
import { normalizeText } from './item-details.utils'
import { ensureStyleTag } from '../../dom/styles'

type HideEmptyFeature = {
  isEnabled: () => boolean
  setEnabled: (next: boolean) => Promise<void>
  sync: () => Promise<void>
  scheduleApply: () => void
  suspendForSearch: () => void
  resumeFromSearch: () => void
  cleanup: () => void
}

export function createHideEmptyFeature(ext: ItemDetailsRuntime): HideEmptyFeature {
  let hideEmptyObserver: MutationObserver | null = null
  let fieldRowsPresenceObserver: MutationObserver | null = null
  let hideEmptyApplyTimer: number | null = null
  let hideEmptyFollowUpTimer: number | null = null
  let collapseHeightSyncRaf: number | null = null
  let hideEmptyFieldsEnabled = false
  let hideEmptyFieldsLoaded = false
  let hideEmptySuspendedForSearch = false
  let restoreHideEmptyAfterSearch = false
  let sectionCountCache = new WeakMap<HTMLElement, { visible: number; total: number }>()
  const SECTION_COUNT_VISIBILITY_STYLE_ID = 'plm-extension-section-count-visibility-style'
  const APPLY_DEBOUNCE_MS = 80
  const FOLLOW_UP_APPLY_MS = 180

  function isEnabled(): boolean {
    return hideEmptyFieldsEnabled
  }

  function resetSectionCountCache(): void {
    sectionCountCache = new WeakMap<HTMLElement, { visible: number; total: number }>()
  }

  function ensureSectionCountVisibilityStyle(): void {
    ensureStyleTag(
      SECTION_COUNT_VISIBILITY_STYLE_ID,
      `[name="section-header"][aria-expanded="false"] [${EXTENSION_SECTION_HIDDEN_COUNT_ATTR}="1"]{display:none!important;}`
    )
  }

  async function loadSetting(): Promise<void> {
    const options = await ext.getLocalOptions(OPTIONS_STORAGE_KEY, DEFAULT_OPTIONS)
    hideEmptyFieldsEnabled = Boolean(options.hideEmptyFields)
    hideEmptyFieldsLoaded = true
  }

  async function setEnabled(next: boolean): Promise<void> {
    const current = await ext.getLocalOptions(OPTIONS_STORAGE_KEY, DEFAULT_OPTIONS)
    await ext.setLocalOptions(OPTIONS_STORAGE_KEY, {
      ...current,
      hideEmptyFields: next
    })
    hideEmptyFieldsEnabled = next
    hideEmptyFieldsLoaded = true
    resetSectionCountCache()

    if (hideEmptySuspendedForSearch) {
      restoreHideEmptyAfterSearch = next
      applyHideEmptyFields(false)
      return
    }

    await sync()
  }

  function isRowValueEmpty(row: HTMLElement): boolean {
    const valueCell = row.querySelector(FIELD_VALUE_SELECTOR) as HTMLElement | null
    if (!valueCell) return false
    return isValueContainerEmpty(valueCell)
  }

  function isValueContainerEmpty(valueCell: HTMLElement): boolean {
    if (valueCell.querySelector('input, textarea, select, [contenteditable="true"]')) return false
    if (valueCell.querySelector('img, svg, canvas, video, audio, iframe')) return false
    return normalizeText(valueCell.textContent || '').length === 0
  }

  function setRowSpansHidden(row: HTMLElement, hidden: boolean): boolean {
    let changed = false
    const title = row.querySelector(FIELD_TITLE_SELECTOR) as HTMLElement | null
    const value = row.querySelector(FIELD_VALUE_SELECTOR) as HTMLElement | null
    const targets = [title, value].filter(Boolean) as HTMLElement[]
    if (targets.length === 0) return false

    for (const target of targets) {
      if (hidden) {
        if (target.style.display !== 'none' || !target.hasAttribute(EXTENSION_HIDDEN_ATTR)) {
          target.style.display = 'none'
          target.setAttribute(EXTENSION_HIDDEN_ATTR, '1')
          changed = true
        }
      } else if (target.hasAttribute(EXTENSION_HIDDEN_ATTR)) {
        target.style.removeProperty('display')
        target.removeAttribute(EXTENSION_HIDDEN_ATTR)
        changed = true
      }
    }

    if (hidden) {
      if (row.style.display !== 'none' || !row.hasAttribute(EXTENSION_ROW_HIDDEN_ATTR)) {
        row.style.display = 'none'
        row.setAttribute(EXTENSION_ROW_HIDDEN_ATTR, '1')
        changed = true
      }
    } else if (row.hasAttribute(EXTENSION_ROW_HIDDEN_ATTR)) {
      row.style.removeProperty('display')
      row.removeAttribute(EXTENSION_ROW_HIDDEN_ATTR)
      changed = true
    }
    return changed
  }

  function isRowHiddenByExtension(row: HTMLElement): boolean {
    const title = row.querySelector(FIELD_TITLE_SELECTOR) as HTMLElement | null
    const value = row.querySelector(FIELD_VALUE_SELECTOR) as HTMLElement | null
    return Boolean(title && value && title.hasAttribute(EXTENSION_HIDDEN_ATTR) && value.hasAttribute(EXTENSION_HIDDEN_ATTR))
  }

  function setMatrixRowHidden(row: HTMLElement, hidden: boolean): boolean {
    if (hidden) {
      if (row.style.display !== 'none' || !row.hasAttribute(EXTENSION_MATRIX_ROW_HIDDEN_ATTR)) {
        row.style.display = 'none'
        row.setAttribute(EXTENSION_MATRIX_ROW_HIDDEN_ATTR, '1')
        return true
      }
    } else if (row.hasAttribute(EXTENSION_MATRIX_ROW_HIDDEN_ATTR)) {
      row.style.removeProperty('display')
      row.removeAttribute(EXTENSION_MATRIX_ROW_HIDDEN_ATTR)
      return true
    }
    return false
  }

  function isMatrixRowEmpty(row: HTMLElement): boolean {
    const cells = Array.from(row.querySelectorAll(':scope > td')) as HTMLElement[]
    if (cells.length === 0) return false

    const valueCells = cells.filter((cell) => {
      if (cell.querySelector(MATRIX_ROW_NAME_SELECTOR)) return false
      return Boolean(cell.querySelector(FIELD_VALUE_SELECTOR))
    })

    if (valueCells.length === 0) return false
    return valueCells.every((cell) => {
      const valueCell = cell.querySelector(FIELD_VALUE_SELECTOR) as HTMLElement | null
      return valueCell ? isValueContainerEmpty(valueCell) : true
    })
  }

  function applyHideEmptyMatrixRows(enabled: boolean, affectedSections: Set<HTMLElement>): void {
    const rows = Array.from(document.querySelectorAll(MATRIX_ROW_SELECTOR)) as HTMLElement[]
    for (const row of rows) {
      if (!setMatrixRowHidden(row, enabled && isMatrixRowEmpty(row))) continue
      const section = row.closest(SECTION_SELECTOR) as HTMLElement | null
      if (section) affectedSections.add(section)
    }
  }

  function setMatrixHidden(matrix: HTMLElement, hidden: boolean): boolean {
    if (hidden) {
      if (matrix.style.display !== 'none' || !matrix.hasAttribute(EXTENSION_MATRIX_HIDDEN_ATTR)) {
        matrix.style.display = 'none'
        matrix.setAttribute(EXTENSION_MATRIX_HIDDEN_ATTR, '1')
        return true
      }
      return false
    }

    if (matrix.hasAttribute(EXTENSION_MATRIX_HIDDEN_ATTR)) {
      matrix.style.removeProperty('display')
      matrix.removeAttribute(EXTENSION_MATRIX_HIDDEN_ATTR)
      return true
    }
    return false
  }

  /**
   * Hide matrix containers when every matrix row is hidden by hide-empty mode,
   * so only real content remains visible (no orphaned table headers).
   */
  function updateSectionMatrixVisibility(section: HTMLElement, enabled: boolean): boolean {
    const matrices = Array.from(section.querySelectorAll(MATRIX_SELECTOR)) as HTMLElement[]
    let hasVisibleMatrixContent = false

    for (const matrix of matrices) {
      const rows = Array.from(matrix.querySelectorAll('tbody > tr')) as HTMLElement[]
      const hasVisibleRows = rows.some((row) => !row.hasAttribute(EXTENSION_MATRIX_ROW_HIDDEN_ATTR))
      const hideMatrix = enabled && rows.length > 0 && !hasVisibleRows

      setMatrixHidden(matrix, hideMatrix)

      if (!hideMatrix && rows.length > 0) {
        hasVisibleMatrixContent = true
      }
    }

    return hasVisibleMatrixContent
  }

  function setSectionFieldListHidden(section: HTMLElement, hidden: boolean): void {
    const sectionContent = section.querySelector(SECTION_CONTENT_SELECTOR) as HTMLElement | null
    if (!sectionContent) return

    const fieldList = section.querySelector(FIELD_LIST_SELECTOR) as HTMLElement | null
    if (!fieldList) return

    const structuralWrapper =
      fieldList.parentElement &&
      fieldList.parentElement !== sectionContent &&
      fieldList.parentElement.children.length === 1
        ? (fieldList.parentElement as HTMLElement)
        : null

    if (hidden) {
      fieldList.style.display = 'none'
      fieldList.setAttribute(EXTENSION_LIST_HIDDEN_ATTR, '1')
      sectionContent.style.paddingTop = '0'
      sectionContent.style.paddingBottom = '0'
      sectionContent.setAttribute(EXTENSION_CONTENT_COMPACT_ATTR, '1')
      if (structuralWrapper) {
        structuralWrapper.style.display = 'none'
        structuralWrapper.setAttribute(EXTENSION_LIST_WRAPPER_HIDDEN_ATTR, '1')
      }
    } else if (fieldList.hasAttribute(EXTENSION_LIST_HIDDEN_ATTR)) {
      fieldList.style.removeProperty('display')
      fieldList.removeAttribute(EXTENSION_LIST_HIDDEN_ATTR)
      if (sectionContent.hasAttribute(EXTENSION_CONTENT_COMPACT_ATTR)) {
        sectionContent.style.removeProperty('padding-top')
        sectionContent.style.removeProperty('padding-bottom')
        sectionContent.removeAttribute(EXTENSION_CONTENT_COMPACT_ATTR)
      }
      if (structuralWrapper?.hasAttribute(EXTENSION_LIST_WRAPPER_HIDDEN_ATTR)) {
        structuralWrapper.style.removeProperty('display')
        structuralWrapper.removeAttribute(EXTENSION_LIST_WRAPPER_HIDDEN_ATTR)
      }
    }
  }

  function removeSectionBanners(): void {
    const banners = Array.from(document.querySelectorAll(SECTION_BANNER_SELECTOR)) as HTMLElement[]
    for (const banner of banners) banner.remove()
  }

  function ensureSectionBanner(section: HTMLElement): void {
    const content = section.querySelector(SECTION_CONTENT_SELECTOR) as HTMLElement | null
    if (!content) return

    const existing = section.querySelector(SECTION_BANNER_SELECTOR) as HTMLElement | null
    if (existing) return

    const banner = document.createElement('div')
    banner.setAttribute('data-plm-extension-empty-section-banner', '1')
    banner.style.cssText = [
      'margin:6px 0 0 0',
      'padding:10px 12px',
      'border-radius:8px',
      'border:1px solid #f7c6c7',
      'background:#fff1f2',
      'color:#7f1d1d',
      'font:600 12px/1.4 Segoe UI,Arial,sans-serif'
    ].join(';')
    banner.textContent = 'All fields in this section are hidden because they are empty.'
    content.prepend(banner)
  }

  function updateSingleSectionHiddenCount(section: HTMLElement, enabled: boolean): void {
    const existing = section.querySelector(`[${EXTENSION_SECTION_HIDDEN_COUNT_ATTR}="1"]`) as HTMLElement | null
    if (!enabled) {
      if (existing) existing.remove()
      return
    }

    const header = section.querySelector(SECTION_HEADER_SELECTOR) as HTMLElement | null
    const titleCarrier =
      (header?.querySelector('.MuiExpansionPanelSummary-content > div[title]') as HTMLElement | null) ||
      (header?.querySelector('[title]') as HTMLElement | null)

    if (!titleCarrier) {
      if (existing) existing.remove()
      return
    }

    const cached = sectionCountCache.get(section)
    let counts: { visible: number; total: number } | null = cached || null

    if (!counts) {
      const renderedFieldRows = Array.from(section.querySelectorAll(FIELD_ROW_SELECTOR)) as HTMLElement[]
      const renderedMatrixRows = Array.from(section.querySelectorAll(MATRIX_ROW_SELECTOR)) as HTMLElement[]
      const visibleFieldRows = renderedFieldRows.filter((row) => !row.hasAttribute(EXTENSION_ROW_HIDDEN_ATTR)).length

      let totalMatrixFields = 0
      let visibleMatrixFields = 0
      for (const matrixRow of renderedMatrixRows) {
        const matrixValueCells = Array.from(matrixRow.querySelectorAll(':scope > td')).filter((cell) => {
          const td = cell as HTMLElement
          if (td.querySelector(MATRIX_ROW_NAME_SELECTOR)) return false
          return Boolean(td.querySelector(FIELD_VALUE_SELECTOR))
        })

        const matrixFieldCount = matrixValueCells.length
        totalMatrixFields += matrixFieldCount
        if (!matrixRow.hasAttribute(EXTENSION_MATRIX_ROW_HIDDEN_ATTR)) {
          visibleMatrixFields += matrixFieldCount
        }
      }

      const totalRows = renderedFieldRows.length + totalMatrixFields

      if (totalRows > 0) {
        counts = {
          total: totalRows,
          visible: visibleFieldRows + visibleMatrixFields
        }
      }
    }

    if (!counts) {
      if (existing) existing.remove()
      return
    }

    sectionCountCache.set(section, counts)
    const labelText = `Showing ${counts.visible} of ${counts.total} Fields`

    if (existing && existing.parentElement !== titleCarrier) {
      existing.remove()
    }

    if (existing) {
      const pipeNode = existing.querySelector('[data-plm-extension-count-pipe="1"]') as HTMLElement | null
      const textNode = existing.querySelector('[data-plm-extension-count-text="1"]') as HTMLElement | null
      if (pipeNode && textNode) {
        textNode.textContent = labelText
        return
      }

      // Backward-compat path for older single-text badges.
      existing.textContent = ''
      const pipe = document.createElement('span')
      pipe.setAttribute('data-plm-extension-count-pipe', '1')
      pipe.textContent = '|'
      pipe.style.cssText = 'font-size:inherit;line-height:inherit;font-weight:inherit;vertical-align:baseline;'

      const text = document.createElement('span')
      text.setAttribute('data-plm-extension-count-text', '1')
      text.textContent = labelText
      text.style.cssText = 'margin-left:6px;font-size:12px;line-height:1.2;font-weight:600;vertical-align:baseline;'

      existing.appendChild(pipe)
      existing.appendChild(text)
      return
    }

    const countBadge = document.createElement('span')
    countBadge.setAttribute(EXTENSION_SECTION_HIDDEN_COUNT_ATTR, '1')
    countBadge.style.cssText =
      'margin-left:8px;font-size:inherit;line-height:inherit;font-weight:inherit;color:#64748b;white-space:nowrap;display:inline-flex;align-items:baseline;vertical-align:baseline;'

    const pipe = document.createElement('span')
    pipe.setAttribute('data-plm-extension-count-pipe', '1')
    pipe.textContent = '|'
    pipe.style.cssText = 'font-size:inherit;line-height:inherit;font-weight:inherit;vertical-align:baseline;'

    const text = document.createElement('span')
    text.setAttribute('data-plm-extension-count-text', '1')
    text.textContent = labelText
    text.style.cssText = 'margin-left:6px;font-size:12px;line-height:1.2;font-weight:600;vertical-align:baseline;'

    countBadge.appendChild(pipe)
    countBadge.appendChild(text)
    titleCarrier.appendChild(countBadge)
  }

  function updateSingleSectionEmptyBanner(section: HTMLElement, enabled: boolean): void {
    const existing = section.querySelector(SECTION_BANNER_SELECTOR) as HTMLElement | null
    if (!enabled) {
      updateSectionMatrixVisibility(section, false)
      setSectionFieldListHidden(section, false)
      if (existing) existing.remove()
      updateSingleSectionHiddenCount(section, false)
      return
    }

    const rows = Array.from(section.querySelectorAll(FIELD_ROW_SELECTOR)) as HTMLElement[]
    const hasVisibleMatrixContent = updateSectionMatrixVisibility(section, true)
    const hasVisibleFieldRows = rows.some((row) => !isRowHiddenByExtension(row))
    const hasAnySectionContent = rows.length > 0 || section.querySelector(MATRIX_SELECTOR) !== null
    const shouldShowEmptyBanner = hasAnySectionContent && !hasVisibleFieldRows && !hasVisibleMatrixContent

    if (shouldShowEmptyBanner) {
      setSectionFieldListHidden(section, true)
      ensureSectionBanner(section)
    } else {
      setSectionFieldListHidden(section, false)
      if (existing) existing.remove()
    }

    updateSingleSectionHiddenCount(section, true)
  }

  function updateSectionEmptyBanners(enabled: boolean): void {
    const sections = Array.from(document.querySelectorAll(SECTION_SELECTOR)) as HTMLElement[]
    for (const section of sections) {
      updateSingleSectionEmptyBanner(section, enabled)
    }

    if (!enabled) {
      removeSectionBanners()
    }
  }

  function applyHideEmptyFields(enabled: boolean): void {
    const affectedSections = new Set<HTMLElement>()
    const rows = Array.from(document.querySelectorAll(FIELD_ROW_SELECTOR)) as HTMLElement[]
    for (const row of rows) {
      if (!setRowSpansHidden(row, enabled && isRowValueEmpty(row))) continue
      const section = row.closest(SECTION_SELECTOR) as HTMLElement | null
      if (section) affectedSections.add(section)
    }
    applyHideEmptyMatrixRows(enabled, affectedSections)
    updateSectionEmptyBanners(enabled)
    if (enabled && affectedSections.size > 0) {
      scheduleCollapseHeightSync(affectedSections)
    }
  }

  /**
   * MUI Collapse may capture an oversized target height before hidden rows are
   * applied. Re-sync animated heights to current visible content to prevent
   * trailing gray overshoot during expansion.
   */
  function scheduleCollapseHeightSync(sections?: Set<HTMLElement>): void {
    if (collapseHeightSyncRaf !== null) {
      window.cancelAnimationFrame(collapseHeightSyncRaf)
    }

    collapseHeightSyncRaf = window.requestAnimationFrame(() => {
      collapseHeightSyncRaf = null
      const collapseRoots: HTMLElement[] = []
      if (sections && sections.size > 0) {
        for (const section of sections) {
          const root = section.querySelector(':scope > .MuiCollapse-root') as HTMLElement | null
          if (root) collapseRoots.push(root)
        }
      } else {
        collapseRoots.push(...(Array.from(document.querySelectorAll('.MuiCollapse-root')) as HTMLElement[]))
      }
      for (const collapseRoot of collapseRoots) {
        const styleHeight = (collapseRoot.style.height || '').trim()
        if (!styleHeight || styleHeight === 'auto') continue

        const wrapperInner = collapseRoot.querySelector(':scope > .MuiCollapse-wrapper > .MuiCollapse-wrapperInner') as HTMLElement | null
        if (!wrapperInner) continue

        const currentHeight = Number.parseFloat(styleHeight)
        const nextHeight = wrapperInner.scrollHeight
        if (!Number.isFinite(currentHeight) || !Number.isFinite(nextHeight)) continue
        if (Math.abs(currentHeight - nextHeight) < 1) continue

        collapseRoot.style.height = `${Math.max(0, nextHeight)}px`
      }
    })
  }

  function stopHideEmptyObserver(): void {
    if (hideEmptyObserver) {
      hideEmptyObserver.disconnect()
      hideEmptyObserver = null
    }
  }

  function stopFieldRowsPresenceObserver(): void {
    if (fieldRowsPresenceObserver) {
      fieldRowsPresenceObserver.disconnect()
      fieldRowsPresenceObserver = null
    }
  }

  function stopHideEmptyApplyTimer(): void {
    if (hideEmptyApplyTimer !== null) {
      window.clearTimeout(hideEmptyApplyTimer)
      hideEmptyApplyTimer = null
    }
    if (hideEmptyFollowUpTimer !== null) {
      window.clearTimeout(hideEmptyFollowUpTimer)
      hideEmptyFollowUpTimer = null
    }
    if (collapseHeightSyncRaf !== null) {
      window.cancelAnimationFrame(collapseHeightSyncRaf)
      collapseHeightSyncRaf = null
    }
  }

  function getItemDetailsMutationRoot(): HTMLElement | null {
    const firstSection = document.querySelector('.MuiExpansionPanel-root[name^="section-"]') as HTMLElement | null
    return firstSection?.parentElement as HTMLElement | null
  }

  function startHideEmptyObserver(): void {
    if (hideEmptyObserver) return
    const root = getItemDetailsMutationRoot()
    if (!root) return

    hideEmptyObserver = new MutationObserver(() => {
      scheduleApply()
    })

    hideEmptyObserver.observe(root, {
      subtree: true,
      characterData: true
    })
  }

  function ensureFieldRowsPresenceObserver(): void {
    if (fieldRowsPresenceObserver) return

    fieldRowsPresenceObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        let hasFieldRows = false
        let hasMatrixNodes = false

        for (const node of Array.from(mutation.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue

          if (node.matches(FIELD_ROW_SELECTOR) || node.querySelector(FIELD_ROW_SELECTOR)) {
            hasFieldRows = true
          }

          if (
            node.matches(MATRIX_SELECTOR) ||
            node.matches(MATRIX_ROW_SELECTOR) ||
            node.querySelector(MATRIX_SELECTOR) ||
            node.querySelector(MATRIX_ROW_SELECTOR)
          ) {
            hasMatrixNodes = true
          }
        }

        if (hasFieldRows || hasMatrixNodes) {
          scheduleApplyWithDelay(0, hasMatrixNodes)
          return
        }
      }
    })

    fieldRowsPresenceObserver.observe(document.documentElement, { childList: true, subtree: true })
  }

  function scheduleApply(): void {
    if (hideEmptySuspendedForSearch) return
    scheduleApplyWithDelay(APPLY_DEBOUNCE_MS, false)
  }

  function scheduleApplyWithDelay(delayMs: number, includeFollowUp: boolean): void {
    stopHideEmptyApplyTimer()
    hideEmptyApplyTimer = window.setTimeout(() => {
      hideEmptyApplyTimer = null
      if (!hideEmptyFieldsLoaded) {
        void sync()
        return
      }
      if (hideEmptySuspendedForSearch) return
      applyHideEmptyFields(hideEmptyFieldsEnabled)
      if (hideEmptyFieldsEnabled && includeFollowUp) {
        // Matrix cells can populate after initial section expansion render.
        hideEmptyFollowUpTimer = window.setTimeout(() => {
          hideEmptyFollowUpTimer = null
          if (hideEmptySuspendedForSearch) return
          applyHideEmptyFields(hideEmptyFieldsEnabled)
        }, FOLLOW_UP_APPLY_MS)
      }
    }, delayMs)
  }

  function suspendForSearch(): void {
    if (hideEmptySuspendedForSearch) return

    hideEmptySuspendedForSearch = true
    restoreHideEmptyAfterSearch = hideEmptyFieldsEnabled
    resetSectionCountCache()
    stopHideEmptyApplyTimer()
    stopHideEmptyObserver()
    stopFieldRowsPresenceObserver()
    applyHideEmptyFields(false)
  }

  function resumeFromSearch(): void {
    if (!hideEmptySuspendedForSearch) return

    hideEmptySuspendedForSearch = false
    const shouldRestore = restoreHideEmptyAfterSearch
    restoreHideEmptyAfterSearch = false
    resetSectionCountCache()

    if (shouldRestore) {
      applyHideEmptyFields(true)
      ensureSectionCountVisibilityStyle()
      startHideEmptyObserver()
      ensureFieldRowsPresenceObserver()
    } else {
      applyHideEmptyFields(false)
      stopHideEmptyObserver()
      stopFieldRowsPresenceObserver()
    }
  }

  async function sync(): Promise<void> {
    if (!hideEmptyFieldsLoaded) {
      await loadSetting()
    }

    if (hideEmptySuspendedForSearch) {
      restoreHideEmptyAfterSearch = hideEmptyFieldsEnabled
      resetSectionCountCache()
      stopHideEmptyObserver()
      stopFieldRowsPresenceObserver()
      applyHideEmptyFields(false)
      return
    }

    applyHideEmptyFields(hideEmptyFieldsEnabled)
    if (hideEmptyFieldsEnabled) {
      ensureSectionCountVisibilityStyle()
      startHideEmptyObserver()
      ensureFieldRowsPresenceObserver()
    } else {
      resetSectionCountCache()
      stopHideEmptyObserver()
      stopFieldRowsPresenceObserver()
    }
  }

  function cleanup(): void {
    hideEmptySuspendedForSearch = false
    restoreHideEmptyAfterSearch = false
    resetSectionCountCache()
    stopHideEmptyObserver()
    stopFieldRowsPresenceObserver()
    stopHideEmptyApplyTimer()
    applyHideEmptyFields(false)
  }

  return {
    isEnabled,
    setEnabled,
    sync,
    scheduleApply,
    suspendForSearch,
    resumeFromSearch,
    cleanup
  }
}
