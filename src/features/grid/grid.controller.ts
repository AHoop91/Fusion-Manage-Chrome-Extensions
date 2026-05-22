import { FEATURES } from '../../build/featureFlags'
import { getEffectiveFeatures } from '../../extension/runtime/effectiveFeatures'
import { createGridFiltersFeature } from './grid-filters'
import { createGridImportFeature } from './grid-import'
import { createGridState } from './grid.state'
import type { GridFeatureLifecycle, GridPageRuntime } from './grid.types'
import type { GridFormFeature } from './grid-advanced-editor/types'
import type { GridImportEditOpenResult, GridImportEditSession } from './grid-staging/grid-import-edit-session'
import { createGridView } from './grid-view'

const noopCapability: GridFeatureLifecycle = {
  mount() {},
  update() {},
  unmount() {}
}

type LazyGridFormFeatureHandle = GridFeatureLifecycle & {
  openForTableWithImportSession: (session: GridImportEditSession) => Promise<GridImportEditOpenResult>
}

type LazyGridFormFeatureOptions = {
  onImportCsv?: () => void
}

function createLazyGridFormFeature(
  ext: Pick<GridPageRuntime, 'requestPlmAction'>,
  options: LazyGridFormFeatureOptions = {}
): LazyGridFormFeatureHandle {
  let feature: GridFormFeature | null = null
  let loadPromise: Promise<GridFormFeature> | null = null
  let shouldBeMounted = false
  let hasMountedFeature = false
  let mountGeneration = 0

  function applyMountIfNeeded(expectedGen: number): void {
    if (expectedGen !== mountGeneration || !feature || !shouldBeMounted || hasMountedFeature) return
    feature.mount()
    hasMountedFeature = true
  }

  function ensureFeature(): Promise<GridFormFeature> {
    if (feature) return Promise.resolve(feature)
    if (loadPromise) return loadPromise
    loadPromise = import('./grid-advanced-editor')
      .then((module) => {
        feature = module.createGridFormFeature(ext, { onImportCsv: options.onImportCsv })
        return feature
      })
      .finally(() => {
        loadPromise = null
      })
    return loadPromise
  }

  async function openForTableWithImportSession(session: GridImportEditSession): Promise<GridImportEditOpenResult> {
    if (!FEATURES.enableGridAdvancedEditor) {
      return { ok: false, reason: 'Advanced editor is not available in this build.' }
    }
    try {
      const loadedFeature = await ensureFeature()
      if (shouldBeMounted) {
        applyMountIfNeeded(mountGeneration)
        if (hasMountedFeature) loadedFeature.update()
      }
      return await loadedFeature.openForTableWithImportSession(session)
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : 'Failed to open advanced editor.'
      }
    }
  }

  return {
    mount() {
      shouldBeMounted = true
      const gen = mountGeneration
      void ensureFeature().then((loadedFeature) => {
        if (feature !== loadedFeature || !shouldBeMounted || gen !== mountGeneration) return
        applyMountIfNeeded(gen)
      })
    },
    update() {
      shouldBeMounted = true
      const gen = mountGeneration
      if (feature) {
        applyMountIfNeeded(gen)
        if (gen === mountGeneration && hasMountedFeature) {
          feature.update()
        }
        return
      }
      void ensureFeature().then((loadedFeature) => {
        if (feature !== loadedFeature || !shouldBeMounted || gen !== mountGeneration) return
        applyMountIfNeeded(gen)
        if (gen === mountGeneration && hasMountedFeature) {
          loadedFeature.update()
        }
      })
    },
    unmount() {
      mountGeneration += 1
      shouldBeMounted = false
      if (feature && hasMountedFeature) {
        feature.unmount()
        hasMountedFeature = false
      }
    },
    openForTableWithImportSession
  }
}

function buildGridCapabilities(ext: GridPageRuntime): GridFeatureLifecycle[] {
  const next: GridFeatureLifecycle[] = []
  const gridImportRef: { current: ReturnType<typeof createGridImportFeature> | null } = { current: null }

  let lazyAdvancedEditor: LazyGridFormFeatureHandle | null = FEATURES.enableGridAdvancedEditor
    ? createLazyGridFormFeature(ext, {
        onImportCsv: () => {
          if (getEffectiveFeatures().enableGridImport) {
            gridImportRef.current?.open({ fromAdvancedEditor: true })
          }
        }
      })
    : null

  const gridImport = FEATURES.enableGridImport
    ? createGridImportFeature(ext, {
        enableGridAdvancedEditor: () =>
          Boolean(lazyAdvancedEditor) && getEffectiveFeatures().enableGridAdvancedEditor,
        onEditInAdvancedEditor: async (session) => {
          if (!lazyAdvancedEditor) {
            return { ok: false, reason: 'Advanced editor is not available in this build.' }
          }
          return lazyAdvancedEditor.openForTableWithImportSession(session)
        }
      })
    : null
  gridImportRef.current = gridImport

  if (FEATURES.enableGridFilters || FEATURES.enableGridExport || FEATURES.enableGridImport) {
    next.push(
      createGridFiltersFeature({
        getToolbarFlags: () => {
          const f = getEffectiveFeatures()
          return {
            enableFiltering: f.enableGridFilters,
            enableCsvExport: f.enableGridExport,
            enableGridImport: f.enableGridImport,
            enableAdvancedEditor: f.enableGridAdvancedEditor
          }
        },
        onImportCsv: () => {
          if (getEffectiveFeatures().enableGridImport) gridImport?.open()
        }
      })
    )
  }
  if (gridImport) next.push(gridImport)
  if (lazyAdvancedEditor) next.push(lazyAdvancedEditor)
  return next
}

/**
 * Grid page feature composition root.
 *
 * Keep page-level orchestration here and delegate
 * feature-specific behavior to submodules.
 */
export function createGridController(ext: GridPageRuntime): GridFeatureLifecycle {
  const state = createGridState()

  let view = createGridView([noopCapability])

  return {
    mount() {
      state.setMounted(true)
      const caps = buildGridCapabilities(ext)
      view = createGridView(caps.length > 0 ? caps : [noopCapability])
      view.mount()
    },
    update() {
      if (!state.getSnapshot().mounted) state.setMounted(true)
      view.update()
    },
    unmount() {
      view.unmount()
      state.reset()
      view = createGridView([noopCapability])
    }
  }
}
