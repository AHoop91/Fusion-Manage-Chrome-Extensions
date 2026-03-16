import {
  COLUMN_DEFS,
  COLUMN_FILTER_INPUT_PREFIX,
  COLUMN_FILTERS_ID,
  EXPORT_BUTTON_ID,
  EXPORT_PROGRESS_FILL_ID,
  EXPORT_PROGRESS_ID,
  EXPORT_PROGRESS_TEXT_ID,
  EXPORT_PROGRESS_TRACK_ID,
  FILTER_ACTIONS_ID,
  FILTER_APPLY_BUTTON_ID,
  FILTER_CLEAR_BUTTON_ID,
  FILTER_PANEL_HEADER_ID,
  FILTER_PANEL_ID,
  FILTER_PANEL_TITLE_GROUP_ID,
  GLOBAL_FILTER_CONTAINER_ID,
  GLOBAL_FILTER_COUNT_ID,
  HIDDEN_STYLE_ID,
  ROW_HIDDEN_CLASS,
  STYLE_ID,
  createEmptyColumnFilters
} from './constants'
import { getUsersMenu, getUsersRoot } from './context'
import type { ColumnFilters, ExportUiState, IndexedUserRow, UsersFilterUi, UsersFilterUiDeps } from './types'
import { normalizeText, titleCase } from './utils'
import { setExportButtonLabel as applyExportButtonLabel, setExportProgress as applyExportProgress } from '../../../../shared/utils/export'
import { ensureStyleTag } from '../../../../dom/styles'

function getColumnInputId(key: string): string {
  return `${COLUMN_FILTER_INPUT_PREFIX}${key}`
}

/**
 * Inject scoped UI styles once for the users filter controls.
 */
