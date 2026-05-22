/**
 * Validates tenant labels and resolves Fusion Manage API URLs so the background
 * worker never performs authenticated fetches to arbitrary hosts (see Secure Node rules).
 */

/** Allowed tenant subdomain labels for https://{tenant}.autodeskplm360.net */
const TENANT_LABEL_RE = /^[a-z0-9][a-z0-9-]{0,62}$/i

/**
 * Relative paths allowed for extension-initiated PLM API calls (v2 images, v3 JSON, REST BOM).
 */
export const DEFAULT_PLM_API_PATH_PATTERN = /^\/api\/(?:v\d+\/|rest\/v\d+\/)/

export const API_V3_JSON_PATH_PATTERN = /^\/api\/v3\//

export function normalizeTenantLabel(tenant: unknown): string {
  return String(tenant || '').trim().toLowerCase()
}

export function tenantOrigin(tenant: unknown): string {
  const label = normalizeTenantLabel(tenant)
  if (!label) {
    throw new Error('tenant is required')
  }
  if (!TENANT_LABEL_RE.test(label)) {
    throw new Error('Invalid tenant label')
  }
  return `https://${label}.autodeskplm360.net`
}

/**
 * @param pathPattern — applied to `pathname` only (after resolution against tenant origin)
 */
export function resolveTenantPlmUrl(
  tenant: unknown,
  pathOrUrl: string,
  pathPattern: RegExp = DEFAULT_PLM_API_PATH_PATTERN
): string {
  const origin = tenantOrigin(tenant)
  const expectedHost = new URL(origin).hostname.toLowerCase()
  const raw = String(pathOrUrl || '').trim()
  if (!raw) {
    throw new Error('path is required')
  }

  let resolved: URL
  if (/^https?:\/\//i.test(raw)) {
    resolved = new URL(raw)
  } else {
    if (raw.startsWith('//')) {
      throw new Error('Relative API path must not start with //')
    }
    const path = raw.startsWith('/') ? raw : `/${raw}`
    resolved = new URL(path, origin)
  }

  if (resolved.protocol !== 'https:') {
    throw new Error('Only HTTPS URLs are allowed')
  }
  if (resolved.hostname.toLowerCase() !== expectedHost) {
    throw new Error('URL must target the current tenant host')
  }
  if (!pathPattern.test(resolved.pathname)) {
    throw new Error('URL path is not an allowed Fusion Manage API path')
  }

  return `${origin}${resolved.pathname}${resolved.search}`
}
