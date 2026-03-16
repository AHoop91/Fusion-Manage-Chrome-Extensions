import {
  GRID_ACTIONS_ID,
  GRID_ADD_RULE_ID,
  GRID_APPLY_BUTTON_ID,
  GRID_CLEAR_BUTTON_ID,
  GRID_COUNT_ID,
  GRID_EXPORT_BUTTON_ID,
  GRID_EXPORT_PROGRESS_FILL_ID,
  GRID_EXPORT_PROGRESS_ID,
  GRID_EXPORT_PROGRESS_TEXT_ID,
  GRID_EXPORT_PROGRESS_TRACK_ID,
  GRID_FILTER_TOGGLE_BUTTON_ID,
  GRID_PANEL_HEADER_ID,
  GRID_PANEL_ID,
  GRID_PANEL_TITLE_ID,
  GRID_STYLE_ID,
  GRID_HIDDEN_STYLE_ID,
  GRID_RULES_ID
} from './constants'
import { GRID_COMMAND_RIGHT_HOST_ID, GRID_SUMMARY_COUNT_ID } from './model'
import { cloneGroups, getActiveGroups, removeConditionFromGroups } from './groupUtils'
import { getGridHiddenRowsStyleText, getGridPanelStyleText } from './styles'
import { getCommandButtonHost, getPanelHost, getSummaryHost } from './panelLayout'
import { createRuleBuilder } from './ruleBuilder'
import { ensureSummaryBar, removeSummaryBar, updateSummaryBar } from './summary'
import type { GridPanelUi, GridPanelUiDeps } from './panelTypes'
import { setExportButtonLabel, setExportProgress } from '../export/export.service'
import { GRID_FORM_BUTTON_ID } from '../constants'
import { ensureStyleTag } from '../../../dom/styles'

function ensureStyles(): void {
  ensureStyleTag(GRID_STYLE_ID, getGridPanelStyleText())
  ensureStyleTag(GRID_HIDDEN_STYLE_ID, getGridHiddenRowsStyleText())
}

