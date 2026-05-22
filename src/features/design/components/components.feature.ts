import type { PageModule, PlmExtRuntime } from '../../../shared/runtime/types'
import { createDesignComponentsController } from './components.controller'

export function createDesignComponentsPageModule(ext: PlmExtRuntime): PageModule {
  const controller = createDesignComponentsController(ext)

  return {
    id: 'designComponents',
    // Registry requires every selector to exist before initialize(); Components workspace may not expose `#command-bar-react`.
    requiredSelectors: ['.item-header-icons'],
    matches: controller.matches,
    mount() {
      controller.mount()
    },
    update() {
      controller.update()
    },
    unmount() {
      controller.unmount()
    }
  }
}
