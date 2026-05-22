import type { FeatureFlagKey } from '../../build/featureFlagKeys'
import { FEATURES, type FeatureFlags } from '../../build/featureFlags'

let effective: FeatureFlags = mergeBuildWithRuntimeOverrides(FEATURES, {})

/**
 * Merge build-time flags with optional per-browser overrides from {@link chrome.storage}.
 * Overrides cannot turn on features missing from the build.
 */
export function mergeBuildWithRuntimeOverrides(
  build: FeatureFlags,
  overrides: Partial<Record<FeatureFlagKey, boolean>> | null | undefined
): FeatureFlags {
  const o = overrides && typeof overrides === 'object' ? overrides : {}
  const next: FeatureFlags = {
    enableItemDetails: build.enableItemDetails && (o.enableItemDetails !== false),
    enableGridFilters: build.enableGridFilters && (o.enableGridFilters !== false),
    enableGridAdvancedEditor: build.enableGridAdvancedEditor && (o.enableGridAdvancedEditor !== false),
    enableGridExport: build.enableGridExport && (o.enableGridExport !== false),
    enableGridImport: build.enableGridImport && (o.enableGridImport !== false),
    enableBomVariant: build.enableBomVariant && (o.enableBomVariant !== false),
    enableBomManufacturing: build.enableBomManufacturing && (o.enableBomManufacturing !== false),
    enableBomAdvancedDownload: build.enableBomAdvancedDownload && (o.enableBomAdvancedDownload !== false),
    enableTableaus: build.enableTableaus && (o.enableTableaus !== false)
  }
  return next
}

export function getEffectiveFeatures(): FeatureFlags {
  return effective
}

export function setEffectiveFeatures(next: FeatureFlags): void {
  effective = { ...next }
}

/** Reset to compile-time defaults (e.g. tests). */
export function resetEffectiveFeaturesToBuild(): void {
  effective = { ...FEATURES }
}
