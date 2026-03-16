import type { PlmExtRuntime } from '../runtime/types'
import { decodeHtmlEntities } from '../utils/html'
import type {
  ItemSelectorAttachment,
  ItemSelectorContext,
  ItemSelectorDetailRow,
  ItemSelectorDetailSection,
  ItemSelectorSearchField,
  ItemSelectorSearchFilterGroup,
  ItemSelectorSearchResult
} from './types'
import { normalizeItemDetailsFieldId } from './helpers'

// Search service owns platform calls + payload normalization.
// It intentionally contains no UI orchestration.
type ItemSelectorRuntime = Pick<PlmExtRuntime, 'requestPlmAction'>

type WorkspaceField = {
  __self__?: string
  title?: string
  name?: string
  visibility?: string
  hidden?: boolean | string
  visible?: boolean | string
  isVisible?: boolean | string
  isHidden?: boolean | string
  section?: { title?: string; name?: string }
  sectionTitle?: string
  sectionName?: string
  expanded?: boolean | string
  collapsed?: boolean | string
}

type SearchResponse = {
  items?: Array<Record<string, unknown>>
  offset?: number
  limit?: number
  totalCount?: number
  totalHits?: number
  data?: {
    items?: Array<Record<string, unknown>>
    offset?: number
    limit?: number
    totalCount?: number
    totalHits?: number
  }
}

type AttachmentsResponse = {
  data?: unknown
  attachments?: unknown
}

type FieldImageResponse = {
  dataUrl?: string
}

type WorkspacePresentation = {
  hiddenFieldIds: Set<string>
  hiddenFieldTitles: Set<string>
  sectionExpandedByTitle: Map<string, boolean>
}

export type ItemSelectorService = {
  fetchWorkspaceFields: (context: ItemSelectorContext) => Promise<ItemSelectorSearchField[]>
  searchItems: (
    context: ItemSelectorContext,
    groups: ItemSelectorSearchFilterGroup[],
    offset: number,
    limit: number,
    queryOverride?: string
  ) => Promise<{ items: ItemSelectorSearchResult[]; totalResults: number }>
  fetchItemDetails: (context: ItemSelectorContext, itemId: number) => Promise<ItemSelectorDetailSection[]>
  fetchItemAttachments: (context: ItemSelectorContext, itemId: number) => Promise<ItemSelectorAttachment[]>
}

function normalizeTitle(item: Record<string, unknown>): string {
  for (const candidate of [item.itemDescriptor, item.title]) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate
  }
  return 'Untitled item'
}

function normalizeRevision(item: Record<string, unknown>): string {
  const version = item.version
  if (typeof version === 'string' && version.trim()) return version.trim()
  if (typeof version === 'number' && Number.isFinite(version)) return String(version)

  const revision = item.revision
  if (typeof revision === 'string' && revision.trim()) return revision.trim()
  if (typeof revision === 'number' && Number.isFinite(revision)) return String(revision)

  return '-'
}

function normalizeItemId(item: Record<string, unknown>): number | null {
  const candidates: unknown[] = [item.dmsId, item.itemId, item.id]
  for (const value of candidates) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  const match = /\/items\/(\d+)\b/i.exec(typeof item.__self__ === 'string' ? item.__self__ : '')
  if (!match) return null
  const parsed = Number.parseInt(match[1], 10)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeDmsId(item: Record<string, unknown>): number | null {
  const dmsIdRaw = Number(item.dmsId)
  if (Number.isFinite(dmsIdRaw)) return dmsIdRaw

  const match = /\/items\/(\d+)\b/i.exec(typeof item.__self__ === 'string' ? item.__self__ : '')
  if (!match) return null
  const parsed = Number.parseInt(match[1], 10)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeWorkspaceId(item: Record<string, unknown>, fallbackWorkspaceId: number): number {
  const parsed = Number(item.workspaceId)
  return Number.isFinite(parsed) ? parsed : fallbackWorkspaceId
}

function extractArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object'))
  }
  return []
}

