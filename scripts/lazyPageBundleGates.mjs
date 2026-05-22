/**
 * Predicates shared by `scripts/build.mjs` (Rollup `input.*`) and
 * `scripts/patchDistManifest.mjs` (`web_accessible_resources` for lazy bundles).
 *
 * @param {Pick<Record<string, boolean>, 'enableGridFilters' | 'enableGridAdvancedEditor' | 'enableGridExport' | 'enableGridImport'>} flags
 */
export function isGridLazyBundleEnabled(flags) {
  return flags.enableGridFilters || flags.enableGridAdvancedEditor || flags.enableGridExport || flags.enableGridImport
}

/**
 * @param {Pick<Record<string, boolean>, 'enableBomVariant' | 'enableBomManufacturing' | 'enableBomAdvancedDownload'>} flags
 */
export function isBomLazyBundleEnabled(flags) {
  return flags.enableBomVariant || flags.enableBomManufacturing || flags.enableBomAdvancedDownload
}
