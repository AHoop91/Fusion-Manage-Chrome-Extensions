/**
 * Build-time feature flags (values are injected by Vite `define` in dev, build, and Vitest).
 *
 * Names follow lazy page-module ids in `src/app/itemPagesBootstrap.ts`, which map to areas under
 * `src/features` (for example `enableItemDetails` → `src/features/professional/item-details`).
 *
 * Production builds (`scripts/build.mjs`) skip bundling disabled page modules and trim
 * `dist/manifest.json` `web_accessible_resources` accordingly. In dev, all modules remain available
 * unless you point `--features=` at a profile with flags set to false.
 *
 * Grid flags in `features.js` are nested as `grid.filters`, `grid.advancedEditor`, `grid.export`, `grid.import`;
 * `scripts/loadFeatureFlags.mjs` flattens them to `enableGridFilters`, `enableGridAdvancedEditor`, `enableGridExport`, `enableGridImport`.
 *
 * BOM flags in `features.js` are nested as `bom.variant`, `bom.manufacturing`, `bom.advancedDownload`;
 * `scripts/loadFeatureFlags.mjs` flattens them to `enableBomVariant`, `enableBomManufacturing`, `enableBomAdvancedDownload`.
 *
 * When adding a flag: update `features.js` at the repo root (or your `--features=` module), extend `FeatureFlags` and the
 * matching `declare const` / `FEATURES` entries below, extend `normalizeFeaturesExport` in `loadFeatureFlags.mjs`, and
 * wire the flag into `scripts/build.mjs` and `scripts/patchDistManifest.mjs` if it controls a separate bundle.
 */
export type FeatureFlags = {
  /** `src/features/professional/item-details` (page id `itemDetails`). */
  enableItemDetails: boolean
  /** Grid tab: filter panel, rules, apply/clear (page id `grid`). */
  enableGridFilters: boolean
  /** Grid tab: lazy advanced editor / form tooling (page id `grid`). */
  enableGridAdvancedEditor: boolean
  /** Grid tab: CSV export (indexes the grid; can be enabled without filtering). */
  enableGridExport: boolean
  /** Grid tab: CSV import with metadata-driven field mapping. */
  enableGridImport: boolean
  /**
   * Nested BOM: Quick Create → “Variant Bill of Materials” (engineering clone flow).
   * Source: `src/features/professional/bom/bom-clone` (engineering / variant paths).
   */
  enableBomVariant: boolean
  /**
   * Nested BOM: Quick Create → “Manufacturing Bill of Materials” (manufacturing clone flow).
   * Source: `src/features/professional/bom/bom-clone` (manufacturing paths).
   */
  enableBomManufacturing: boolean
  /**
   * Nested BOM: advanced attachment download (modal, batch download, etc.).
   * Source: `src/features/professional/bom/bom-downloader`
   */
  enableBomAdvancedDownload: boolean
  /** `src/features/tableaus` (page id `tableaus`). */
  enableTableaus: boolean
  /**
   * `src/features/design/components` (page id `designComponents`). Uses premium vendor APIs (APS /
   * Model Derivative, etc.); usage can incur charges—confirm billing before enabling in shipped builds.
   */
  enableDesignComponents: boolean
}

declare const __BUILD_FEATURE_FLAG_enableItemDetails__: boolean
declare const __BUILD_FEATURE_FLAG_enableGridFilters__: boolean
declare const __BUILD_FEATURE_FLAG_enableGridAdvancedEditor__: boolean
declare const __BUILD_FEATURE_FLAG_enableGridExport__: boolean
declare const __BUILD_FEATURE_FLAG_enableGridImport__: boolean
declare const __BUILD_FEATURE_FLAG_enableBomVariant__: boolean
declare const __BUILD_FEATURE_FLAG_enableBomManufacturing__: boolean
declare const __BUILD_FEATURE_FLAG_enableBomAdvancedDownload__: boolean
declare const __BUILD_FEATURE_FLAG_enableTableaus__: boolean
declare const __BUILD_FEATURE_FLAG_enableDesignComponents__: boolean

export const FEATURES: FeatureFlags = {
  enableItemDetails: __BUILD_FEATURE_FLAG_enableItemDetails__,
  enableGridFilters: __BUILD_FEATURE_FLAG_enableGridFilters__,
  enableGridAdvancedEditor: __BUILD_FEATURE_FLAG_enableGridAdvancedEditor__,
  enableGridExport: __BUILD_FEATURE_FLAG_enableGridExport__,
  enableGridImport: __BUILD_FEATURE_FLAG_enableGridImport__,
  enableBomVariant: __BUILD_FEATURE_FLAG_enableBomVariant__,
  enableBomManufacturing: __BUILD_FEATURE_FLAG_enableBomManufacturing__,
  enableBomAdvancedDownload: __BUILD_FEATURE_FLAG_enableBomAdvancedDownload__,
  enableTableaus: __BUILD_FEATURE_FLAG_enableTableaus__,
  enableDesignComponents: __BUILD_FEATURE_FLAG_enableDesignComponents__
}

/** True when any grid sub-feature should load (`content/item-pages/grid.js`). */
export function isGridPageFeatureEnabled(features: FeatureFlags): boolean {
  return (
    features.enableGridFilters ||
    features.enableGridAdvancedEditor ||
    features.enableGridExport ||
    features.enableGridImport
  )
}

/** True when any nested-BOM lazy chunk should load (`content/item-pages/bom.js`). */
export function isBomPageFeatureEnabled(features: FeatureFlags): boolean {
  return (
    features.enableBomVariant ||
    features.enableBomManufacturing ||
    features.enableBomAdvancedDownload
  )
}
