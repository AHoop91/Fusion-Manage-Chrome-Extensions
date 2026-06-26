import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isBomLazyBundleEnabled, isGridLazyBundleEnabled } from './lazyPageBundleGates.mjs'

/**
 * Chrome MV3 `web_accessible_resources.matches` must use `/*` as the path segment.
 * Content-script patterns like `https://*.example.com/plm/*` are invalid here.
 *
 * @param {string} pattern
 * @returns {string}
 */
export function normalizeWebAccessibleResourceMatchPattern(pattern) {
  const trimmed = String(pattern || '').trim()
  const match = /^([*]|https?|file|ftp):\/\/([^/]+)(\/.*)?$/.exec(trimmed)
  if (!match) return trimmed
  return `${match[1]}://${match[2]}/*`
}

/**
 * @param {Record<string, boolean>} flags Feature flags from `loadFeatureFlags`.
 * @returns {string[]}
 */
export function computeWebAccessibleResources(flags) {
  const resources = []
  if (flags.enableItemDetails) resources.push('content/item-pages/item-details.js')
  if (isGridLazyBundleEnabled(flags)) {
    resources.push('content/item-pages/grid.js')
  }
  if (isBomLazyBundleEnabled(flags)) {
    resources.push('content/item-pages/bom.js')
  }
  if (flags.enableTableaus) resources.push('content/item-pages/tableaus.js')
  if (flags.enableDesignComponents) resources.push('content/item-pages/design-components.js')
  if (resources.length > 0) resources.push('content/item-pages/chunks/*.js')
  return resources
}

/**
 * Restrict `web_accessible_resources` to lazy chunks that were actually built for this flag set.
 *
 * @param {string} outDir Absolute path to `dist/`.
 * @param {Record<string, boolean>} flags
 */
export function patchDistManifest(outDir, flags) {
  const manifestPath = resolve(outDir, 'manifest.json')
  const raw = readFileSync(manifestPath, 'utf8')
  const manifest = JSON.parse(raw)
  const war = manifest.web_accessible_resources
  if (!Array.isArray(war) || war.length === 0) {
    throw new Error('dist/manifest.json: expected web_accessible_resources[0]')
  }
  const resources = computeWebAccessibleResources(flags)
  if (resources.length === 0) {
    delete manifest.web_accessible_resources
  } else {
    war[0].resources = resources
    if (Array.isArray(war[0].matches)) {
      war[0].matches = war[0].matches.map(normalizeWebAccessibleResourceMatchPattern)
    }
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}
