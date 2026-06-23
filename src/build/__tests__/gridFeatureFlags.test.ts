// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { FeatureFlags } from '../featureFlags'
import { isBomPageFeatureEnabled, isGridPageFeatureEnabled } from '../featureFlags'
import { isBomLazyBundleEnabled, isGridLazyBundleEnabled } from '../../../scripts/lazyPageBundleGates.mjs'
import { normalizeFeaturesExport } from '../../../scripts/loadFeatureFlags.mjs'
import { computeWebAccessibleResources } from '../../../scripts/patchDistManifest.mjs'

function baselineFeatures(overrides: Partial<FeatureFlags> = {}): FeatureFlags {
  return {
    enableItemDetails: true,
    enableGridFilters: false,
    enableGridAdvancedEditor: false,
    enableGridExport: false,
    enableGridImport: false,
    enableBomVariant: true,
    enableBomManufacturing: true,
    enableBomAdvancedDownload: true,
    enableTableaus: true,
    enableDesignComponents: true,
    ...overrides
  }
}

describe('grid feature flags vs lazy bundle gate (build + manifest)', () => {
  it('keeps isGridPageFeatureEnabled aligned with isGridLazyBundleEnabled used by build.mjs / patchDistManifest', () => {
    const combos: Partial<FeatureFlags>[] = [
      {},
      { enableGridFilters: true },
      { enableGridAdvancedEditor: true },
      { enableGridExport: true },
      { enableGridImport: true },
      { enableGridFilters: true, enableGridAdvancedEditor: true },
      { enableGridFilters: false, enableGridAdvancedEditor: false, enableGridExport: false, enableGridImport: false }
    ]
    for (const partial of combos) {
      const f = baselineFeatures(partial)
      expect(isGridPageFeatureEnabled(f)).toBe(isGridLazyBundleEnabled(f))
    }
  })

  it('omits grid.js from web_accessible_resources when every grid sub-flag is false (matches skipped Rollup grid input)', () => {
    const flags = baselineFeatures({
      enableGridFilters: false,
      enableGridAdvancedEditor: false,
      enableGridExport: false,
      enableGridImport: false
    })
    expect(isGridLazyBundleEnabled(flags)).toBe(false)
    const resources = computeWebAccessibleResources(flags as Record<string, boolean>)
    expect(resources).not.toContain('content/item-pages/grid.js')
  })

  it('includes grid.js when any grid sub-flag is true', () => {
    for (const partial of [
      { enableGridFilters: true },
      { enableGridAdvancedEditor: true },
      { enableGridExport: true },
      { enableGridImport: true }
    ] as const) {
      const flags = baselineFeatures(partial)
      expect(isGridLazyBundleEnabled(flags)).toBe(true)
      const resources = computeWebAccessibleResources(flags as Record<string, boolean>)
      expect(resources).toContain('content/item-pages/grid.js')
    }
  })

})

describe('normalizeFeaturesExport (grid nesting)', () => {
  const validTop = {
    enableItemDetails: true,
    grid: { filters: true, advancedEditor: true, export: true, import: true },
    bom: { variant: true, manufacturing: true, advancedDownload: true },
    enableTableaus: true,
    enableDesignComponents: true
  }

  it('flattens grid.* to enableGrid*', () => {
    const flat = normalizeFeaturesExport(validTop, 'test-features')
    expect(flat.enableGridFilters).toBe(true)
    expect(flat.enableGridAdvancedEditor).toBe(true)
    expect(flat.enableGridExport).toBe(true)
    expect(flat.enableGridImport).toBe(true)
  })

  it('allows grid.export without grid.filters (flattened independently)', () => {
    const flat = normalizeFeaturesExport(
      {
        ...validTop,
        grid: { filters: false, advancedEditor: true, export: true, import: true }
      },
      'test-features'
    )
    expect(flat.enableGridFilters).toBe(false)
    expect(flat.enableGridExport).toBe(true)
    expect(flat.enableGridImport).toBe(true)
    expect(flat.enableGridAdvancedEditor).toBe(true)
  })
})

describe('BOM bundle gate stays aligned (regression)', () => {
  it('matches isBomPageFeatureEnabled for representative flag sets', () => {
    const f = baselineFeatures({
      enableBomVariant: false,
      enableBomManufacturing: false,
      enableBomAdvancedDownload: false
    })
    expect(isBomPageFeatureEnabled(f)).toBe(isBomLazyBundleEnabled(f))
  })
})
