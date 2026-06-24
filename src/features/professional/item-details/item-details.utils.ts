import { parseWorkspaceIdFromPlmWorkspacePath } from '../../../shared/url/parse'
import { normalizeWhitespace } from '../../../shared/utils/text'
import { SECTION_HEADER_SELECTOR, SECTION_SELECTOR } from './item-details.constants'
import type { SectionMeta } from './item-details.types'

export function normalizeText(value: string): string {
  return normalizeWhitespace(value.replace(/\u00A0/g, ' '))
}

export function getWorkspaceIdFromUrl(urlString: string): number | null {
  return parseWorkspaceIdFromPlmWorkspacePath(urlString)
}

export function isItemDetailsEditMode(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    return (url.searchParams.get('mode') || '').toLowerCase() === 'edit'
  } catch {
    return false
  }
}

const ITEM_DETAILS_EDIT_FIELD_SELECTOR = [
  '.plm-item-detail-field-value input',
  '.plm-item-detail-field-value textarea',
  '.plm-item-detail-field-value select',
  '.plm-item-detail-field-value [contenteditable="true"]'
].join(', ')

const REQUIRED_FIELD_MARKER_SELECTOR = '.field-label-required'

export function isItemDetailsDomInEditMode(root: ParentNode = document): boolean {
  return root.querySelector(ITEM_DETAILS_EDIT_FIELD_SELECTOR) !== null
}

export function hasRequiredFieldMarkers(root: ParentNode = document): boolean {
  return root.querySelector(REQUIRED_FIELD_MARKER_SELECTOR) !== null
}

export function resolveItemDetailsOptionsMode(
  urlString: string,
  isAddItemPage: boolean,
  isItemDetailsPage: boolean
): 'view' | 'edit' {
  if (isAddItemPage) return 'edit'
  if (!isItemDetailsPage) return 'view'

  let urlMode = ''
  try {
    urlMode = (new URL(urlString).searchParams.get('mode') || '').toLowerCase()
  } catch {
    return 'view'
  }

  if (urlMode === 'view') return 'view'

  const domEdit = isItemDetailsDomInEditMode()
  if (urlMode === 'edit') {
    return domEdit ? 'edit' : 'view'
  }

  return domEdit ? 'edit' : 'view'
}

export function getSectionMeta(section: HTMLElement): SectionMeta {
  const header = section.querySelector(SECTION_HEADER_SELECTOR) as HTMLElement | null
  const titleCarrier = header?.querySelector('[title]') as HTMLElement | null
  const rawLabel = normalizeText((titleCarrier?.getAttribute('title') || header?.textContent || '').replace(/\s+/g, ' '))
  const label = rawLabel || 'Unnamed section'
  const stableId = titleCarrier?.getAttribute('id') || section.getAttribute('name') || ''
  const key = stableId ? `id:${stableId}` : `label:${label.toLowerCase()}`
  return { section, key, label }
}

export function getAllSectionMeta(): SectionMeta[] {
  const sections = Array.from(document.querySelectorAll(SECTION_SELECTOR)) as HTMLElement[]
  return sections.map((section) => getSectionMeta(section))
}

