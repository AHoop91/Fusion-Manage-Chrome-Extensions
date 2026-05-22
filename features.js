/**
 * Build-time feature flags (canonical defaults for this repo).
 * Top-level booleans map to `FeatureFlags` in `src/build/featureFlags.ts`.
 * Nested `grid` is flattened at load time to `enableGridFilters`, `enableGridAdvancedEditor`, `enableGridExport`, `enableGridImport`.
 * Nested `bom` is flattened at load time to `enableBomVariant`, `enableBomManufacturing`, `enableBomAdvancedDownload`.
 *
 * Optional: pass a different module with the same shape, e.g.
 *   npm run build -- --features=./features.customer-a.js
 *
 * When a lazy-page flag is `false` at **production** build time (`node scripts/build.mjs`):
 * - That bundle may be omitted under `dist/`
 * - `dist/manifest.json` `web_accessible_resources` is trimmed
 * - `content/item-pages/index.js` omits the loader when the whole page is off
 *
 * @typedef {import('./src/build/featureFlags').FeatureFlags} FeatureFlags
 */

/**
 * @typedef {{
 *   variant: boolean
 *   manufacturing: boolean
 *   advancedDownload: boolean
 * }} BomFeatureSwitches
 */

/**
 * @typedef {{
 *   filters: boolean
 *   advancedEditor: boolean
 *   export: boolean
 *   import: boolean
 * }} GridFeatureSwitches
 */

/**
 * @typedef {{
 *   enableItemDetails: boolean
 *   grid: GridFeatureSwitches
 *   bom: BomFeatureSwitches
 *   enableTableaus: boolean
 * }} FeaturesFileExport
 */

/** @type {FeaturesFileExport} */
const features = {
  /*
   * Item details & add-item PLM pages: command bar (options, related links, search), caches, and
   * related tooling. Emits `content/item-pages/item-details.js` when enabled.
   * Source: `src/features/professional/item-details`
   */
  enableItemDetails: true,

  /*
   * Item workspace grid tab: combine filters, advanced editor, and CSV export.
   * At least one must be true to emit/load `content/item-pages/grid.js`.
   * Source: `src/features/shared/grid`
   */
  grid: {
    /*
     * Filter panel, rules, apply/clear, row visibility.
     * Source: `src/features/shared/grid/grid-filters`
     */
    filters: true,

    /*
     * Advanced grid editor (lazy-loaded form tooling).
     * Source: `src/features/shared/grid/grid-advanced-editor`
     */
    advancedEditor: true,

    /*
     * CSV export for the grid (indexes rows; can be enabled without `filters`).
     * Source: `src/features/shared/grid/grid-export`
     */
    export: true,

    /*
     * CSV import for the grid (field mapping and metadata validation).
     * Source: `src/features/shared/grid/grid-import`
     */
    import: true
  },

  /*
   * Nested BOM workspace (`/items/bom/nested`): enable any combination of the three surfaces below.
   * At least one must be true to emit/load `content/item-pages/bom.js`.
   */
  bom: {
    /*
     * Variant Bill of Materials — Quick Create → engineering clone flow.
     * Source: `src/features/professional/bom/bom-clone` (`cloneLaunchMode` `engineering`).
     */
    variant: true,

    /*
     * Manufacturing Bill of Materials — Quick Create → manufacturing clone flow.
     * Source: `src/features/professional/bom/bom-clone` (`cloneLaunchMode` `manufacturing`).
     */
    manufacturing: true,

    /*
     * Advanced attachment download (row actions, modal, batch download).
     * Source: `src/features/professional/bom/bom-downloader`
     */
    advancedDownload: true
  },

  /*
   * Tableaus / views: workspace items list and split item-details surfaces that host views UI.
   * Emits `content/item-pages/tableaus.js` when enabled.
   * Source: `src/features/shared/tableaus`
   */
  enableTableaus: true
}

export default features
