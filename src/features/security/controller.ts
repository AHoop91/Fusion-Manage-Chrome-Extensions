import type { PlmExtRuntime } from '../../shared/runtime/types'
import { createSecurityState } from './state'
import { createSecurityUsersFeature } from './users/index'

type SecurityRuntime = Pick<PlmExtRuntime, 'isFusionHost'>

type SecurityController = {
  matches: (url: string) => boolean
  mount: () => void
  update: () => void
  unmount: () => void
}

export function createSecurityController(ext: SecurityRuntime): SecurityController {
  const state = createSecurityState()
  const usersFeature = createSecurityUsersFeature()

  function isSecurityPage(urlString: string): boolean {
    if (!ext.isFusionHost(urlString)) return false

    try {
      const url = new URL(urlString)
      const pathname = url.pathname.toLowerCase()
      const tab = (url.searchParams.get('tab') || '').toLowerCase()

      if (pathname.includes('/admin')) return true
      if (tab === 'users' || tab === 'groups' || tab === 'roles') return true
      return false
    } catch {
      return false
    }
  }

  return {
    matches(url) {
      return isSecurityPage(url)
    },
    mount() {
      usersFeature.mount()
      state.mounted = true
    },
    update() {
      usersFeature.mount()
    },
    unmount() {
      usersFeature.unmount()
      state.mounted = false
    }
  }
}