function ensureStyles(): void {
  ensureStyleTag(
    STYLE_ID,
    [
      `#${FILTER_PANEL_ID}{margin:0 0 6px;padding:8px 10px;border:1px solid #d8e1eb;border-radius:10px;background:rgba(204, 204, 204, 0.2);font-family:"ArtifaktElement","Segoe UI",Arial,sans-serif;}`,
      `#${FILTER_PANEL_HEADER_ID}{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 6px;}`,
      `#${FILTER_PANEL_TITLE_GROUP_ID}{display:flex;align-items:center;gap:8px;min-width:0;}`,
      `#${FILTER_PANEL_ID} .plm-extension-users-panel-title{font:700 12px/1.1 "ArtifaktElement","Segoe UI",Arial,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#44566c;}`,
      `#${GLOBAL_FILTER_CONTAINER_ID}{display:flex;align-items:center;gap:8px;margin:0;}`,
      `#${GLOBAL_FILTER_COUNT_ID}{display:inline-flex;align-items:center;justify-content:center;min-width:90px;height:34px;padding:0 10px;border:1px solid #c7d2e0;border-radius:999px;background:#f8fbff;font:700 11px/1 "ArtifaktElement","Segoe UI",Arial,sans-serif;color:#274c77;white-space:nowrap;}`,
      `#${EXPORT_BUTTON_ID},#${FILTER_APPLY_BUTTON_ID},#${FILTER_CLEAR_BUTTON_ID}{display:inline-flex;align-items:center;justify-content:center;position:relative;box-sizing:border-box;-webkit-tap-highlight-color:transparent;outline:0;margin:0;user-select:none;vertical-align:middle;appearance:none;text-decoration:none;letter-spacing:normal;box-shadow:none;font-family:"ArtifaktElement","Segoe UI",Arial,sans-serif;font-size:14px;font-weight:600;height:36px;line-height:20px;min-width:52px;padding:8px 16px;text-transform:initial;transition:box-shadow 300ms cubic-bezier(0.4,0,0.2,1),background-color 120ms ease,border-color 120ms ease,color 120ms ease;white-space:nowrap;overflow:hidden;}`,
      `#${EXPORT_BUTTON_ID}:disabled,#${FILTER_APPLY_BUTTON_ID}:disabled,#${FILTER_CLEAR_BUTTON_ID}:disabled{opacity:.55;cursor:default;box-shadow:none;}`,
      `#${EXPORT_BUTTON_ID} .plm-extension-export-icon{display:inline-flex;align-items:center;justify-content:center;line-height:1;}`,
      `#${EXPORT_BUTTON_ID} .plm-extension-export-icon svg{width:14px;height:14px;display:block;fill:currentColor;}`,
      `#${EXPORT_BUTTON_ID} .plm-extension-export-text{line-height:1;}`,
      `#${EXPORT_PROGRESS_ID}{display:none;align-items:center;gap:10px;margin:0 0 6px;}`,
      `#${EXPORT_PROGRESS_TEXT_ID}{min-width:130px;font:600 11px/1 Segoe UI,Arial,sans-serif;color:#3f5872;white-space:nowrap;}`,
      `#${EXPORT_PROGRESS_TRACK_ID}{position:relative;flex:1;height:6px;border-radius:999px;background:#dce8f5;overflow:hidden;}`,
      `#${EXPORT_PROGRESS_FILL_ID}{position:absolute;left:0;top:0;height:100%;width:0;background:linear-gradient(90deg,#1f9cdc 0%,#2563eb 100%);transition:width 120ms ease;}`,
      `#${COLUMN_FILTERS_ID}{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin:0;padding:8px 10px;border:0;border-radius:9px;background:transparent;}`,
      `#${COLUMN_FILTERS_ID} .plm-extension-users-col-filter{display:flex;flex-direction:column;gap:2px;min-width:0;}`,
      `#${COLUMN_FILTERS_ID} .plm-extension-users-col-label{font:700 11px/1 "ArtifaktElement","Segoe UI",Arial,sans-serif;letter-spacing:.03em;text-transform:uppercase;color:#526176;}`,
      `#${COLUMN_FILTERS_ID} input,#${COLUMN_FILTERS_ID} select{width:100%;height:32px;padding:0 10px;border:1px solid #cfd8e3;border-radius:8px;background:#ffffff;color:#111827;font:500 12px/1 "ArtifaktElement","Segoe UI",Arial,sans-serif;outline:none;box-sizing:border-box;transition:border-color 120ms ease,box-shadow 120ms ease;}`,
      `#${COLUMN_FILTERS_ID} input:focus,#${COLUMN_FILTERS_ID} select:focus{border-color:#7cb9dd;box-shadow:0 0 0 2px rgba(31,156,220,0.12);}`,
      `#${FILTER_ACTIONS_ID}{display:flex;justify-content:flex-end;align-items:center;gap:10px;margin-top:8px;}`
    ].join('')
  )

  ensureStyleTag(HIDDEN_STYLE_ID, `.${ROW_HIDDEN_CLASS}{display:none !important;}`)
}

function ensureFilterPanel(): HTMLDivElement | null {
  const root = getUsersRoot()
  const menu = getUsersMenu()
  if (!root || !menu) return null

  let panel = document.getElementById(FILTER_PANEL_ID) as HTMLDivElement | null
  if (!panel) {
    panel = document.createElement('div')
    panel.id = FILTER_PANEL_ID

    const header = document.createElement('div')
    header.id = FILTER_PANEL_HEADER_ID

    const title = document.createElement('span')
    title.className = 'plm-extension-users-panel-title'
    title.textContent = 'Filters'

    header.appendChild(title)
    panel.appendChild(header)
    root.insertBefore(panel, menu)
    return panel
  }

  if (!root.contains(panel) || panel.nextSibling !== menu) {
    root.insertBefore(panel, menu)
  }

  if (!panel.querySelector(`#${FILTER_PANEL_HEADER_ID}`)) {
    const header = document.createElement('div')
    header.id = FILTER_PANEL_HEADER_ID
    const title = document.createElement('span')
    title.className = 'plm-extension-users-panel-title'
    title.textContent = 'Filters'
    header.appendChild(title)
    panel.insertBefore(header, panel.firstChild)
  }

  return panel
}

