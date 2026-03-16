import { createUsersFilterFeature } from './feature'
import type { FeatureDefinition } from '../../../../core/orchestration/featureRegistry'
import { isUsersContext } from './context'
import { SELECTORS } from '../../../../dom/Selectors'

export function createSecurityUsersFilterDefinition(): FeatureDefinition {
  const feature = createUsersFilterFeature()

  return {
    name: 'securityUsersFilter',
    requiredSelectors: [SELECTORS.securityUsersTable],
    riskLevel: 'medium',
    matches() {
      return isUsersContext()
    },
    initialize() {
      feature.mount()
    },
    update() {
      feature.mount()
    },
    teardown() {
      feature.unmount()
    }
  }
}
