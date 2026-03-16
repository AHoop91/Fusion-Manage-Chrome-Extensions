import type { SecurityUsersFeature } from './filters/types'

export type SecurityUsersState = {
  mounted: boolean
  usersFeature: SecurityUsersFeature | null
}

export function createSecurityUsersState(): SecurityUsersState {
  return {
    mounted: false,
    usersFeature: null
  }
}
