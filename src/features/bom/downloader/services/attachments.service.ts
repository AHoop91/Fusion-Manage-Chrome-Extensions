import type { BomCloneStructureRow } from '../../clone/services/structure/tree.service'
import type { AttachmentDownloadFile, AttachmentDownloadRowRequest, AttachmentDownloadRowResult } from '../types'
import type { AttachmentDownloadRules } from './rules.service'

export type AttachmentExtensionSummaryEntry = {
  extension: string
  count: number
}

export type AttachmentDownloadSummary = {
  matchedCount: number
  totalCount: number
}

export type ResolvedAttachmentDownloadSummary = AttachmentDownloadSummary & {
  resolvedRowCount: number
  failedRowCount: number
}

type AttachmentRowNode = Pick<
  BomCloneStructureRow['node'],
  'id' | 'itemLink' | 'splitSourceNodeId' | 'label' | 'bomFieldValues' | 'bomFieldContents'
>

export function parseAttachmentNames(value: string | undefined): string[] {
  const text = String(value || '').trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry || '').trim()).filter(Boolean) : []
  } catch {
    return []
  }
}

export function extractAttachmentExtension(fileName: string): string {
  const text = String(fileName || '').trim()
  if (!text) return ''
  const lastDotIndex = text.lastIndexOf('.')
  if (lastDotIndex <= 0 || lastDotIndex === text.length - 1) return '(no extension)'
  return text.slice(lastDotIndex).toLowerCase()
}

