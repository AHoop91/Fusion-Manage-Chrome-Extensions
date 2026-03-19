export type AttachmentDownloadRules = {
  selectedExtensions: string[]
  customExtensions: string[]
  customExtensionInput: string
  fileNameSearchText: string
  lastModifiedRange: 'anytime' | 'today' | 'yesterday' | 'this-week' | 'this-month' | 'this-year' | '30d' | '60d' | '180d' | '365d' | 'custom'
  customModifiedFrom: string
  customModifiedTo: string
  createSubFolders: 'per-item' | 'per-top-level-item' | 'matching-bom-path'
  renameFiles:
    | 'none'
    | 'filename-date'
    | 'date-filename'
    | 'filename-version'
    | 'filename-version-date'
    | 'filename-revision-version'
    | 'filename-revision-version-date'
    | 'descriptor'
    | 'descriptor-date'
    | 'descriptor-version'
    | 'descriptor-version-date'
    | 'descriptor-revision-version'
    | 'descriptor-revision-version-date'
}

export const EXTENSION_GROUPS = [
  {
    id: 'pdf',
    label: 'PDF',
    extensions: ['.pdf'],
    tooltip: 'Automatically includes .pdf files.'
  },
  {
    id: 'stp',
    label: 'STP',
    extensions: ['.step', '.stp'],
    tooltip: 'Automatically includes .step and .stp files.'
  },
  {
    id: 'office',
    label: 'Office',
    extensions: ['.docx', '.xlsx', '.ppt', '.pptx'],
    tooltip: 'Automatically includes .docx, .xlsx, .ppt, and .pptx files.'
  }
] as const

export function createDefaultAttachmentDownloadRules(): AttachmentDownloadRules {
  return {
    selectedExtensions: ['.pdf', '.docx', '.xlsx', '.ppt', '.pptx', '.step', '.stp'],
    customExtensions: [],
    customExtensionInput: '',
    fileNameSearchText: '',
    lastModifiedRange: 'anytime',
    customModifiedFrom: '',
    customModifiedTo: '',
    createSubFolders: 'per-item',
    renameFiles: 'none'
  }
}

export function splitExtensions(value: string): string[] {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

export function normalizeCustomExtensionToken(value: string): string {
  const trimmed = String(value || '').trim().toLowerCase().replace(/,+$/g, '')
  if (!trimmed) return ''
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`
}

export function isValidCustomExtensionToken(value: string): boolean {
  const trimmed = String(value || '').trim().toLowerCase().replace(/,+$/g, '')
  if (!trimmed) return false
  const normalized = trimmed.startsWith('.') ? trimmed : `.${trimmed}`
  if (normalized === '.') return false
  const dotCount = (normalized.match(/\./g) || []).length
  if (dotCount !== 1) return false
  return /^\.[a-z0-9_-]+$/i.test(normalized)
}

export function areGroupExtensionsSelected(selectedExtensions: string[], groupExtensions: readonly string[]): boolean {
  return groupExtensions.every((extension) => selectedExtensions.includes(extension))
}

export function toggleExtensionGroup(
  selectedExtensions: string[],
  groupExtensions: readonly string[],
  checked: boolean
): string[] {
  const next = new Set(selectedExtensions)
  for (const extension of groupExtensions) {
    if (checked) next.add(extension)
    else next.delete(extension)
  }
  return Array.from(next)
}

export function applyCustomModifiedFrom(currentRules: AttachmentDownloadRules, nextFrom: string): AttachmentDownloadRules {
  const nextTo =
    currentRules.customModifiedTo && nextFrom && nextFrom > currentRules.customModifiedTo
      ? nextFrom
      : currentRules.customModifiedTo

  return {
    ...currentRules,
    customModifiedFrom: nextFrom,
    customModifiedTo: nextTo
  }
}

export function applyCustomModifiedTo(currentRules: AttachmentDownloadRules, nextTo: string): AttachmentDownloadRules {
  const nextFrom =
    currentRules.customModifiedFrom && nextTo && nextTo < currentRules.customModifiedFrom
      ? nextTo
      : currentRules.customModifiedFrom

  return {
    ...currentRules,
    customModifiedFrom: nextFrom,
    customModifiedTo: nextTo
  }
}
