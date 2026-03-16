import type { FeatureDefinition } from '../../../core/orchestration/featureRegistry'
import { SELECTORS } from '../../../dom/Selectors'
import { createSecurityUsersController } from './controller'
import { isUsersContext } from './filters/context'
import type { SecurityUsersController } from './types'

export function createSecurityUsersFilterDefinition(): FeatureDefinition {
  const controller = createSecurityUsersController()

  return {
    name: 'securityUsersFilter',
    requiredSelectors: [SELECTORS.securityUsersTable],
    riskLevel: 'medium',
    matches() {
      return isUsersContext()
    },
    initialize() {
      controller.mount()
    },
    update() {
      controller.mount()
    },
    teardown() {
      controller.unmount()
    }
  }
}

export function createSecurityUsersFeature(): SecurityUsersController {
  return createSecurityUsersController()
}
