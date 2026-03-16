import { GRID_FORM_STYLE_ID } from './constants'
import { normalizeText } from '../../../../shared/utils/text'
import { ensureStyleTag } from '../../../../dom/styles'
import { isLookupPayloadValue, isMultiLookupFieldType } from '../services/fieldTypes'
import type { GridService } from '../services/gridService'
import type { FormFieldDefinition } from '../types'
import { createControlFromStrategies } from '../services/controlStrategies'
import { GRID_FORM_STYLES } from './gridForm.styles'
import {
  buildLookupChipManager,
  buildLookupMenuManager,
  getLookupOptionLinkMap,
  preloadLookupOptions as preloadLookupOptionsBatch,
  splitCommaSeparated
} from '../services/lookupManagers'

/**
 * Rendering contract for grid advanced editor controls and lookup behavior.
 */
export interface FormRenderer {
  /**
   * Injects modal styles once.
   */
  ensureStyles: () => void
  /**
   * Creates a typed control for a form field.
   */
  createControl: (
    field: FormFieldDefinition,
    value: string
  ) => HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLFieldSetElement
  /**
   * Wires lookup search dropdown behavior to an input and menu.
   */
  wireLookupSearchInput: (
    input: HTMLInputElement,
    menu: HTMLDivElement,
    picklistPath: string,
    isMultiSelect: boolean,
    shouldPreload: boolean
  ) => void
  /**
   * Resolves payload value from lookup control state.
   */
  resolveLookupPayloadValue: (control: HTMLInputElement, userInputValue: string, isMultiSelect: boolean) => string
  /**
   * Preloads lookup datasets for unique picklist paths.
   */
  preloadLookupOptions: (paths: string[]) => void
}

/**
 * Creates a form renderer for grid advanced editor controls.
 */
export function createFormRenderer(gridService: GridService): FormRenderer {
  function ensureStyles(): void {
    ensureStyleTag(GRID_FORM_STYLE_ID, GRID_FORM_STYLES)
  }

  function createControl(
    field: FormFieldDefinition,
    value: string
  ): HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLFieldSetElement {
    return createControlFromStrategies(field, value, gridService)
  }

  function wireLookupSearchInput(
    input: HTMLInputElement,
    menu: HTMLDivElement,
    picklistPath: string,
    isMultiSelect: boolean,
    shouldPreload: boolean
  ): void {
    const lookupWrap = input.parentElement instanceof HTMLElement ? input.parentElement : null
    const onChange = (): void => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }

    const chipManager = buildLookupChipManager({
      input,
      lookupWrap,
      isMultiSelect,
      onChange
    })

    buildLookupMenuManager({
      input,
      menu,
      lookupWrap,
      picklistPath,
      isMultiSelect,
      shouldPreload,
      chipManager,
      onChange
    })
  }

  function resolveLookupPayloadValue(control: HTMLInputElement, userInputValue: string, isMultiSelect: boolean): string {
    const normalizedInput = String(userInputValue || '').trim()
    const labelToLink = getLookupOptionLinkMap(control)

    if (isMultiSelect) {
      const labels = splitCommaSeparated(control.dataset.plmLookupCurrentLabel || '')
      const linksFromState = splitCommaSeparated(control.dataset.plmLookupCurrentLink || '')
      const links: string[] = []
      for (let index = 0; index < labels.length; index += 1) {
        const label = labels[index]
        const linkedValue = linksFromState[index] || labelToLink.get(normalizeText(label)) || ''
        if (linkedValue) links.push(linkedValue)
      }
      const currentLinked = String(control.dataset.plmLookupCurrentLink || '').trim()
      if (labels.length > 0 && links.length === labels.length) return links.join(',')
      if (labels.length > 0 && currentLinked) return currentLinked
      if (links.length > 0) return links.join(',')
      if (currentLinked) return currentLinked
      return ''
    }

    const currentLabel = String(control.dataset.plmLookupCurrentLabel || '').trim()
    const currentLink = String(control.dataset.plmLookupCurrentLink || '').trim()
    if (currentLabel && normalizedInput && currentLabel.toLowerCase() === normalizedInput.toLowerCase() && currentLink) {
      return currentLink
    }

    if (currentLink && !normalizedInput) return currentLink
    if (isLookupPayloadValue(normalizedInput)) return normalizedInput
    const mapped = labelToLink.get(normalizeText(normalizedInput)) || ''
    if (mapped) return mapped
    if (currentLink && normalizedInput) return currentLink
    return ''
  }

  function preloadLookupOptions(paths: string[]): void {
    preloadLookupOptionsBatch(paths)
  }

  return {
    ensureStyles,
    createControl,
    wireLookupSearchInput,
    resolveLookupPayloadValue,
    preloadLookupOptions
  }
}




