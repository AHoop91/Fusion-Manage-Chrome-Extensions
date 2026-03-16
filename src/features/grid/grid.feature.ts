/**
 * Grid page entrypoint.
 *
 * Registers the grid feature with the shared page router.
 */
import { createGridController } from './grid.controller'
import { createGridDom } from './grid.dom'
import type { GridPageRuntime } from './grid.types'
import { createGridService } from './services/grid.service'
import type { PageModule } from '../../shared/runtime/types'

export function createGridPageModule(_ext: GridPageRuntime): PageModule {
  const service = createGridService(_ext)
  const dom = createGridDom()
  const controller = createGridController(_ext)

  return {
    id: 'grid',
    requiredSelectors: dom.requiredSelectors,
    riskLevel: 'high',
    matches(url) {
      return service.matches(url)
    },
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