export function createGridPanelUi(deps: GridPanelUiDeps): GridPanelUi {
  function updateActionButtons(): void {
    const addRuleButton = document.getElementById(GRID_ADD_RULE_ID) as HTMLButtonElement | null
    const applyButton = document.getElementById(GRID_APPLY_BUTTON_ID) as HTMLButtonElement | null
    const clearButton = document.getElementById(GRID_CLEAR_BUTTON_ID) as HTMLButtonElement | null
    const exportButton = document.getElementById(GRID_EXPORT_BUTTON_ID) as HTMLButtonElement | null

    const activeTable = deps.getActiveTable()
    const activeColumns = deps.getActiveColumns()

    if (addRuleButton) {
      const selected = deps.getSelectedColumnKeys()
      const hasAvailableField = activeColumns.some((column) => !selected.has(column.key))
      addRuleButton.disabled = !activeTable || activeColumns.length === 0 || !hasAvailableField
    }

    if (applyButton) {
      applyButton.disabled = !activeTable || !deps.isDraftDirty()
    }

    if (clearButton) {
      const appliedActiveCount = deps.getAppliedActiveGroups().length
      clearButton.style.display = ''
      clearButton.disabled = !activeTable || appliedActiveCount === 0
    }

    if (exportButton) {
      const visibleCount = deps.getVisibleRowCount()
      const exportState = deps.getExportUiState()
      const isExporting = exportState.isExporting
      exportButton.disabled = !activeTable || visibleCount === 0 || isExporting
      exportButton.title = isExporting
        ? 'Exporting visible rows...'
        : visibleCount > 0
          ? `Export ${visibleCount} visible row${visibleCount === 1 ? '' : 's'} to CSV`
          : 'No visible rows to export'

      setExportButtonLabel({
        button: exportButton,
        textSelector: '.plm-extension-grid-export-text',
        isExporting,
        idleLabel: 'Export',
        activeLabel: 'Exporting...'
      })

      setExportProgress({
        container: document.getElementById(GRID_EXPORT_PROGRESS_ID),
        text: document.getElementById(GRID_EXPORT_PROGRESS_TEXT_ID),
        fill: document.getElementById(GRID_EXPORT_PROGRESS_FILL_ID),
        state: exportState
      })
    }
  }

  const { renderRuleBuilder } = createRuleBuilder({
    getActiveColumns: deps.getActiveColumns,
    getDraftGroups: deps.getDraftGroups,
    setDraftGroups: deps.setDraftGroups,
    hasApiMetadataForCurrentGrid: deps.hasApiMetadataForCurrentGrid,
    getSelectedColumnKeys: deps.getSelectedColumnKeys,
    findColumnByKey: deps.findColumnByKey,
    ensureConditionOperator: deps.ensureConditionOperator,
    getColumnOperators: deps.getColumnOperators,
    createCondition: deps.createCondition,
    updateActionButtons
  })

  function removeAppliedCondition(groupId: string, conditionId: string): void {
    deps.setAppliedGroups(removeConditionFromGroups(deps.getAppliedGroups(), groupId, conditionId))
    deps.setDraftGroups(removeConditionFromGroups(deps.getDraftGroups(), groupId, conditionId))
    deps.runFilter()
    renderRuleBuilder()
    updateActionButtons()
    updateFilterToggleButtonState()
  }

  function applyPanelVisibility(): void {
    const panel = document.getElementById(GRID_PANEL_ID) as HTMLDivElement | null
    if (!panel) return
    panel.style.display = deps.getPanelVisible() ? '' : 'none'
  }

  function updateFilterToggleButtonState(): void {
    const button = document.getElementById(GRID_FILTER_TOGGLE_BUTTON_ID) as HTMLButtonElement | null

    const activeGroups = deps.getAppliedActiveGroups()
    const activeConditionCount = activeGroups.reduce((sum, group) => sum + group.conditions.length, 0)
    if (button) {
      const hasRows = deps.getTotalRowCount() > 0
      button.disabled = !deps.getActiveTable() || !hasRows
      button.title = !hasRows
        ? 'No rows available to filter'
        : activeConditionCount > 0
          ? `Filter Mode (${activeConditionCount})`
          : 'Filter Mode'
      button.setAttribute('aria-pressed', deps.getPanelVisible() ? 'true' : 'false')
    }

    updateSummaryBar({
      panelVisible: deps.getPanelVisible(),
      activeGroups,
      activeColumns: deps.getActiveColumns(),
      onRemove: removeAppliedCondition
    })
  }

  function ensureFilterToggleButton(): void {
    const host = getCommandButtonHost()
    if (!host) return

    const advancedEditorButton = document.getElementById(GRID_FORM_BUTTON_ID) as HTMLButtonElement | null

    let exportButton = document.getElementById(GRID_EXPORT_BUTTON_ID) as HTMLButtonElement | null
    if (!exportButton) {
      exportButton = document.createElement('button')
      exportButton.id = GRID_EXPORT_BUTTON_ID
      exportButton.type = 'button'
      exportButton.className = 'plm-extension-btn plm-extension-btn--secondary'
      exportButton.setAttribute('aria-label', 'Export')

      const exportIcon = document.createElement('img')
      exportIcon.className = 'export-excel-btn'
      exportIcon.src = 'images/export_excel_btn.svg'
      exportIcon.alt = ''
      exportIcon.setAttribute('aria-hidden', 'true')

      const exportText = document.createElement('span')
      exportText.className = 'label plm-extension-grid-export-text'
      exportText.textContent = 'Export'

      exportButton.appendChild(exportIcon)
      exportButton.appendChild(exportText)
      exportButton.addEventListener('click', () => {
        deps.onExportCsv()
      })
    }

    let button = document.getElementById(GRID_FILTER_TOGGLE_BUTTON_ID) as HTMLButtonElement | null
    if (!button) {
      button = document.createElement('button')
      button.id = GRID_FILTER_TOGGLE_BUTTON_ID
      button.type = 'button'
      button.className = 'plm-extension-btn plm-extension-btn--secondary'
      button.setAttribute('aria-label', 'Filter')

      const icon = document.createElement('span')
      icon.className = 'icon-Filter'
      icon.setAttribute('aria-hidden', 'true')
      button.appendChild(icon)

      const label = document.createElement('span')
      label.className = 'label plm-extension-grid-filter-text'
      label.textContent = 'Filter'
      button.appendChild(label)

      button.addEventListener('click', () => {
        deps.setPanelVisible(!deps.getPanelVisible())
        applyPanelVisibility()
        updateFilterToggleButtonState()
      })
    }

    exportButton.classList.add('plm-extension-btn', 'plm-extension-btn--secondary')
    button.classList.add('plm-extension-btn', 'plm-extension-btn--secondary')

    const advancedInHost = Boolean(advancedEditorButton && advancedEditorButton.parentElement === host)
    const buttonInHost = button.parentElement === host
    const exportInHost = exportButton.parentElement === host
    const orderIsCorrect =
      (!advancedEditorButton || advancedEditorButton.parentElement === host) &&
      (!advancedEditorButton || advancedEditorButton.nextElementSibling === button) &&
      button.nextElementSibling === exportButton
    if (!buttonInHost || !exportInHost || !orderIsCorrect) {
      if (advancedEditorButton && advancedInHost) advancedEditorButton.remove()
      if (buttonInHost) button.remove()
      if (exportInHost) exportButton.remove()
      if (advancedEditorButton) host.appendChild(advancedEditorButton)
      host.appendChild(button)
      host.appendChild(exportButton)
    }

    updateFilterToggleButtonState()
    updateActionButtons()
  }

  function removeFilterToggleButton(): void {
    const button = document.getElementById(GRID_FILTER_TOGGLE_BUTTON_ID)
    if (button) button.remove()
    const exportButton = document.getElementById(GRID_EXPORT_BUTTON_ID)
    if (exportButton) exportButton.remove()
    const rightHost = document.getElementById(GRID_COMMAND_RIGHT_HOST_ID)
    if (rightHost && rightHost.childElementCount === 0) rightHost.remove()
  }

  function ensurePanel(table: HTMLTableElement): HTMLDivElement | null {
    ensureStyles()
    const host = getPanelHost(table)
    if (!host) return null

    let panel = document.getElementById(GRID_PANEL_ID) as HTMLDivElement | null
    if (!panel) {
      panel = document.createElement('div')
      panel.id = GRID_PANEL_ID

      const header = document.createElement('div')
      header.id = GRID_PANEL_HEADER_ID

      const titleGroup = document.createElement('div')
      titleGroup.id = GRID_PANEL_TITLE_ID
      const title = document.createElement('span')
      title.className = 'plm-extension-grid-title'
      title.textContent = 'Filter Mode'
      const subtitle = document.createElement('span')
      subtitle.className = 'plm-extension-grid-subtitle'
      subtitle.textContent = 'Add rules and click Apply Filter. Rules inside each field use AND/OR for that field.'
      titleGroup.appendChild(title)
      titleGroup.appendChild(subtitle)

      const right = document.createElement('div')
      right.className = 'plm-extension-grid-header-right'

      const addRuleButton = document.createElement('button')
      addRuleButton.id = GRID_ADD_RULE_ID
      addRuleButton.type = 'button'
      addRuleButton.className = 'plm-extension-btn plm-extension-btn--secondary'
      addRuleButton.textContent = 'Add Rule'
      addRuleButton.addEventListener('click', () => {
        const activeColumns = deps.getActiveColumns()
        if (activeColumns.length === 0) return
        const selected = deps.getSelectedColumnKeys()
        const nextColumn = activeColumns.find((column) => !selected.has(column.key))
        if (!nextColumn) return
        deps.setDraftGroups([...deps.getDraftGroups(), deps.createGroup(nextColumn.key)])
        renderRuleBuilder()
        updateActionButtons()
      })

      const count = document.createElement('span')
      count.id = GRID_COUNT_ID
      count.textContent = 'All (0)'

      right.appendChild(addRuleButton)
      right.appendChild(count)
      header.appendChild(titleGroup)
      header.appendChild(right)
      panel.appendChild(header)

      const rules = document.createElement('div')
      rules.id = GRID_RULES_ID
      panel.appendChild(rules)

      const exportProgress = document.createElement('div')
      exportProgress.id = GRID_EXPORT_PROGRESS_ID
      const exportProgressText = document.createElement('span')
      exportProgressText.id = GRID_EXPORT_PROGRESS_TEXT_ID
      const exportProgressTrack = document.createElement('div')
      exportProgressTrack.id = GRID_EXPORT_PROGRESS_TRACK_ID
      const exportProgressFill = document.createElement('div')
      exportProgressFill.id = GRID_EXPORT_PROGRESS_FILL_ID
      exportProgressTrack.appendChild(exportProgressFill)
      exportProgress.appendChild(exportProgressText)
      exportProgress.appendChild(exportProgressTrack)
      panel.appendChild(exportProgress)

      const actions = document.createElement('div')
      actions.id = GRID_ACTIONS_ID

      const applyButton = document.createElement('button')
      applyButton.id = GRID_APPLY_BUTTON_ID
      applyButton.type = 'button'
      applyButton.className = 'plm-extension-btn plm-extension-btn--primary'
      applyButton.textContent = 'Apply Filter'
      applyButton.addEventListener('click', () => {
        const normalizedDraft = deps.normalizeGroupsForColumns(deps.getDraftGroups())
        const completedDraft = getActiveGroups(normalizedDraft)
        deps.setDraftGroups(cloneGroups(completedDraft))
        deps.setAppliedGroups(cloneGroups(completedDraft))
        deps.runFilter()
        renderRuleBuilder()
        updateActionButtons()
        updateFilterToggleButtonState()
      })

      const clearButton = document.createElement('button')
      clearButton.id = GRID_CLEAR_BUTTON_ID
      clearButton.type = 'button'
      clearButton.className = 'plm-extension-btn plm-extension-btn--secondary'
      clearButton.textContent = 'Clear Filters'
      clearButton.addEventListener('click', () => {
        deps.setDraftGroups([])
        deps.setAppliedGroups([])
        renderRuleBuilder()
        deps.runFilter()
        updateActionButtons()
        updateFilterToggleButtonState()
      })

      actions.appendChild(applyButton)
      actions.appendChild(clearButton)
      panel.appendChild(actions)
    }

    const spreadsheet = table.closest('spreadsheet')
    const summaryHost = getSummaryHost(table)
    if (summaryHost) ensureSummaryBar(summaryHost.host, summaryHost.anchor)
    if (!host.contains(panel)) {
      if (spreadsheet && spreadsheet.parentElement === host) {
        host.insertBefore(panel, spreadsheet)
      } else {
        host.insertBefore(panel, host.firstChild)
      }
    }

    const actions = document.getElementById(GRID_ACTIONS_ID) as HTMLDivElement | null
    const rules = document.getElementById(GRID_RULES_ID) as HTMLDivElement | null
    if (actions && actions.parentElement !== panel) panel.appendChild(actions)
    if (actions && rules && actions.previousElementSibling !== rules) panel.appendChild(actions)

    applyPanelVisibility()
    renderRuleBuilder()
    updateActionButtons()
    return panel
  }

  function updateCount(visibleCount: number, totalCount: number, hasFilter: boolean): void {
    const count = document.getElementById(GRID_COUNT_ID)
    if (!count) return
    count.textContent = hasFilter ? `${visibleCount} of ${totalCount}` : `All (${totalCount})`

    const summaryCount = document.getElementById(GRID_SUMMARY_COUNT_ID)
    if (summaryCount) summaryCount.textContent = hasFilter ? `${visibleCount} of ${totalCount}` : `All (${totalCount})`
  }

  function removePanel(): void {
    const panel = document.getElementById(GRID_PANEL_ID)
    if (panel) panel.remove()
  }

  return {
    ensureFilterToggleButton,
    removeFilterToggleButton,
    updateCount,
    updateActionButtons,
    updateFilterToggleButtonState,
    renderRuleBuilder,
    ensurePanel,
    removePanel,
    removeSummaryBar
  }
}

export type { GridPanelUi, GridPanelUiDeps } from './panelTypes'
