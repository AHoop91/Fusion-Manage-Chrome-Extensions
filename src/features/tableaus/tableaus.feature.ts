import { createTableausController } from './tableaus.controller'
import type { TableausRuntime } from './tableaus.types'
import type { PageModule } from '../../shared/runtime/types'

export function createTableausPageModule(ext: TableausRuntime): PageModule {
  const controller = createTableausController(ext)

  return {
    id: 'tableaus',
    riskLevel: 'low',
    matches: controller.matches,
    mount: controller.mount,
    update: controller.update,
    unmount: controller.unmount
  }
}
