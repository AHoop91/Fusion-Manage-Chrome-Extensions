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
 *   enableDesignComponents: boolean
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
   * Source: `src/features/grid`
   */
  grid: {
    /*
     * Filter panel, rules, apply/clear, row visibility.
     * Source: `src/features/grid/grid-filters`
     */
    filters: true,

    /*
     * Advanced grid editor (lazy-loaded form tooling).
     * Source: `src/features/grid/grid-advanced-editor`
     */
    advancedEditor: true,

    /*
     * CSV export for the grid (indexes rows; can be enabled without `filters`).
     * Source: `src/features/grid/grid-export`
     */
    export: true,

    /*
     * CSV import for the grid (field mapping and metadata validation).
     * Source: `src/features/grid/grid-import`
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
    variant: false,

    /*
     * Manufacturing Bill of Materials — Quick Create → manufacturing clone flow.
     * Source: `src/features/professional/bom/bom-clone` (`cloneLaunchMode` `manufacturing`).
     */
    manufacturing: false,

    /*
     * Advanced attachment download (row actions, modal, batch download).
     * Source: `src/features/professional/bom/bom-downloader`
     */
    advancedDownload: true
  },

  /*
   * Tableaus / views: workspace items list and split item-details surfaces that host views UI.
   * Emits `content/item-pages/tableaus.js` when enabled.
   * Source: `src/features/tableaus`
   */
  enableTableaus: true,

  /*
   * Design (CW_COMPONENTS) workspace: design-components chrome on supported item routes.
   * Emits `content/item-pages/design-components.js` when enabled.
   * Source: `src/features/design/components`
   *
   * Uses premium vendor APIs (e.g. Autodesk Platform Services / Model Derivative and related
   * services). Enabling this surface can incur usage-based charges; confirm billing and quotas
   * before shipping builds with this flag on.
   */
  enableDesignComponents: false
}

export default features
