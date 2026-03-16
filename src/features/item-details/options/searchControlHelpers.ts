import { FIELD_TITLE_SELECTOR, SECTION_HEADER_SELECTOR, SECTION_SELECTOR } from '../item-details.constants'
import { parseItemDetailsContextFromPageUrl, type ItemDetailsContext } from '../../../shared/url/parse'
import { normalizeText } from '../item-details.utils'
import { getCachedItemDetailsForCurrentPage } from '../services/item-details.data-cache.service'

export type SearchCandidate = {
  container: HTMLElement
  target: HTMLElement
  searchableText: string
}

type ItemContext = ItemDetailsContext

export type JsonSectionMatch = {
  sectionId: number | null
  sectionTitle: string
  sectionIndex: number
  matchedTitleKeys: Set<string>
}

export type DomSectionLookups = {
  byId: Map<number, HTMLElement>
  byTitle: Map<string, HTMLElement>
  inOrder: HTMLElement[]
}

const API_SECTION_ID_RE = /\/sections\/(\d+)(?:[/?#]|$)/i
const DOM_SECTION_ID_RE = /\bsection[-_](\d+)\b/i

export function toSearchableText(rawText: string): string {
  return normalizeText(rawText).toLowerCase()
}

function toTitleMatchKey(rawText: string): string {
  return toSearchableText(rawText)
    .replace(/[*:]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getCurrentItemContextFromUrl(urlString: string): ItemContext | null {
  return parseItemDetailsContextFromPageUrl(urlString)
}

function parseSectionIdFromApiLink(link: string): number | null {
  const match = API_SECTION_ID_RE.exec(link)
  if (!match) return null
  const sectionId = Number.parseInt(match[1], 10)
  return Number.isFinite(sectionId) ? sectionId : null
}

function extractSectionIdFromString(value: string | null | undefined): number | null {
  if (!value) return null
  const directMatch = DOM_SECTION_ID_RE.exec(value)
  if (directMatch) {
    const parsed = Number.parseInt(directMatch[1], 10)
    if (Number.isFinite(parsed)) return parsed
  }

  const apiLikeMatch = API_SECTION_ID_RE.exec(value)
  if (apiLikeMatch) {
    const parsed = Number.parseInt(apiLikeMatch[1], 10)
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}

function parseSectionIdFromDomSection(section: HTMLElement): number | null {
  const directCandidates = [
    section.getAttribute('name'),
    section.id,
    section.getAttribute('data-section-id'),
    section.getAttribute('data-testid')
  ]

  for (const candidate of directCandidates) {
    const parsed = extractSectionIdFromString(candidate)
    if (parsed !== null) return parsed
  }

  const header = section.querySelector(SECTION_HEADER_SELECTOR) as HTMLElement | null
  const headerCandidates = [header?.id, header?.getAttribute('aria-controls'), header?.getAttribute('name')]
  for (const candidate of headerCandidates) {
    const parsed = extractSectionIdFromString(candidate)
    if (parsed !== null) return parsed
  }

  return null
}

function getDomSectionTitle(section: HTMLElement): string {
  const header = section.querySelector(SECTION_HEADER_SELECTOR) as HTMLElement | null
  const titleCarrier = (header?.querySelector('[title]') as HTMLElement | null) || header
  const raw = titleCarrier?.getAttribute('title') || titleCarrier?.textContent || ''
  return toSearchableText(raw)
}

function buildDomSectionsById(): Map<number, HTMLElement> {
  const sections = Array.from(document.querySelectorAll(SECTION_SELECTOR)) as HTMLElement[]
  const map = new Map<number, HTMLElement>()

  for (const section of sections) {
    const sectionId = parseSectionIdFromDomSection(section)
    if (sectionId === null) continue
    if (!map.has(sectionId)) {
      map.set(sectionId, section)
    }
  }

  return map
}

function buildDomSectionsByTitle(): Map<string, HTMLElement> {
  const sections = Array.from(document.querySelectorAll(SECTION_SELECTOR)) as HTMLElement[]
  const map = new Map<string, HTMLElement>()

  for (const section of sections) {
    const title = getDomSectionTitle(section)
    if (!title) continue
    if (!map.has(title)) {
      map.set(title, section)
    }
  }

  return map
}

function getDomSectionsInOrder(): HTMLElement[] {
  return Array.from(document.querySelectorAll(SECTION_SELECTOR)) as HTMLElement[]
}

export function getCachedItemDataForCurrentPage(): unknown | null {
  const context = getCurrentItemContextFromUrl(window.location.href)
  if (!context) return null
  return getCachedItemDetailsForCurrentPage()
}

export function collectMatchedJsonFieldTitlesBySection(data: unknown, term: string): JsonSectionMatch[] | null {
  if (!data || typeof data !== 'object') return null
  const root = data as Record<string, unknown>
  const sections = Array.isArray(root.sections) ? (root.sections as unknown[]) : null
  if (!sections) return null

  const matches: JsonSectionMatch[] = []
  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const sectionNode = sections[sectionIndex]
    if (!sectionNode || typeof sectionNode !== 'object') continue
    const section = sectionNode as Record<string, unknown>
    const link = typeof section.link === 'string' ? section.link : ''
    const sectionId = parseSectionIdFromApiLink(link)
    const sectionTitle = toSearchableText(typeof section.title === 'string' ? section.title : '')
    if (sectionId === null && !sectionTitle) continue

    const fields = Array.isArray(section.fields) ? (section.fields as unknown[]) : []
    let matchedTitleKeys: Set<string> | null = null
    for (const fieldNode of fields) {
      if (!fieldNode || typeof fieldNode !== 'object') continue
      const field = fieldNode as Record<string, unknown>
      const title = typeof field.title === 'string' ? field.title : ''
      const searchableTitle = toSearchableText(title)
      if (!searchableTitle || !searchableTitle.includes(term)) continue

      const key = toTitleMatchKey(searchableTitle)
      if (!key) continue
      if (!matchedTitleKeys) matchedTitleKeys = new Set<string>()
      matchedTitleKeys.add(key)
    }

    if (matchedTitleKeys && matchedTitleKeys.size > 0) {
      matches.push({
        sectionId,
        sectionTitle,
        sectionIndex,
        matchedTitleKeys
      })
    }
  }

  return matches
}

export function titleMatchesJsonSearch(candidateTitle: string, matchedTitleKeys: Set<string>): boolean {
  const candidateKey = toTitleMatchKey(candidateTitle)
  if (!candidateKey) return false

  for (const jsonKey of matchedTitleKeys) {
    if (!jsonKey) continue
    if (candidateKey === jsonKey) return true
    if (candidateKey.includes(jsonKey) || jsonKey.includes(candidateKey)) return true
  }

  return false
}

export function buildDomSectionLookups(): DomSectionLookups {
  return {
    byId: buildDomSectionsById(),
    byTitle: buildDomSectionsByTitle(),
    inOrder: getDomSectionsInOrder()
  }
}

export function resolveDomSectionForJsonMatch(match: JsonSectionMatch, lookups: DomSectionLookups): HTMLElement | null {
  if (match.sectionId !== null) {
    const byId = lookups.byId.get(match.sectionId)
    if (byId) return byId
  }

  if (match.sectionTitle) {
    const byTitle = lookups.byTitle.get(match.sectionTitle)
    if (byTitle) return byTitle
  }

  return lookups.inOrder[match.sectionIndex] || null
}

export function collectFieldSearchCandidates(fieldRows: HTMLElement[]): SearchCandidate[] {
  const candidates: SearchCandidate[] = []
  for (const row of fieldRows) {
    const titleCell = row.querySelector(FIELD_TITLE_SELECTOR) as HTMLElement | null
    if (!titleCell) continue

    const searchableText = toSearchableText(titleCell.getAttribute('title') || titleCell.textContent || '')
    if (!searchableText) continue

    candidates.push({
      container: row,
      target: titleCell,
      searchableText
    })
  }
  return candidates
}

export function getMatrixHeaderLabels(matrix: HTMLElement): string[] {
  const headers = Array.from(matrix.querySelectorAll('thead > tr > th')) as HTMLElement[]
  return headers.map((header) => {
    const titleSpan = header.querySelector('[title]') as HTMLElement | null
    const source = titleSpan?.getAttribute('title') || titleSpan?.textContent || header.textContent || ''
    return toSearchableText(source)
  })
}