function fieldIdFromWorkspaceField(field: WorkspaceField): string | null {
  const self = typeof field.__self__ === 'string' ? field.__self__ : ''
  const match = /\/fields\/([^/?#]+)/i.exec(self)
  if (match?.[1]) return decodeURIComponent(match[1]).trim()

  const name = typeof field.name === 'string' ? field.name.trim() : ''
  return name || null
}

function toSearchFields(fields: WorkspaceField[]): ItemSelectorSearchField[] {
  const dedupe = new Set<string>()
  const result: ItemSelectorSearchField[] = []

  for (const field of fields) {
    const id = fieldIdFromWorkspaceField(field)
    if (!id) continue
    const normalized = id.toUpperCase()
    if (dedupe.has(normalized)) continue
    dedupe.add(normalized)
    result.push({
      id: normalized,
      label: String(field.title || field.name || normalized),
      sectionLabel: String(field.section?.title || field.section?.name || field.sectionTitle || field.sectionName || 'General')
    })
  }

  return result.sort((a, b) => {
    const sectionSort = a.sectionLabel.localeCompare(b.sectionLabel)
    if (sectionSort !== 0) return sectionSort
    return a.label.localeCompare(b.label)
  })
}

function escapeSearchValue(raw: string): string {
  return raw.replace(/[`():<>=\\/\]\[\{\}]/g, '').trim()
}

function ensureWorkspaceInQuery(workspaceId: number, query: string): string {
  const trimmed = query.trim()
  if (/\bworkspaceId(?:%3D|=)\d+\b/i.test(trimmed)) return trimmed
  const scopeClause = `workspaceId%3D${workspaceId}`
  if (!trimmed) return scopeClause
  return `${trimmed}+AND+${scopeClause}`
}

function extractSearchItems(response: SearchResponse | undefined): Array<Record<string, unknown>> {
  const fromData = extractArray(response?.data?.items)
  return fromData.length > 0 ? fromData : extractArray(response?.items)
}

function extractSearchTotal(response: SearchResponse | undefined, fallback: number): number {
  const total = Number(
    response?.data?.totalCount ??
    response?.data?.totalHits ??
    response?.totalCount ??
    response?.totalHits ??
    fallback
  )
  return Number.isFinite(total) ? total : fallback
}

function buildSearchQuery(groups: ItemSelectorSearchFilterGroup[]): string {
  const groupQueries: string[] = []
  const groupJoins: Array<'AND' | 'OR'> = []

  for (const group of groups) {
    const active = group.filters.filter((filter) => filter.value.trim().length > 0)
    if (active.length === 0) continue

    const clauses: string[] = []
    let query = ''
    for (let index = 0; index < active.length; index += 1) {
      const filter = active[index]
      const safeValue = escapeSearchValue(filter.value.trim())
      if (!safeValue) continue
      const fieldId = normalizeItemDetailsFieldId(filter.fieldId)
      clauses.push(`ITEM_DETAILS:${fieldId}=${safeValue}`)
      if (index < active.length - 1) clauses.push(filter.joinWithNext === 'OR' ? '+OR+' : '+AND+')
    }
    query = clauses.join('')
    if (!query) continue

    groupQueries.push(active.length > 1 ? `(${query})` : query)
    groupJoins.push(group.joinWithNext)
  }

  if (groupQueries.length === 0) return ''
  if (groupQueries.length === 1) return groupQueries[0]

  let root = ''
  for (let index = 0; index < groupQueries.length; index += 1) {
    root += groupQueries[index]
    if (index < groupQueries.length - 1) {
      root += groupJoins[index] === 'OR' ? '+OR+' : '+AND+'
    }
  }

  return `(${root})`
}

function fieldIdFromSelf(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = /\/fields\/([^/?#]+)/i.exec(value)
  if (!match?.[1]) return null
  return decodeURIComponent(match[1]).trim().toUpperCase()
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  return null
}

function getSectionTitle(field: WorkspaceField): string {
  return String(field.section?.title ?? field.section?.name ?? field.sectionTitle ?? field.sectionName ?? 'General')
}

function buildWorkspacePresentation(fields: WorkspaceField[]): WorkspacePresentation {
  const hiddenFieldIds = new Set<string>()
  const hiddenFieldTitles = new Set<string>()
  const sectionExpandedByTitle = new Map<string, boolean>()

  for (const field of fields) {
    const fieldId = fieldIdFromWorkspaceField(field)?.toUpperCase() || ''
    const fieldTitle = String(field.title || field.name || '').trim().toLowerCase()

    const hiddenDirect = normalizeBoolean(field.hidden)
    const hiddenInverseVisible = normalizeBoolean(field.visible)
    const hiddenIsVisible = normalizeBoolean(field.isVisible)
    const hiddenIsHidden = normalizeBoolean(field.isHidden)
    const visibility = String(field.visibility || '').trim().toUpperCase()
    const hiddenByVisibility = visibility === 'NEVER'
    const isHidden = (
      hiddenByVisibility ||
      hiddenDirect === true ||
      hiddenIsHidden === true ||
      hiddenInverseVisible === false ||
      hiddenIsVisible === false
    )

    if (isHidden) {
      if (fieldId) hiddenFieldIds.add(fieldId)
      if (fieldTitle) hiddenFieldTitles.add(fieldTitle)
    }

    const sectionTitle = getSectionTitle(field)
    if (!sectionExpandedByTitle.has(sectionTitle)) {
      const expanded = normalizeBoolean(field.expanded)
      const collapsed = normalizeBoolean(field.collapsed)
      if (expanded !== null) sectionExpandedByTitle.set(sectionTitle, expanded)
      else if (collapsed !== null) sectionExpandedByTitle.set(sectionTitle, !collapsed)
    }
  }

  return {
    hiddenFieldIds,
    hiddenFieldTitles,
    sectionExpandedByTitle
  }
}

function flattenDetails(value: unknown, prefix = '', rows: ItemSelectorDetailRow[] = []): ItemSelectorDetailRow[] {
  if (value === null || typeof value === 'undefined') {
    if (prefix) rows.push({ label: prefix, value: '-' })
    return rows
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    if (prefix) rows.push({ label: prefix, value: String(value) })
    return rows
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      if (prefix) rows.push({ label: prefix, value: '[]' })
      return rows
    }
    value.forEach((entry, index) => {
      flattenDetails(entry, `${prefix}[${index}]`, rows)
    })
    return rows
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      if (prefix) rows.push({ label: prefix, value: '{}' })
      return rows
    }
    for (const [key, entry] of entries) {
      const label = prefix ? `${prefix}.${key}` : key
      flattenDetails(entry, label, rows)
    }
  }

  return rows
}

function stringifyDetailValue(value: unknown): string {
  if (value === null || typeof value === 'undefined') return '-'
  if (typeof value === 'string') return value.trim() || '-'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) {
    if (value.length === 0) return '-'
    const parts = value
      .map((entry) => {
        if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') return String(entry)
        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>
          return String(record.title || record.name || record.value || JSON.stringify(record))
        }
        return ''
      })
      .filter((entry) => entry.trim().length > 0)
    return parts.length > 0 ? parts.join(', ') : '-'
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const preferred = record.title || record.name || record.value
    if (typeof preferred === 'string' && preferred.trim()) return preferred
    try {
      return JSON.stringify(record)
    } catch {
      return String(record)
    }
  }
  return String(value)
}

function extractImageLink(value: unknown): string | null {
  if (!value) return null

  const extractFromText = (text: string): string | null => {
    const decoded = text
      .replace(/&quot;/g, '"')
      .replace(/&#34;/g, '"')
      .replace(/&amp;/g, '&')
    const unescaped = decoded
      .replace(/\\"/g, '"')
      .replace(/\\\//g, '/')
    const match =
      /"link"\s*:\s*"([^"]*\/image\/\d+)"/i.exec(unescaped) ||
      /(\/api\/v\d+\/workspaces\/\d+\/items\/\d+\/field-values\/[^/"'\s]+\/image\/\d+)/i.exec(unescaped)
    return match?.[1] || null
  }

  const scan = (entry: unknown): string | null => {
    if (typeof entry === 'string') {
      const trimmed = entry.trim()
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          const parsed = JSON.parse(trimmed) as unknown
          return scan(parsed)
        } catch {
          // regex fallback
        }
      }
      const direct = extractFromText(trimmed)
      if (direct) return direct
      return null
    }
    if (!entry || typeof entry !== 'object') return null
    const record = entry as Record<string, unknown>
    const link = typeof record.link === 'string' ? record.link : ''
    if (link && /\/image\/\d+\b/i.test(link)) return link
    if (Array.isArray(record.data)) {
      for (const child of record.data) {
        const nested = scan(child)
        if (nested) return nested
      }
    }
    return null
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = scan(entry)
      if (found) return found
    }
    return null
  }

  return scan(value)
}

async function hydrateSectionImageData(
  runtime: ItemSelectorRuntime,
  context: ItemSelectorContext,
  sections: ItemSelectorDetailSection[]
): Promise<ItemSelectorDetailSection[]> {
  const imageLinks = new Set<string>()
  for (const section of sections) {
    for (const row of section.rows) {
      if (row.imageLink) imageLinks.add(row.imageLink)
    }
  }
  if (imageLinks.size === 0) return sections

  const imageCache = new Map<string, string>()
  await Promise.all(
    Array.from(imageLinks).map(async (link) => {
      try {
        const payload = await runtime.requestPlmAction<FieldImageResponse>('getFieldImageData', {
          tenant: context.tenant,
          link
        })
        if (typeof payload?.dataUrl === 'string' && payload.dataUrl.trim().length > 0) {
          imageCache.set(link, payload.dataUrl)
        }
      } catch {
        // Keep rendering resilient if an image fails.
      }
    })
  )

  return sections.map((section) => ({
    ...section,
    rows: section.rows.map((row) => ({
      ...row,
      imageDataUrl: row.imageLink ? imageCache.get(row.imageLink) : undefined
    }))
  }))
}

function toDetailValue(value: unknown): { value: string; isRichHtml: boolean; imageLink?: string } {
  const text = stringifyDetailValue(value)
  const decoded = decodeHtmlEntities(text)
  const looksHtml = /<\s*[a-z][^>]*>/i.test(decoded)
  const imageLink = extractImageLink(value)
  return {
    value: decoded,
    isRichHtml: looksHtml,
    ...(imageLink ? { imageLink } : {})
  }
}

function extractSectionDetails(
  payload: Record<string, unknown>,
  workspacePresentation: WorkspacePresentation | null
): ItemSelectorDetailSection[] {
  const sections = extractArray(payload.sections)
  if (sections.length === 0) return []

  const result: ItemSelectorDetailSection[] = []
  for (const section of sections) {
    const sectionTitle = String(section.title || section.name || 'Section')
    const fields = extractArray(section.fields)
    const rows: ItemSelectorDetailRow[] = []

    for (const field of fields) {
      const fieldId = fieldIdFromSelf(field.__self__) || String(field.fieldId || field.id || '').trim().toUpperCase()
      const label = String(
        field.title ||
        field.name ||
        field.fieldId ||
        (field.type as Record<string, unknown> | undefined)?.title ||
        'Field'
      )
      const hiddenById = fieldId ? workspacePresentation?.hiddenFieldIds.has(fieldId) : false
      const hiddenByTitle = workspacePresentation?.hiddenFieldTitles.has(label.trim().toLowerCase())
      if (hiddenById || hiddenByTitle) continue

      const parsedValue = toDetailValue(field.value)
      rows.push({
        label,
        value: parsedValue.imageLink ? '-' : parsedValue.value,
        isRichHtml: parsedValue.isRichHtml,
        imageLink: parsedValue.imageLink
      })
    }

    if (rows.length > 0) {
      const expandedByDefault = workspacePresentation?.sectionExpandedByTitle.get(sectionTitle)
      result.push({ title: sectionTitle, rows, expandedByDefault: expandedByDefault ?? true })
    }
  }

  return result
}

function toAttachments(
  payload: AttachmentsResponse | undefined,
  context: ItemSelectorContext,
  itemId: number
): ItemSelectorAttachment[] {
  const fromData = extractArray(payload?.data)
  const fromRoot = extractArray(payload?.attachments)
  const source = fromData.length > 0 ? fromData : fromRoot

  return source.map((entry, index) => {
    const idRaw = entry.id
    const id =
      typeof idRaw === 'string' || typeof idRaw === 'number'
        ? String(idRaw)
        : `attachment-${index + 1}`

    const resourceName = String(entry.resourceName ?? entry.name ?? `Attachment ${index + 1}`)
    const extensionRaw = (entry.type as Record<string, unknown> | undefined)?.extension
    const extension = typeof extensionRaw === 'string' ? extensionRaw : ''
    const name = extension && !resourceName.endsWith(extension) ? `${resourceName}${extension}` : resourceName
    const sizeRaw = Number(entry.size)
    const versionRaw = entry.version
    const version = typeof versionRaw === 'string' || typeof versionRaw === 'number' ? String(versionRaw) : '-'
    const linkRaw = entry.link ?? entry.selfLink ?? entry.__self__ ?? entry.url
    const tenantCode = context.tenant.toUpperCase()
    const attachmentId = encodeURIComponent(String(id))
    const itemUrn = `urn:adsk.plm:tenant.workspace.item:${tenantCode}.${context.workspaceId}.${itemId}`
    const fileUrn = `urn:adsk.plm:tenant.workspace.item.attachment:${tenantCode}.${context.workspaceId}.${itemId}.${attachmentId}`
    const viewerUrl = `https://${context.tenant}.autodeskplm360.net/plm/fileViewer?itemUrn=${encodeURIComponent(itemUrn)}&fileUrn=${encodeURIComponent(fileUrn)}`

    return {
      id,
      name,
      resourceName,
      extension,
      size: Number.isFinite(sizeRaw) ? sizeRaw : null,
      version,
      link: typeof linkRaw === 'string' ? linkRaw : undefined,
      viewerUrl
    }
  })
}

export function createItemSelectorService(runtime: ItemSelectorRuntime): ItemSelectorService {
  let workspacePresentation: WorkspacePresentation | null = null

  return {
    // Fetches workspace field metadata used by advanced search and details visibility rules.
    async fetchWorkspaceFields(context) {
      const fields = await runtime.requestPlmAction<WorkspaceField[]>('fetchFields', {
        tenant: context.tenant,
        workspaceId: context.workspaceId
      })
      const normalizedFields = Array.isArray(fields) ? fields : []
      workspacePresentation = buildWorkspacePresentation(normalizedFields)
      return toSearchFields(normalizedFields)
    },
    // Executes scoped search and removes the caller-provided excluded item (for self-exclusion).
    async searchItems(context, groups, offset, limit, queryOverride) {
      const rawQuery = queryOverride || buildSearchQuery(groups)
      const searchQuery = ensureWorkspaceInQuery(context.workspaceId, rawQuery)
      const response = await runtime.requestPlmAction<SearchResponse>('searchBulk', {
        tenant: context.tenant,
        query: searchQuery,
        offset,
        limit,
        bulk: false,
        revision: 1,
        sort: 'createdOn asc'
      })

      const mappedItems = extractSearchItems(response)
        .map((item): ItemSelectorSearchResult | null => {
          const id = normalizeItemId(item)
          const dmsId = normalizeDmsId(item) || id
          if (!id || !dmsId) return null
          return {
            id,
            dmsId,
            workspaceId: normalizeWorkspaceId(item, context.workspaceId),
            descriptor: String(item.descriptor || item.itemDescriptor || item.title || ''),
            revision: normalizeRevision(item),
            title: normalizeTitle(item),
            itemUrn: typeof item.urn === 'string' ? item.urn : undefined
          }
        })
        .filter((item): item is ItemSelectorSearchResult => Boolean(item))

      const excludedItemId = context.excludedItemId
      const includesExcluded = typeof excludedItemId === 'number'
        ? mappedItems.some((item) => item.id === excludedItemId)
        : false
      const items = typeof excludedItemId === 'number'
        ? mappedItems.filter((item) => item.id !== excludedItemId)
        : mappedItems
      const rawTotalResults = extractSearchTotal(response, mappedItems.length)
      const totalResults = includesExcluded
        ? Math.max(0, rawTotalResults - 1)
        : rawTotalResults

      return {
        items,
        totalResults
      }
    },
    // Fetches item detail payload and applies visibility + section presentation rules.
    async fetchItemDetails(context, itemId) {
      const payload = await runtime.requestPlmAction<Record<string, unknown>>('getItemDetails', {
        tenant: context.tenant,
        workspaceId: context.workspaceId,
        dmsId: itemId
      })
      const sections = extractSectionDetails(payload, workspacePresentation)
      if (sections.length > 0) {
        return hydrateSectionImageData(runtime, context, sections)
      }

      const fallbackRows = flattenDetails(payload).slice(0, 500)
      return [{ title: 'Item Details', rows: fallbackRows }]
    },
    // Fetches and normalizes attachments for the selected row.
    async fetchItemAttachments(context, itemId) {
      const payload = await runtime.requestPlmAction<AttachmentsResponse>('getAttachments', {
        tenant: context.tenant,
        wsId: context.workspaceId,
        dmsId: itemId
      })
      return toAttachments(payload, context, itemId)
    }
  }
}

