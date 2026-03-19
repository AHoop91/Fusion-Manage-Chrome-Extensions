import type { BomCloneStructureRow } from '../../clone/services/structure/tree.service'

export type AttachmentExtensionSummaryEntry = {
  extension: string
  count: number
}

export type AttachmentDownloadSummary = {
  matchedCount: number
  totalCount: number
}

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
