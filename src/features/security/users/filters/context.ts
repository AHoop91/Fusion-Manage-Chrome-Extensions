import { USERS_TABLE_SELECTOR } from './constants'
import { isFusionHost } from '../../../../shared/url/parse'

export function getUsersTable(): HTMLTableElement | null {
  return document.querySelector(USERS_TABLE_SELECTOR) as HTMLTableElement | null
}

export function getUsersRoot(): HTMLElement | null {
  const table = getUsersTable()
  if (!table) return null
  return table.closest('.itemdisplay') as HTMLElement | null
}

export function getUsersMenu(): HTMLElement | null {
  const root = getUsersRoot()
  if (!root) return null
  return root.querySelector('.itemmenu') as HTMLElement | null
}

/**
 * Guard so the users feature only activates on the admin/users context.
 */
export function isUsersContext(): boolean {
  try {
    const url = new URL(window.location.href)
    if (!isFusionHost(url.href)) return false
    if (!/\/admin\b/i.test(url.pathname)) return false

    const hash = (url.hash || '').toLowerCase()
    if (hash.includes('section=adminusers')) return true
    if (hash.includes('tab=users')) return true

    return document.querySelector(USERS_TABLE_SELECTOR) !== null
  } catch {
    return false
  }
}
