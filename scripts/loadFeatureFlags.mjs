import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * @param {string} absolutePath
 */
async function importFeatureModule(absolutePath) {
  const href = pathToFileURL(absolutePath).href
  return import(`${href}?t=${Date.now()}`)
}

/**
 * @param {readonly string[] | string[]} argv
 * @returns {string | null}
 */
export function parseFeaturesFileArg(argv) {
  for (const arg of argv) {
    if (typeof arg === 'string' && arg.startsWith('--features=')) {
      return arg.slice('--features='.length).trim()
    }
  }
  return null
}

/**
 * @param {string} root Project root (cwd for builds).
 * @param {readonly string[] | string[]} argv
 */
export function resolveFeaturesFile(root, argv) {
  const fromArg = parseFeaturesFileArg(argv)
  const relative = fromArg && fromArg.length > 0 ? fromArg : 'features.js'
  const absolute = resolve(root, relative)
  if (!existsSync(absolute)) {
    throw new Error(`Feature flags file not found: ${absolute}`)
  }
  if (!/\.m?js$/i.test(absolute)) {
    throw new Error(`Feature flags must be a .js or .mjs file (got: ${absolute})`)
  }
  return absolute
}

/**
 * @param {unknown} value
 * @param {string} label
 */
function assertPlainObject(value, label) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must use \`export default { ... }\` with a plain object`)
  }
}

/**
 * Normalize `features.js` (nested `grid`, `bom`) into the flat shape consumed by Vite `define` and `FeatureFlags`.
 *
 * @param {unknown} raw
 * @param {string} label Human-readable path for errors.
 * @returns {Record<string, boolean>}
 */
export function normalizeFeaturesExport(raw, label) {
  assertPlainObject(raw, `${label} default export`)
  const o = /** @type {Record<string, unknown>} */ (raw)

  for (const key of ['enableItemDetails', 'enableTableaus', 'enableDesignComponents']) {
    if (!Object.prototype.hasOwnProperty.call(o, key)) {
      throw new Error(`${label}: missing required key "${key}"`)
    }
    if (typeof o[key] !== 'boolean') {
      throw new Error(`${label}: "${key}" must be a boolean`)
    }
  }

  if (!Object.prototype.hasOwnProperty.call(o, 'grid')) {
    throw new Error(`${label}: missing required key "grid"`)
  }
  const grid = o.grid
  assertPlainObject(grid, `${label}.grid`)
  const g = /** @type {Record<string, unknown>} */ (grid)
  for (const gk of ['filters', 'advancedEditor', 'export', 'import']) {
    if (!Object.prototype.hasOwnProperty.call(g, gk)) {
      throw new Error(`${label}: grid.${gk} is required`)
    }
    if (typeof g[gk] !== 'boolean') {
      throw new Error(`${label}: grid.${gk} must be a boolean`)
    }
  }
  if (!Object.prototype.hasOwnProperty.call(o, 'bom')) {
    throw new Error(`${label}: missing required key "bom"`)
  }
  const bom = o.bom
  assertPlainObject(bom, `${label}.bom`)
  const b = /** @type {Record<string, unknown>} */ (bom)
  for (const bk of ['variant', 'manufacturing', 'advancedDownload']) {
    if (!Object.prototype.hasOwnProperty.call(b, bk)) {
      throw new Error(`${label}: bom.${bk} is required`)
    }
    if (typeof b[bk] !== 'boolean') {
      throw new Error(`${label}: bom.${bk} must be a boolean`)
    }
  }

  const allowedTop = new Set(['enableItemDetails', 'grid', 'bom', 'enableTableaus', 'enableDesignComponents'])
  const unknownTop = Object.keys(o).filter((k) => !allowedTop.has(k))
  if (unknownTop.length > 0) {
    throw new Error(`${label}: unknown top-level keys: ${unknownTop.join(', ')}`)
  }

  const allowedBom = new Set(['variant', 'manufacturing', 'advancedDownload'])
  const unknownBom = Object.keys(b).filter((k) => !allowedBom.has(k))
  if (unknownBom.length > 0) {
    throw new Error(`${label}: bom has unknown keys: ${unknownBom.join(', ')}`)
  }

  const allowedGrid = new Set(['filters', 'advancedEditor', 'export', 'import'])
  const unknownGrid = Object.keys(g).filter((k) => !allowedGrid.has(k))
  if (unknownGrid.length > 0) {
    throw new Error(`${label}: grid has unknown keys: ${unknownGrid.join(', ')}`)
  }

  return {
    enableItemDetails: o.enableItemDetails,
    enableGridFilters: g.filters,
    enableGridAdvancedEditor: g.advancedEditor,
    enableGridExport: g.export,
    enableGridImport: g.import,
    enableBomVariant: b.variant,
    enableBomManufacturing: b.manufacturing,
    enableBomAdvancedDownload: b.advancedDownload,
    enableTableaus: o.enableTableaus,
    enableDesignComponents: o.enableDesignComponents
  }
}

/**
 * Load feature flags from ESM modules. Canonical shape comes from `features.js` (repo root).
 * Nested `grid.{ filters, advancedEditor, export }` is flattened to `enableGrid*` for the app.
 * Nested `bom.{ variant, manufacturing, advancedDownload }` is flattened to `enableBom*` for the app.
 *
 * @param {string} root Project root.
 * @param {string} featuresFilePath Absolute path to the flags module (e.g. another file passed via `--features=`).
 * @returns {Promise<Record<string, boolean>>}
 */
export async function loadFeatureFlags(root, featuresFilePath) {
  const templatePath = resolve(root, 'features.js')
  const templateMod = await importFeatureModule(templatePath)
  const templateFlat = normalizeFeaturesExport(templateMod.default, templatePath)

  const dataMod = await importFeatureModule(featuresFilePath)
  const dataFlat = normalizeFeaturesExport(dataMod.default, featuresFilePath)

  const templateKeys = Object.keys(templateFlat).sort()
  const keys = Object.keys(dataFlat).sort()
  if (templateKeys.length !== keys.length || templateKeys.some((k, i) => k !== keys[i])) {
    throw new Error(
      `Feature flags in ${featuresFilePath} must normalize to the same keys as features.js (expected: ${templateKeys.join(', ')})`
    )
  }
  for (const k of keys) {
    if (typeof dataFlat[k] !== 'boolean') {
      throw new Error(`Feature flag "${k}" must be a boolean in ${featuresFilePath}`)
    }
  }
  return /** @type {Record<string, boolean>} */ (dataFlat)
}

/**
 * Values for Vite/esbuild `define` (each flag becomes a compile-time boolean literal).
 *
 * @param {Record<string, boolean>} flags
 * @returns {Record<string, string>}
 */
export function buildFeatureFlagDefine(flags) {
  /** @type {Record<string, string>} */
  const define = {}
  for (const [key, value] of Object.entries(flags)) {
    define[`__BUILD_FEATURE_FLAG_${key}__`] = JSON.stringify(value)
  }
  return define
}
