import { describe, expect, it } from 'vitest'
import type { FeatureFlags } from '../../../build/featureFlags'
import { mergeBuildWithRuntimeOverrides, resetEffectiveFeaturesToBuild } from '../effectiveFeatures'

describe('mergeBuildWithRuntimeOverrides', () => {
  const base: FeatureFlags = {
    enableItemDetails: true,
    enableGridFilters: true,
    enableGridAdvancedEditor: true,
    enableGridExport: true,
    enableGridImport: true,
    enableBomVariant: true,
    enableBomManufacturing: false,
    enableBomAdvancedDownload: true,
    enableTableaus: true,
    enableDesignComponents: false
  }

  it('cannot enable flags missing from the build', () => {
    const out = mergeBuildWithRuntimeOverrides(base, {
      enableDesignComponents: true,
      enableItemDetails: false
    })
    expect(out.enableDesignComponents).toBe(false)
    expect(out.enableItemDetails).toBe(false)
  })

  it('turns off a build-enabled flag when override is false', () => {
    const out = mergeBuildWithRuntimeOverrides(base, { enableTableaus: false })
    expect(out.enableTableaus).toBe(false)
    expect(out.enableItemDetails).toBe(true)
  })

  it('keeps grid export independent of grid filters in merged runtime flags', () => {
    const out = mergeBuildWithRuntimeOverrides(base, {
      enableGridFilters: false,
      enableGridExport: true
    })
    expect(out.enableGridFilters).toBe(false)
    expect(out.enableGridExport).toBe(true)
  })
})

describe('resetEffectiveFeaturesToBuild', () => {
  it('runs without throwing', () => {
    resetEffectiveFeaturesToBuild()
    expect(true).toBe(true)
  })
})
