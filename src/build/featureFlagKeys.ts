import type { FeatureFlags } from './featureFlags'

/** Keys persisted in {@link chrome.storage} for per-browser runtime overrides. */
export type FeatureFlagKey = keyof FeatureFlags

export const FEATURE_FLAG_KEYS: FeatureFlagKey[] = [
  'enableItemDetails',
  'enableGridFilters',
  'enableGridAdvancedEditor',
  'enableGridExport',
  'enableGridImport',
  'enableBomVariant',
  'enableBomManufacturing',
  'enableBomAdvancedDownload',
  'enableTableaus',
  'enableDesignComponents'
]
