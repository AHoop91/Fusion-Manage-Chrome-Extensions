import type { ColumnDef, ColumnFilters, ColumnIndexMap } from './types'

export const STYLE_ID = 'plm-extension-security-users-filter-style'
export const HIDDEN_STYLE_ID = 'plm-extension-security-users-hidden-style'
export const ROW_HIDDEN_CLASS = 'plm-extension-users-row-hidden'

export const FILTER_PANEL_ID = 'plm-extension-security-users-filter-panel'
export const FILTER_PANEL_HEADER_ID = 'plm-extension-security-users-filter-panel-header'
export const FILTER_PANEL_TITLE_GROUP_ID = 'plm-extension-security-users-filter-panel-title-group'
export const FILTER_ACTIONS_ID = 'plm-extension-security-users-filter-actions'
export const FILTER_APPLY_BUTTON_ID = 'plm-extension-security-users-filter-apply'
export const FILTER_CLEAR_BUTTON_ID = 'plm-extension-security-users-filter-clear'

export const GLOBAL_FILTER_CONTAINER_ID = 'plm-extension-security-users-filter'
export const GLOBAL_FILTER_COUNT_ID = 'plm-extension-security-users-filter-count'

export const EXPORT_BUTTON_ID = 'plm-extension-security-users-export-csv'
export const EXPORT_PROGRESS_ID = 'plm-extension-security-users-export-progress'
export const EXPORT_PROGRESS_TEXT_ID = 'plm-extension-security-users-export-progress-text'
export const EXPORT_PROGRESS_TRACK_ID = 'plm-extension-security-users-export-progress-track'
export const EXPORT_PROGRESS_FILL_ID = 'plm-extension-security-users-export-progress-fill'

export const COLUMN_FILTERS_ID = 'plm-extension-security-users-column-filters'
export const COLUMN_FILTER_INPUT_PREFIX = 'plm-extension-security-users-col-'

export const USERS_TABLE_SELECTOR = '.itembody-users table'

export const REINDEX_DEBOUNCE_MS = 120

export const CSV_EXPORT_CHUNK_SIZE = 250
export const CSV_EXPORT_YIELD_BUDGET_MS = 12

/**
 * Temporary UI test delay so progress animation is visible.
 * Set to 0 to restore full-speed export.
 */
export const CSV_EXPORT_TEST_DELAY_MS = 120

export const COLUMN_DEFS: ColumnDef[] = [
  { key: 'status', label: 'Status', aliases: ['status'], mode: 'select' },
  { key: 'authStatus', label: 'Auth Status', aliases: ['auth status'], mode: 'select' },
  { key: 'userName', label: 'User Name', aliases: ['user name'], mode: 'text' },
  { key: 'firstName', label: 'First Name', aliases: ['first name'], mode: 'text' },
  { key: 'lastName', label: 'Last Name', aliases: ['last name'], mode: 'text' },
  { key: 'email', label: 'Email', aliases: ['email'], mode: 'text' },
  { key: 'organization', label: 'Organization', aliases: ['organization', 'organisation'], mode: 'text' },
  { key: 'twoFactor', label: '2FA', aliases: ['2fa', 'two-factor authentication'], mode: 'select' }
]

export function createEmptyColumnFilters(): ColumnFilters {
  return {
    status: '',
    authStatus: '',
    userName: '',
    firstName: '',
    lastName: '',
    email: '',
    organization: '',
    twoFactor: ''
  }
}

export function createEmptyColumnIndexMap(): ColumnIndexMap {
  return {
    status: -1,
    authStatus: -1,
    userName: -1,
    firstName: -1,
    lastName: -1,
    email: -1,
    organization: -1,
    twoFactor: -1
  }
}
