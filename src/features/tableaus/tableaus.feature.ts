import { createTableausController } from './tableaus.controller'
import { initRuntimeFeaturesFromStorage } from '../../extension/runtime/runtimeFeatureStorage'
import type { TableausRuntime } from './tableaus.types'
import type { PageModule } from '../../shared/runtime/types'

export function createTableausPageModule(ext: TableausRuntime): PageModule {
  const controller = createTableausController(ext)
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
    id: 'tableaus',
    matches: controller.matches,
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
