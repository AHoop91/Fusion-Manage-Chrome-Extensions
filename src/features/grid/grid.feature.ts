/**
 * Grid page entrypoint.
 *
 * Registers the grid feature with the shared page router.
 */
import { createGridController } from './grid.controller'
import { createGridDom } from './grid-dom'
import { initRuntimeFeaturesFromStorage } from '../../extension/runtime/runtimeFeatureStorage'
import type { GridPageRuntime } from './grid.types'
import { createGridPageService } from './grid-services'
import type { PageModule } from '../../shared/runtime/types'

export function createGridPageModule(_ext: GridPageRuntime): PageModule {
  const service = createGridPageService(_ext)
  const dom = createGridDom()
  const controller = createGridController(_ext)
  let mounted = false
  let lifecycleGeneration = 0

  function runWithFreshRuntimeFeatures(action: () => void): void {
    const gen = lifecycleGeneration
    void initRuntimeFeaturesFromStorage().then(() => {
      if (!mounted || gen !== lifecycleGeneration) return
      action()
    })
  }

  return {
    id: 'grid',
    requiredSelectors: dom.requiredSelectors,
    matches(url) {
      return service.matches(url)
    },
    mount() {
      mounted = true
      runWithFreshRuntimeFeatures(() => controller.mount())
    },
    update() {
      runWithFreshRuntimeFeatures(() => controller.update())
    },
    unmount() {
      lifecycleGeneration += 1
      mounted = false
      controller.unmount()
    }
  }
}
