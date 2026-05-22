import type { FeatureFlags } from '../build/featureFlags'

/** Icon name must match a branch in `FeatureIcon` (`featureIcons.jsx`). */
export type FeatureBuildIconName =
  | 'document'
  | 'filter'
  | 'pencil'
  | 'table'
  | 'arrowDownTray'
  | 'arrowUpTray'
  | 'layers'
  | 'arrowDownCircle'
  | 'viewColumns'
  | 'cube'

export type PopupFeatureLine = {
  id: string
  icon: FeatureBuildIconName
  /** Accent color (icon well + left stripe). */
  accent: string
  title: string
  detail: string
  /** Small callout next to the title (e.g. premium vendor APIs). */
  pill?: 'premium'
}

/**
 * Human-readable lines for the extension popup, derived from compile-time {@link FeatureFlags}.
 * Only enabled surfaces are listed.
 */
export function getEnabledBuildFeatureLines(features: FeatureFlags): PopupFeatureLine[] {
  const lines: PopupFeatureLine[] = []

  if (features.enableItemDetails) {
    lines.push({
      id: 'itemDetails',
      icon: 'document',
      accent: '#0696d7',
      title: 'Item Details & Add Item',
      detail:
        'Command bar, related links, and empty- or required-field helpers on item and add-item routes.'
    })
  }

  if (features.enableGridFilters) {
    lines.push({
      id: 'gridFilters',
      icon: 'filter',
      accent: '#3949ab',
      title: 'Grid Filtering',
      detail: 'Filter rules, apply and clear, and row visibility on the workspace items grid.'
    })
  }
  if (features.enableGridAdvancedEditor) {
    lines.push({
      id: 'gridAdvancedEditor',
      icon: 'pencil',
      accent: '#6a1b9a',
      title: 'Grid Advanced Editor',
      detail: 'Staged row edits and form tooling (loaded when you use the grid tab).'
    })
  }
  if (features.enableGridExport) {
    lines.push({
      id: 'gridExport',
      icon: 'arrowDownTray',
      accent: '#00695c',
      title: 'Grid CSV Export',
      detail: 'Download grid rows to CSV (all rows when filtering is off; respects filter visibility when it is on).'
    })
  }
  if (features.enableGridImport) {
    lines.push({
      id: 'gridImport',
      icon: 'arrowUpTray',
      accent: '#00796b',
      title: 'Grid CSV Import',
      detail: 'Upload CSV rows with field mapping on the workspace items grid.'
    })
  }

  if (features.enableBomVariant) {
    lines.push({
      id: 'bomVariant',
      icon: 'layers',
      accent: '#c62828',
      title: 'Variant BOM Clone',
      detail: 'Engineering Quick Create flow on the nested BOM tab (variant bill of materials).'
    })
  }
  if (features.enableBomManufacturing) {
    lines.push({
      id: 'bomManufacturing',
      icon: 'table',
      accent: '#e65100',
      title: 'Manufacturing BOM Clone',
      detail: 'Manufacturing Quick Create flow on the nested BOM tab.'
    })
  }
  if (features.enableBomAdvancedDownload) {
    lines.push({
      id: 'bomAdvancedDownload',
      icon: 'arrowDownCircle',
      accent: '#0277bd',
      title: 'BOM Attachment Download',
      detail: 'Row actions, modal, and batch download for BOM attachments where supported.'
    })
  }

  if (features.enableTableaus) {
    lines.push({
      id: 'tableaus',
      icon: 'viewColumns',
      accent: '#00838f',
      title: 'Workspace Views',
      detail: 'Tableaus: export, import, and manage views from supported list and split item pages.'
    })
  }

  return lines
}
