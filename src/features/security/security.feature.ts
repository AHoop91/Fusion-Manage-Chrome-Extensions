import type { PlmExtRuntime, PageModule } from '../../shared/runtime/types'
import { SELECTORS } from '../../dom/Selectors'
import { createSecurityController } from './controller'

type SecurityRuntime = Pick<PlmExtRuntime, 'isFusionHost'>

export function createSecurityPageModule(ext: SecurityRuntime): PageModule {
  const controller = createSecurityController(ext)

  return {
    id: 'security',
    requiredSelectors: [SELECTORS.securityUsersTable],
    riskLevel: 'medium',
    matches: controller.matches,
    mount: controller.mount,
    update: controller.update,
    unmount: controller.unmount
  }
}
