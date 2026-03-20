const ALLOWED_ATTACHMENT_DOWNLOAD_HOST_SUFFIXES = [
  '.amazonaws.com',
] as const

function hasAllowedHostSuffix(hostname: string): boolean {
  const normalizedHost = String(hostname || '').trim().toLowerCase()
  if (!normalizedHost) return false

  return ALLOWED_ATTACHMENT_DOWNLOAD_HOST_SUFFIXES.some((suffix) => (
    normalizedHost === suffix.slice(1) || normalizedHost.endsWith(suffix)
  ))
}

export function isAllowedAttachmentDownloadUrl(value: unknown): boolean {
  const rawValue = String(value || '').trim()
  if (!rawValue) return false

  try {
    const url = new URL(rawValue)
    if (url.protocol !== 'https:') return false
    if (url.username || url.password) return false
    if (url.port && url.port !== '443') return false
    return hasAllowedHostSuffix(url.hostname)
  } catch {
    return false
  }
}

export function assertAllowedAttachmentDownloadUrl(value: unknown): string {
  const rawValue = String(value || '').trim()
  if (!isAllowedAttachmentDownloadUrl(rawValue)) {
    throw new Error('Attachment download URL must be a trusted HTTPS AWS host.')
  }
  return rawValue
}
