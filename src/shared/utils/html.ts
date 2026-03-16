/**
 * Shared DOM-backed HTML normalization helpers.
 */
export function decodeHtmlEntities(raw: string): string {
  if (!raw.includes('&')) return raw
  const probe = document.createElement('textarea')
  probe.innerHTML = raw
  return probe.value || raw
}

export function stripHtml(raw: string): string {
  if (!raw.includes('<') || !raw.includes('>')) return raw
  const probe = document.createElement('div')
  probe.innerHTML = raw
  return (probe.textContent || probe.innerText || '').trim()
}