function setExportButtonLabel(isExporting: boolean): void {
  const button = document.getElementById(EXPORT_BUTTON_ID)
  applyExportButtonLabel({
    button,
    textSelector: '.plm-extension-export-text',
    isExporting,
    idleLabel: 'Export',
    activeLabel: 'Exporting...'
  })
}

function setExportProgress(state: ExportUiState): void {
  const wrap = document.getElementById(EXPORT_PROGRESS_ID)
  const text = document.getElementById(EXPORT_PROGRESS_TEXT_ID)
  const fill = document.getElementById(EXPORT_PROGRESS_FILL_ID)
  applyExportProgress({
    container: wrap,
    text,
    fill,
    state
  })
}

export function createUsersFilterUi(deps: UsersFilterUiDeps): UsersFilterUi {
  /**
   * Reset all draft controls to the empty filter state.
   */
  function clearAllFilters(): void {
    for (const definition of COLUMN_DEFS) {
      const input = document.getElementById(getColumnInputId(definition.key)) as
        | HTMLInputElement
        | HTMLSelectElement
        | null
      if (!input) continue
      input.value = ''
    }
  }

  function syncActionButtons(): void {
    const applyButton = document.getElementById(FILTER_APPLY_BUTTON_ID) as HTMLButtonElement | null
    if (applyButton) applyButton.disabled = !deps.isDraftDirty()

    const clearButton = document.getElementById(FILTER_CLEAR_BUTTON_ID) as HTMLButtonElement | null
    if (clearButton) clearButton.disabled = !deps.hasAppliedFilters()
  }

  function notifyDraftChanged(): void {
    deps.onDraftChanged()
    syncActionButtons()
  }

  function ensureHeaderTitleControls(header: HTMLDivElement): void {
    let titleGroup = document.getElementById(FILTER_PANEL_TITLE_GROUP_ID) as HTMLDivElement | null
    if (!titleGroup) {
      titleGroup = document.createElement('div')
      titleGroup.id = FILTER_PANEL_TITLE_GROUP_ID
    }

    let title = titleGroup.querySelector('.plm-extension-users-panel-title') as HTMLSpanElement | null
    if (!title) {
      title = document.querySelector(`#${FILTER_PANEL_ID} .plm-extension-users-panel-title`) as HTMLSpanElement | null
    }
    if (!title) {
      title = document.createElement('span')
      title.className = 'plm-extension-users-panel-title'
      title.textContent = 'Filters'
    }
    if (title.parentElement !== titleGroup) {
      titleGroup.appendChild(title)
    }

    if (!header.contains(titleGroup)) {
      header.insertBefore(titleGroup, header.firstChild)
    }
  }

  function ensureGlobalFilterBar(panel: HTMLDivElement): void {
    const header = panel.querySelector(`#${FILTER_PANEL_HEADER_ID}`) as HTMLDivElement | null
    if (!header) return
    ensureHeaderTitleControls(header)

    let container = document.getElementById(GLOBAL_FILTER_CONTAINER_ID) as HTMLDivElement | null
    if (!container) {
      container = document.createElement('div')
      container.id = GLOBAL_FILTER_CONTAINER_ID

      const count = document.createElement('span')
      count.id = GLOBAL_FILTER_COUNT_ID
      count.textContent = 'All users'

      const exportButton = document.createElement('button')
      exportButton.id = EXPORT_BUTTON_ID
      exportButton.type = 'button'
      exportButton.className = 'plm-extension-btn plm-extension-btn--secondary'
      exportButton.addEventListener('click', deps.onExportClick)

      const exportIcon = document.createElement('span')
      exportIcon.className = 'plm-extension-export-icon'
      exportIcon.setAttribute('aria-hidden', 'true')
      exportIcon.innerHTML =
        '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true"><path d="M5 20h14v-2H5v2zm7-18v10.17l3.59-3.58L17 10l-5 5-5-5 1.41-1.41L11 12.17V2h1z"></path></svg>'

      const exportText = document.createElement('span')
      exportText.className = 'plm-extension-export-text'
      exportText.textContent = 'Export'

      exportButton.appendChild(exportIcon)
      exportButton.appendChild(exportText)

      container.appendChild(count)
      container.appendChild(exportButton)
      header.appendChild(container)
      exportButton.classList.add('plm-extension-btn', 'plm-extension-btn--secondary')
      syncActionButtons()
      return
    }

    if (!header.contains(container)) {
      header.appendChild(container)
    }
    const existingExportButton = document.getElementById(EXPORT_BUTTON_ID) as HTMLButtonElement | null
    if (existingExportButton) existingExportButton.classList.add('plm-extension-btn', 'plm-extension-btn--secondary')
    syncActionButtons()
  }

  function ensureExportProgress(panel: HTMLDivElement): void {
    const header = panel.querySelector(`#${FILTER_PANEL_HEADER_ID}`)
    if (!header) return

    let progress = document.getElementById(EXPORT_PROGRESS_ID) as HTMLDivElement | null
    if (!progress) {
      progress = document.createElement('div')
      progress.id = EXPORT_PROGRESS_ID

      const text = document.createElement('span')
      text.id = EXPORT_PROGRESS_TEXT_ID

      const track = document.createElement('div')
      track.id = EXPORT_PROGRESS_TRACK_ID
      const fill = document.createElement('div')
      fill.id = EXPORT_PROGRESS_FILL_ID
      track.appendChild(fill)

      progress.appendChild(text)
      progress.appendChild(track)
      panel.insertBefore(progress, header.nextSibling)
      return
    }

    if (!panel.contains(progress) || progress.previousSibling !== header) {
      panel.insertBefore(progress, header.nextSibling)
    }
  }

  function ensureColumnFilters(panel: HTMLDivElement): void {
    let container = document.getElementById(COLUMN_FILTERS_ID) as HTMLDivElement | null
    if (!container) {
      container = document.createElement('div')
      container.id = COLUMN_FILTERS_ID

      for (const definition of COLUMN_DEFS) {
        const group = document.createElement('label')
        group.className = 'plm-extension-users-col-filter'
        group.setAttribute('for', getColumnInputId(definition.key))

        const label = document.createElement('span')
        label.className = 'plm-extension-users-col-label'
        label.textContent = definition.label

        const control: HTMLInputElement | HTMLSelectElement =
          definition.mode === 'select' ? document.createElement('select') : document.createElement('input')

        control.id = getColumnInputId(definition.key)
        control.addEventListener('input', notifyDraftChanged)
        control.addEventListener('change', notifyDraftChanged)

        if (definition.mode === 'select') {
          const all = document.createElement('option')
          all.value = ''
          all.textContent = 'All'
          ;(control as HTMLSelectElement).appendChild(all)
        } else {
          const input = control as HTMLInputElement
          input.type = 'search'
          input.placeholder = 'Contains...'
          input.autocomplete = 'off'
          input.spellcheck = false
          input.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return
            if (!input.value) return
            input.value = ''
            notifyDraftChanged()
          })
        }

        group.appendChild(label)
        group.appendChild(control)
        container.appendChild(group)
      }

      panel.appendChild(container)
      syncActionButtons()
      return
    }

    if (!panel.contains(container)) {
      panel.appendChild(container)
    }

    syncActionButtons()
  }

  function ensureActions(panel: HTMLDivElement): void {
    let actions = document.getElementById(FILTER_ACTIONS_ID) as HTMLDivElement | null
    if (!actions) {
      actions = document.createElement('div')
      actions.id = FILTER_ACTIONS_ID

      const applyButton = document.createElement('button')
      applyButton.id = FILTER_APPLY_BUTTON_ID
      applyButton.type = 'button'
      applyButton.className = 'plm-extension-btn plm-extension-btn--primary'
      applyButton.textContent = 'Apply Filter'
      applyButton.addEventListener('click', () => {
        deps.onApplyFilters()
        syncActionButtons()
      })

      const clearButton = document.createElement('button')
      clearButton.id = FILTER_CLEAR_BUTTON_ID
      clearButton.type = 'button'
      clearButton.className = 'plm-extension-btn plm-extension-btn--secondary'
      clearButton.textContent = 'Clear Filters'
      clearButton.addEventListener('click', () => {
        clearAllFilters()
        deps.onClearFilters()
        syncActionButtons()
      })

      actions.appendChild(applyButton)
      actions.appendChild(clearButton)
      applyButton.classList.add('plm-extension-btn', 'plm-extension-btn--primary')
      clearButton.classList.add('plm-extension-btn', 'plm-extension-btn--secondary')
      panel.appendChild(actions)
      return
    }

    if (!panel.contains(actions)) {
      panel.appendChild(actions)
    }

    const applyButton = document.getElementById(FILTER_APPLY_BUTTON_ID) as HTMLButtonElement | null
    const clearButton = document.getElementById(FILTER_CLEAR_BUTTON_ID) as HTMLButtonElement | null
    if (applyButton) applyButton.classList.add('plm-extension-btn', 'plm-extension-btn--primary')
    if (clearButton) clearButton.classList.add('plm-extension-btn', 'plm-extension-btn--secondary')

    syncActionButtons()
  }

  function ensureAttached(): void {
    ensureStyles()
    const panel = ensureFilterPanel()
    if (!panel) return

    ensureGlobalFilterBar(panel)
    ensureExportProgress(panel)
    ensureColumnFilters(panel)
    ensureActions(panel)
  }

  function remove(): void {
    const panel = document.getElementById(FILTER_PANEL_ID)
    if (panel) panel.remove()
  }

  function readColumnFilters(): ColumnFilters {
    const filters = createEmptyColumnFilters()

    for (const definition of COLUMN_DEFS) {
      const input = document.getElementById(getColumnInputId(definition.key)) as
        | HTMLInputElement
        | HTMLSelectElement
        | null
      if (!input) continue
      filters[definition.key] = normalizeText(input.value || '')
    }

    return filters
  }

  function hasColumnFilter(filters: ColumnFilters): boolean {
    return COLUMN_DEFS.some((definition) => Boolean(filters[definition.key]))
  }

  function setResultCount(visibleCount: number, totalCount: number, hasFilter: boolean): void {
    const count = document.getElementById(GLOBAL_FILTER_COUNT_ID)
    if (!count) return

    count.textContent = hasFilter ? `${visibleCount} of ${totalCount}` : `All (${totalCount})`
    syncActionButtons()
  }

  function refreshSelectOptions(rows: IndexedUserRow[]): void {
    for (const definition of COLUMN_DEFS) {
      if (definition.mode !== 'select') continue

      const select = document.getElementById(getColumnInputId(definition.key)) as HTMLSelectElement | null
      if (!select) continue

      const previousValue = normalizeText(select.value || '')
      const uniqueValues: Record<string, true> = Object.create(null)

      for (const row of rows) {
        const value = row.columns[definition.key]
        if (value) uniqueValues[value] = true
      }

      const sortedValues = Object.keys(uniqueValues).sort()
      select.textContent = ''

      const all = document.createElement('option')
      all.value = ''
      all.textContent = 'All'
      select.appendChild(all)

      for (const value of sortedValues) {
        const option = document.createElement('option')
        option.value = value
        option.textContent = titleCase(value)
        select.appendChild(option)
      }

      select.value = previousValue && uniqueValues[previousValue] ? previousValue : ''
    }

    syncActionButtons()
  }

  function updateExportUi(state: ExportUiState, visibleCount?: number): void {
    const button = document.getElementById(EXPORT_BUTTON_ID) as HTMLButtonElement | null
    if (!button) return

    const count = typeof visibleCount === 'number' ? visibleCount : deps.getVisibleRowCount()

    button.disabled = state.isExporting || count <= 0
    button.title = state.isExporting
      ? 'Preparing CSV export...'
      : count > 0
        ? 'Export visible users to CSV'
        : 'No visible rows to export'

    setExportButtonLabel(state.isExporting)
    setExportProgress(state)
    syncActionButtons()
  }

  return {
    ensureAttached,
    remove,
    readColumnFilters,
    hasColumnFilter,
    setResultCount,
    refreshSelectOptions,
    updateExportUi,
    syncActionButtons
  }
}

