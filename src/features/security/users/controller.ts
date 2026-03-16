import { createUsersFilterFeature } from './filters/feature'
import { createSecurityUsersState } from './state'
import type { SecurityUsersController } from './types'

export function createSecurityUsersController(): SecurityUsersController {
  const state = createSecurityUsersState()

  return {
    mount() {
      if (!state.usersFeature) {
        state.usersFeature = createUsersFilterFeature()
      }
      state.usersFeature.mount()
      state.mounted = true
    },
    unmount() {
      if (state.usersFeature) {
        state.usersFeature.unmount()
      }
      state.mounted = false
    }
  }
}
