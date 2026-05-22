/**
 * PLM HTTPS requests are limited to Fusion Manage tenant hosts.
 * Authentication uses the browser session (`credentials: 'include'`), not extension-stored tokens.
 */

export function isPlmAutodeskHttpsUrl(urlString: string): boolean {
  try {
    const u = new URL(urlString)
    return u.protocol === 'https:' && u.hostname.toLowerCase().endsWith('.autodeskplm360.net')
  } catch {
    return false
  }
}

export function assertPlmAutodeskHttpsUrl(urlString: string): void {
  if (!isPlmAutodeskHttpsUrl(urlString)) {
    throw new Error('[plm-ext] PLM HTTP client only supports https://*.autodeskplm360.net URLs')
  }
}
