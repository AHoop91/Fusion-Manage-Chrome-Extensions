import { createItemDetailsController } from './item-details.controller'
import type { ItemDetailsRuntime } from './item-details.types'
import type { PageModule } from '../../shared/runtime/types'

export function createItemDetailsPageModule(ext: ItemDetailsRuntime): PageModule {
  const controller = createItemDetailsController(ext)

  return {
    id: 'itemDetails',
    requiredSelectors: [],
    riskLevel: 'high',
    matches: controller.matches,
    mount: controller.mount,
    update: controller.update,
    unmount: controller.unmount
  }
}
