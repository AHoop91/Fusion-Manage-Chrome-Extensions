export function normalizeItemDetailsFieldId(raw: string): string {
  const normalized = raw.trim().toUpperCase()
  return normalized.startsWith('ITEM_DETAILS:') ? normalized.slice('ITEM_DETAILS:'.length) : normalized
}

export function groupRefFromIndex(index: number): string {
  let value = index + 1
  let ref = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    ref = String.fromCharCode(65 + remainder) + ref
    value = Math.floor((value - 1) / 26)
  }
  return ref
}

export function formatAttachmentSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  return `${mb.toFixed(1)} MB`
}

export function normalizeRevisionToken(rawRevision: string): string {
  const trimmed = String(rawRevision || '').trim()
  if (!trimmed || trimmed === '-') return ''
  const unwrapped = trimmed.replace(/^\[+|\]+$/g, '').trim()
  return unwrapped
}

export function splitDescriptorAndRevision(
  descriptor: string,
  rawRevision: string
): { baseDescriptor: string; revisionToken: string } {
  const normalizedDescriptor = String(descriptor || '').trim()
  const revisionFromDescriptor = /\[([^\]]+)\]\s*$/.exec(normalizedDescriptor)
  const descriptorWithoutRevision = revisionFromDescriptor
    ? normalizedDescriptor.slice(0, Math.max(0, revisionFromDescriptor.index)).trim()
    : normalizedDescriptor
  const revisionToken = normalizeRevisionToken(rawRevision || (revisionFromDescriptor?.[1] || ''))
  return {
    baseDescriptor: descriptorWithoutRevision || normalizedDescriptor,
    revisionToken
  }
}