export function formatExtensionDisplayLabel(value: string): string {
  const trimmed = String(value || '').trim()
  if (!trimmed) return ''
  if (trimmed === '(no extension)') return 'NO EXTENSION'
  return trimmed.replace(/^\./, '').toUpperCase()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeFileNameForSearch(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s._\-()[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildWildcardMatcher(value: string): RegExp | null {
  const trimmed = String(value || '').trim().toLowerCase()
  if (!trimmed) return null
  const pattern = escapeRegExp(trimmed).replace(/\\\*/g, '.*').replace(/\\\?/g, '.')
  try {
    return new RegExp(pattern, 'i')
  } catch {
    return null
  }
}

export function matchesAttachmentFileName(searchText: string, fileName: string): boolean {
  const rawSearch = String(searchText || '').trim()
  if (!rawSearch) return true

  const originalName = String(fileName || '').trim().toLowerCase()
  const normalizedName = normalizeFileNameForSearch(fileName)
  if (!originalName && !normalizedName) return false

  const clauses = rawSearch
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

  const searchClauses = clauses.length > 0 ? clauses : [rawSearch]

  return searchClauses.some((clause) => {
    const tokens = clause.split(/\s+/).map((entry) => entry.trim()).filter(Boolean)
    if (tokens.length === 0) return false

    return tokens.every((token) => {
      if (token.includes('*') || token.includes('?')) {
        const matcher = buildWildcardMatcher(token)
        return Boolean(matcher && (matcher.test(originalName) || matcher.test(normalizedName)))
      }

      const normalizedToken = normalizeFileNameForSearch(token)
      return originalName.includes(token.toLowerCase()) || normalizedName.includes(normalizedToken)
    })
  })
}

export function buildAttachmentExtensionSummary(
  previewRows: BomCloneStructureRow[],
  attachmentFieldViewDefId: string | null
): AttachmentExtensionSummaryEntry[] {
  if (!attachmentFieldViewDefId) return []

  const counts = new Map<string, number>()
  for (const row of previewRows) {
    const attachmentNames = parseAttachmentNames(row.node.bomFieldContents?.[attachmentFieldViewDefId])
    for (const attachmentName of attachmentNames) {
      const extension = extractAttachmentExtension(attachmentName)
      counts.set(extension, (counts.get(extension) || 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .map(([extension, count]) => ({ extension, count }))
    .sort((left, right) => right.count - left.count || left.extension.localeCompare(right.extension))
}

export function buildAttachmentDownloadSummary(params: {
  previewRows: BomCloneStructureRow[]
  attachmentFieldViewDefId: string | null
  selectedExtensions: string[]
  fileNameSearchText: string
  normalizeExtension: (value: string) => string
}): AttachmentDownloadSummary {
  const { previewRows, attachmentFieldViewDefId, selectedExtensions, fileNameSearchText, normalizeExtension } = params
  if (!attachmentFieldViewDefId) return { matchedCount: 0, totalCount: 0 }

  const selectedExtensionSet = new Set(selectedExtensions.map((extension) => normalizeExtension(extension)))
  const hasExtensionFilter = selectedExtensionSet.size > 0
  let totalCount = 0
  let matchedCount = 0

  for (const row of previewRows) {
    const attachmentNames = parseAttachmentNames(row.node.bomFieldContents?.[attachmentFieldViewDefId])
    for (const attachmentName of attachmentNames) {
      totalCount += 1
      const extension = extractAttachmentExtension(attachmentName)
      const matchesExtension = !hasExtensionFilter || selectedExtensionSet.has(extension)
      const matchesSearch = matchesAttachmentFileName(fileNameSearchText, attachmentName)
      if (matchesExtension && matchesSearch) {
        matchedCount += 1
      }
    }
  }

  return { matchedCount, totalCount }
}

function resolveAttachmentRowDmsId(node: AttachmentRowNode): number | null {
  const direct = Number.parseInt(String(node.id || '').trim(), 10)
  if (Number.isFinite(direct) && direct > 0) return direct

  const splitSource = Number.parseInt(String(node.splitSourceNodeId || '').trim(), 10)
  if (Number.isFinite(splitSource) && splitSource > 0) return splitSource

  const itemLink = String(node.itemLink || '').trim()
  if (!itemLink) return null

  const match = /\/items\/(\d+)\b/i.exec(itemLink)
  if (!match) return null

  const fromLink = Number.parseInt(match[1], 10)
  return Number.isFinite(fromLink) && fromLink > 0 ? fromLink : null
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function startOfWeek(date: Date): Date {
  const next = startOfDay(date)
  const day = next.getDay()
  const diff = day === 0 ? 6 : day - 1
  next.setDate(next.getDate() - diff)
  return next
}

function buildModifiedDateRange(params: Pick<AttachmentDownloadRules, 'lastModifiedRange' | 'customModifiedFrom' | 'customModifiedTo'>): {
  from: number | null
  to: number | null
} {
  const now = new Date()
  const todayStart = startOfDay(now)
  const todayEnd = endOfDay(now)

  switch (params.lastModifiedRange) {
    case 'today':
      return { from: todayStart.getTime(), to: todayEnd.getTime() }
    case 'yesterday': {
      const yesterday = new Date(todayStart)
      yesterday.setDate(yesterday.getDate() - 1)
      return { from: startOfDay(yesterday).getTime(), to: endOfDay(yesterday).getTime() }
    }
    case 'this-week':
      return { from: startOfWeek(now).getTime(), to: todayEnd.getTime() }
    case 'this-month':
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime(),
        to: todayEnd.getTime()
      }
    case 'this-year':
      return {
        from: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0).getTime(),
        to: todayEnd.getTime()
      }
    case '30d':
    case '60d':
    case '180d':
    case '365d': {
      const days = Number.parseInt(params.lastModifiedRange.replace(/d$/i, ''), 10)
      if (!Number.isFinite(days) || days <= 0) return { from: null, to: null }
      const from = startOfDay(new Date(now.getTime() - ((days - 1) * 24 * 60 * 60 * 1000)))
      return { from: from.getTime(), to: todayEnd.getTime() }
    }
    case 'custom': {
      const from = params.customModifiedFrom ? startOfDay(new Date(`${params.customModifiedFrom}T00:00:00`)).getTime() : null
      const to = params.customModifiedTo ? endOfDay(new Date(`${params.customModifiedTo}T00:00:00`)).getTime() : null
      return { from: Number.isFinite(from) ? from : null, to: Number.isFinite(to) ? to : null }
    }
    case 'anytime':
    default:
      return { from: null, to: null }
  }
}

export function matchesAttachmentModifiedDate(
  timestamp: string,
  params: Pick<AttachmentDownloadRules, 'lastModifiedRange' | 'customModifiedFrom' | 'customModifiedTo'>
): boolean {
  if (params.lastModifiedRange === 'anytime') return true

  const parsed = Date.parse(String(timestamp || ''))
  if (!Number.isFinite(parsed)) return false

  const range = buildModifiedDateRange(params)
  if (range.from !== null && parsed < range.from) return false
  if (range.to !== null && parsed > range.to) return false
  return true
}

export function matchesAttachmentDownloadFile(params: {
  attachment: AttachmentDownloadFile
  selectedExtensions: string[]
  fileNameSearchText: string
  normalizeExtension: (value: string) => string
  lastModifiedRange: AttachmentDownloadRules['lastModifiedRange']
  customModifiedFrom: string
  customModifiedTo: string
}): boolean {
  const { attachment, selectedExtensions, fileNameSearchText, normalizeExtension, lastModifiedRange, customModifiedFrom, customModifiedTo } = params
  const selectedExtensionSet = new Set(selectedExtensions.map((extension) => normalizeExtension(extension)).filter(Boolean))
  const normalizedExtension = normalizeExtension(attachment.extension)
  const matchesExtension = selectedExtensionSet.size === 0 || selectedExtensionSet.has(normalizedExtension)
  if (!matchesExtension) return false

  const fileName = attachment.name || attachment.resourceName
  if (!matchesAttachmentFileName(fileNameSearchText, fileName)) return false

  return matchesAttachmentModifiedDate(attachment.timestamp, {
    lastModifiedRange,
    customModifiedFrom,
    customModifiedTo
  })
}

export function buildAttachmentDownloadRowRequests(params: {
  previewRows: BomCloneStructureRow[]
  attachmentFieldViewDefId: string | null
  selectedExtensions: string[]
  fileNameSearchText: string
  normalizeExtension: (value: string) => string
}): AttachmentDownloadRowRequest[] {
  const { previewRows, attachmentFieldViewDefId, selectedExtensions, fileNameSearchText, normalizeExtension } = params
  const selectedExtensionSet = new Set(selectedExtensions.map((extension) => normalizeExtension(extension)).filter(Boolean))
  const hasPreFilter = selectedExtensionSet.size > 0 || Boolean(String(fileNameSearchText || '').trim())

  return previewRows.flatMap((row) => {
    const dmsId = resolveAttachmentRowDmsId(row.node)
    if (!Number.isFinite(dmsId) || dmsId === null || dmsId <= 0) return []

    if (!attachmentFieldViewDefId) {
      return [{
        rowId: row.id,
        rowLabel: row.node.label || `Item ${dmsId}`,
        dmsId
      }]
    }

    const attachmentCountValue = Number(String(row.node.bomFieldValues?.[attachmentFieldViewDefId] || '').trim())
    const attachmentNames = parseAttachmentNames(row.node.bomFieldContents?.[attachmentFieldViewDefId])
    const hasKnownAttachments = attachmentNames.length > 0 || (Number.isFinite(attachmentCountValue) && attachmentCountValue > 0)
    if (!hasKnownAttachments) return []

    if (hasPreFilter && attachmentNames.length > 0) {
      const hasMatchingPreviewName = attachmentNames.some((attachmentName) => {
        const extension = normalizeExtension(extractAttachmentExtension(attachmentName))
        const matchesExtension = selectedExtensionSet.size === 0 || selectedExtensionSet.has(extension)
        if (!matchesExtension) return false
        return matchesAttachmentFileName(fileNameSearchText, attachmentName)
      })
      if (!hasMatchingPreviewName) return []
    }

    return [{
      rowId: row.id,
      rowLabel: row.node.label || `Item ${dmsId}`,
      dmsId
    }]
  })
}

export function filterResolvedAttachmentDownloadRows(params: {
  rowResults: AttachmentDownloadRowResult[]
  selectedExtensions: string[]
  fileNameSearchText: string
  normalizeExtension: (value: string) => string
  lastModifiedRange: AttachmentDownloadRules['lastModifiedRange']
  customModifiedFrom: string
  customModifiedTo: string
}): AttachmentDownloadRowResult[] {
  const { rowResults, selectedExtensions, fileNameSearchText, normalizeExtension, lastModifiedRange, customModifiedFrom, customModifiedTo } = params
  return rowResults.map((row) => ({
    ...row,
    attachments: row.attachments.filter((attachment) => matchesAttachmentDownloadFile({
      attachment,
      selectedExtensions,
      fileNameSearchText,
      normalizeExtension,
      lastModifiedRange,
      customModifiedFrom,
      customModifiedTo
    }))
  }))
}

export function buildResolvedAttachmentDownloadSummary(rowResults: AttachmentDownloadRowResult[]): ResolvedAttachmentDownloadSummary {
  let matchedCount = 0
  let totalCount = 0
  let resolvedRowCount = 0
  let failedRowCount = 0

  for (const row of rowResults) {
    totalCount += row.attachments.length
    matchedCount += row.attachments.length
    if (row.error) failedRowCount += 1
    else resolvedRowCount += 1
  }

  return {
    matchedCount,
    totalCount,
    resolvedRowCount,
    failedRowCount
  }
}
