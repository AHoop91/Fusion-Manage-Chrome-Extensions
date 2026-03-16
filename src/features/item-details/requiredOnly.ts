import {
  DEFAULT_OPTIONS,
  EXTENSION_REQUIRED_CELL_HIDDEN_ATTR,
  EXTENSION_REQUIRED_ROW_HIDDEN_ATTR,
  FIELD_ROW_SELECTOR,
  SECTION_SELECTOR,
  FIELD_TITLE_SELECTOR,
  FIELD_VALUE_SELECTOR,
  OPTIONS_STORAGE_KEY
} from './item-details.constants'
import type { ItemDetailsRuntime } from './item-details.types'
import { ensureStyleTag } from '../../dom/styles'

type RequiredOnlyFeature = {
  isEnabled: () => boolean
  setEnabled: (next: boolean) => Promise<void>
  sync: () => Promise<void>
  scheduleApply: () => void
  cleanup: () => void
}

const REQUIRED_ONLY_ROOT_ATTR = 'data-plm-extension-required-only'
const REQUIRED_ONLY_STYLE_ID = 'plm-extension-required-only-style'
const REQUIRED_MARKER_SELECTOR = '.field-label-required'

export function createRequiredOnlyFeature(ext: ItemDetailsRuntime): RequiredOnlyFeature {
  let requiredOnlyEnabled = false
  let requiredOnlyLoaded = false

  function isEnabled(): boolean {
    return requiredOnlyEnabled
  }

  async function loadSetting(): Promise<void> {
    const options = await ext.getLocalOptions(OPTIONS_STORAGE_KEY, DEFAULT_OPTIONS)
    requiredOnlyEnabled = Boolean(options.requiredFieldsOnly)
    requiredOnlyLoaded = true
  }

  async function setEnabled(next: boolean): Promise<void> {
    const current = await ext.getLocalOptions(OPTIONS_STORAGE_KEY, DEFAULT_OPTIONS)
    await ext.setLocalOptions(OPTIONS_STORAGE_KEY, {
      ...current,
      requiredFieldsOnly: next
    })
    requiredOnlyEnabled = next
    requiredOnlyLoaded = true
    await sync()
  }

  function ensureRequiredOnlyStyle(): void {
    const sectionWithoutRequired = `${SECTION_SELECTOR}:not(:has(${REQUIRED_MARKER_SELECTOR}))`

    ensureStyleTag(REQUIRED_ONLY_STYLE_ID, [
      // Hide whole sections that contain no required fields.
      `html[${REQUIRED_ONLY_ROOT_ATTR}="1"] ${sectionWithoutRequired} {`,
      '  display: none !important;',
      '}',
      // Hide single-child structural wrappers to avoid leftover vertical gaps.
      `html[${REQUIRED_ONLY_ROOT_ATTR}="1"] div:has(> ${sectionWithoutRequired}:only-child),`,
      `html[${REQUIRED_ONLY_ROOT_ATTR}="1"] span:has(> ${sectionWithoutRequired}:only-child) {`,
      '  display: none !important;',
      '}',
      // In mixed sections, keep only required rows visible.
      `html[${REQUIRED_ONLY_ROOT_ATTR}="1"] ${FIELD_ROW_SELECTOR}:not(:has(${REQUIRED_MARKER_SELECTOR})) {`,
      '  display: none !important;',
      '}',
      `html[${REQUIRED_ONLY_ROOT_ATTR}="1"] ${FIELD_ROW_SELECTOR}:not(:has(${REQUIRED_MARKER_SELECTOR})) ${FIELD_TITLE_SELECTOR},`,
      `html[${REQUIRED_ONLY_ROOT_ATTR}="1"] ${FIELD_ROW_SELECTOR}:not(:has(${REQUIRED_MARKER_SELECTOR})) ${FIELD_VALUE_SELECTOR} {`,
      '  display: none !important;',
      '}'
    ].join('\n'))
  }

  /**
   * Clear legacy inline hides from earlier implementation variants so the
   * CSS-driven mode can control visibility consistently.
   */
  function clearLegacyInlineHides(): void {
    const hiddenCells = Array.from(
      document.querySelectorAll(`[${EXTENSION_REQUIRED_CELL_HIDDEN_ATTR}="1"]`)
    ) as HTMLElement[]
    for (const cell of hiddenCells) {
      cell.style.removeProperty('display')
      cell.removeAttribute(EXTENSION_REQUIRED_CELL_HIDDEN_ATTR)
    }

    const hiddenRows = Array.from(
      document.querySelectorAll(`[${EXTENSION_REQUIRED_ROW_HIDDEN_ATTR}="1"]`)
    ) as HTMLElement[]
    for (const row of hiddenRows) {
      row.style.removeProperty('display')
      row.removeAttribute(EXTENSION_REQUIRED_ROW_HIDDEN_ATTR)
    }
  }

  function scheduleApply(): void {
    if (!requiredOnlyLoaded) {
      void sync()
      return
    }

    if (requiredOnlyEnabled) {
      ensureRequiredOnlyStyle()
      document.documentElement.setAttribute(REQUIRED_ONLY_ROOT_ATTR, '1')
    } else {
      document.documentElement.removeAttribute(REQUIRED_ONLY_ROOT_ATTR)
      clearLegacyInlineHides()
    }
  }

  async function sync(): Promise<void> {
    if (!requiredOnlyLoaded) {
      await loadSetting()
    }

    scheduleApply()
  }

  function cleanup(): void {
    document.documentElement.removeAttribute(REQUIRED_ONLY_ROOT_ATTR)
    clearLegacyInlineHides()
  }

  return {
    isEnabled,
    setEnabled,
    sync,
    scheduleApply,
    cleanup
  }
}
