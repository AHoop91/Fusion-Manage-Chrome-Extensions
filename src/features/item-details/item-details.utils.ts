import { parseWorkspaceIdFromPlmWorkspacePath } from '../../shared/url/parse'
import { normalizeWhitespace } from '../../shared/utils/text'
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

