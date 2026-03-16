import { createGridFiltersFeature } from './filters/index'
import { createGridState } from './grid.state'
import type { GridFeatureLifecycle, GridPageRuntime } from './grid.types'
import { createGridService } from './services/grid.service'
import { createGridView } from './view/grid.view'

function createLazyGridFormFeature(ext: Pick<GridPageRuntime, 'requestPlmAction'>): GridFeatureLifecycle {
  let feature: GridFeatureLifecycle | null = null
  let loadPromise: Promise<GridFeatureLifecycle> | null = null
  let shouldBeMounted = false
  let hasMountedFeature = false

  function applyMountIfNeeded(): void {
    if (!feature || !shouldBeMounted || hasMountedFeature) return
    feature.mount()
    hasMountedFeature = true
  }

  function ensureFeature(): Promise<GridFeatureLifecycle> {
    if (feature) return Promise.resolve(feature)
    if (loadPromise) return loadPromise
    loadPromise = import('./advanced-view')
      .then((module) => {
        feature = module.createGridFormFeature(ext)
        return feature
      })
      .finally(() => {
        loadPromise = null
      })
    return loadPromise
  }

  return {
    mount() {
      shouldBeMounted = true
      void ensureFeature().then((loadedFeature) => {
        if (feature !== loadedFeature || !shouldBeMounted) return
        applyMountIfNeeded()
      })
    },
    update() {
      shouldBeMounted = true
      if (feature) {
        applyMountIfNeeded()
        feature.update()
        return
      }
      void ensureFeature().then((loadedFeature) => {
        if (feature !== loadedFeature || !shouldBeMounted) return
        applyMountIfNeeded()
        loadedFeature.update()
      })
    },
    unmount() {
      shouldBeMounted = false
      if (!feature || !hasMountedFeature) return
      feature.unmount()
      hasMountedFeature = false
    }
  }
}

/**
 * Grid page feature composition root.
 *
 * Keep page-level orchestration here and delegate
 * feature-specific behavior to submodules.
 */
export function createGridController(ext: GridPageRuntime): GridFeatureLifecycle {
  const state = createGridState()
  const service = createGridService(ext)
  const view = createGridView(
    service.createCapabilities({
      createGridFiltersFeature,
      createGridFormFeature: createLazyGridFormFeature
    })
  )

  return {
    mount() {
      state.setMounted(true)
      view.mount(state.getSnapshot())
    },
    update() {
      if (!state.getSnapshot().mounted) state.setMounted(true)
      view.update(state.getSnapshot())
    },
    unmount() {
      view.unmount(state.getSnapshot())
      state.reset()
    }
  }
}
