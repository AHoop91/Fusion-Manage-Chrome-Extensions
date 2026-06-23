import type { FeatureFlagKey } from '../build/featureFlagKeys'
import type { FeatureFlags } from '../build/featureFlags'
import type { FeatureBuildIconName } from './featureBuildSummary'

export type RuntimeToggleRow = {
  flagKey: FeatureFlagKey
  id: string
  icon: FeatureBuildIconName
  accent: string
  pill?: 'premium'
  title: string
  detail: string
}

/** Every flag that can appear in the popup runtime section (order = display order). */
export const RUNTIME_TOGGLE_ROWS: RuntimeToggleRow[] = [
  {
    flagKey: 'enableItemDetails',
    id: 'itemDetails',
    icon: 'document',
    accent: '#0696d7',
    title: 'Item Details & Add Item',
    detail: 'Command bar, related links, and field helpers on item and add-item routes.'
  },
  {
    flagKey: 'enableGridFilters',
    id: 'gridFilters',
    icon: 'filter',
    accent: '#3949ab',
    title: 'Grid Filtering',
    detail: 'Filter rules and row visibility on the workspace items grid.'
  },
  {
    flagKey: 'enableGridAdvancedEditor',
    id: 'gridAdvancedEditor',
    icon: 'pencil',
    accent: '#6a1b9a',
    title: 'Grid Advanced Editor',
    detail: 'Staged row edits and form tooling on the grid tab.'
  },
  {
    flagKey: 'enableGridExport',
    id: 'gridExport',
    icon: 'arrowDownTray',
    accent: '#00695c',
    title: 'Grid CSV Export',
    detail: 'CSV export for the current grid (all rows when filtering is off).'
  },
  {
    flagKey: 'enableGridImport',
    id: 'gridImport',
    icon: 'arrowUpTray',
    accent: '#00796b',
    title: 'Grid CSV Import',
    detail: 'CSV import with metadata-driven field mapping on the grid tab.'
  },
  {
    flagKey: 'enableBomVariant',
    id: 'bomVariant',
    icon: 'layers',
    accent: '#c62828',
    title: 'Variant BOM Clone',
    detail: 'Engineering Quick Create on the nested BOM tab.'
  },
  {
    flagKey: 'enableBomManufacturing',
    id: 'bomManufacturing',
    icon: 'table',
    accent: '#e65100',
    title: 'Manufacturing BOM Clone',
    detail: 'Manufacturing Quick Create on the nested BOM tab.'
  },
  {
    flagKey: 'enableBomAdvancedDownload',
    id: 'bomAdvancedDownload',
    icon: 'arrowDownCircle',
    accent: '#0277bd',
    title: 'BOM Attachment Download',
    detail: 'Advanced attachment download on the nested BOM tab.'
  },
  {
    flagKey: 'enableTableaus',
    id: 'tableaus',
    icon: 'viewColumns',
    accent: '#00838f',
    title: 'Workspace Views',
    detail: 'Tableaus export, import, and manage on supported pages.'
  },
  {
    flagKey: 'enableDesignComponents',
    id: 'designComponents',
    icon: 'cube',
    accent: '#5d4037',
    pill: 'premium',
    title: 'Design Components',
    detail: 'CW_COMPONENTS model conversion (metered Autodesk Platform Services).'
  }
]

export function isFlagInBuild(row: RuntimeToggleRow, build: FeatureFlags): boolean {
  return Boolean(build[row.flagKey])
}
