import {
  GRID_ACTIONS_ID,
  GRID_ADD_RULE_ID,
  GRID_APPLY_BUTTON_ID,
  GRID_CLEAR_BUTTON_ID,
  GRID_COUNT_ID,
  GRID_EXPORT_BUTTON_ID,
  GRID_EXPORT_EXCEL_ICON_SRC,
  GRID_EXPORT_PROGRESS_FILL_ID,
  GRID_EXPORT_PROGRESS_ID,
  GRID_EXPORT_PROGRESS_TEXT_ID,
  GRID_EXPORT_PROGRESS_TRACK_ID,
  GRID_FILTER_TOGGLE_BUTTON_ID,
  GRID_IMPORT_BUTTON_ID,
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
import { setExportButtonLabel, setExportProgress } from '../grid-export/export.service'
import { GRID_FORM_BUTTON_ID } from '../constants'
import { ensureStyleTag } from '../../../shared/dom/styles'
import { getGridFieldHydrationIssue } from '../grid-services/gridDiagnostics'

function ensureStyles(): void {
  ensureStyleTag(GRID_STYLE_ID, getGridPanelStyleText())
  ensureStyleTag(GRID_HIDDEN_STYLE_ID, getGridHiddenRowsStyleText())
}

function createHostExcelToolbarIcon(className: string, src: string): HTMLImageElement {
  const icon = document.createElement('img')
  icon.className = className
  icon.src = src
  icon.alt = ''
  icon.setAttribute('aria-hidden', 'true')
  return icon
}

function createImportToolbarIcon(): HTMLElement {
  const icon = document.createElement('span')
  icon.className = 'plm-extension-grid-import-icon zmdi zmdi-cloud-upload'
  icon.setAttribute('aria-hidden', 'true')
  return icon
}

function ensureImportToolbarIcon(button: HTMLButtonElement): void {
  if (button.querySelector('.plm-extension-grid-import-icon')) return

  const label = button.querySelector('.plm-extension-grid-import-text, .label')
  button.querySelector('img.import-excel-btn')?.remove()

  const icon = createImportToolbarIcon()
  if (label) {
    button.insertBefore(icon, label)
  } else {
    button.prepend(icon)
  }
}

export function createGridPanelUi(deps: GridPanelUiDeps): GridPanelUi {
  function updateActionButtons(): void {
    const toolbar = deps.getToolbarFlags()
    const addRuleButton = document.getElementById(GRID_ADD_RULE_ID) as HTMLButtonElement | null
    const applyButton = document.getElementById(GRID_APPLY_BUTTON_ID) as HTMLButtonElement | null
    const clearButton = document.getElementById(GRID_CLEAR_BUTTON_ID) as HTMLButtonElement | null
    const exportButton = document.getElementById(GRID_EXPORT_BUTTON_ID) as HTMLButtonElement | null
    const importButton = document.getElementById(GRID_IMPORT_BUTTON_ID) as HTMLButtonElement | null

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

    if (toolbar.enableCsvExport && exportButton) {
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

    if (toolbar.enableGridImport && importButton) {
      importButton.disabled = !activeTable || activeColumns.length === 0
      if (!activeTable) {
        importButton.title = 'Waiting for the grid table to finish loading'
      } else if (activeColumns.length > 0) {
        importButton.title = 'Import CSV rows into this grid'
      } else {
        const issue = getGridFieldHydrationIssue()
        importButton.title = issue ?? 'Grid metadata is still loading'
      }
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
    const toolbar = deps.getToolbarFlags()
    if (!toolbar.enableFiltering) {
      if (toolbar.enableCsvExport) {
        updateActionButtons()
      }
      return
    }

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

  function ensureToolbarButtons(): void {
    // Inject before creating/moving buttons so loading-state toolbar does not flash base.css-only sizing.
    ensureStyles()
    const toolbar = deps.getToolbarFlags()
    const showFilter = toolbar.enableFiltering
    const showExport = toolbar.enableCsvExport
    const showImport = toolbar.enableGridImport
    const showAdvancedEditor = toolbar.enableAdvancedEditor

    if (!showFilter) {
      document.getElementById(GRID_FILTER_TOGGLE_BUTTON_ID)?.remove()
    }
    if (!showExport) {
      document.getElementById(GRID_EXPORT_BUTTON_ID)?.remove()
    }
    if (!showImport) {
      document.getElementById(GRID_IMPORT_BUTTON_ID)?.remove()
    }
    if (!showAdvancedEditor) {
      document.getElementById(GRID_FORM_BUTTON_ID)?.remove()
    }

    const host = getCommandButtonHost()
    if (!host) return

    const advancedEditorButton = showAdvancedEditor
      ? (document.getElementById(GRID_FORM_BUTTON_ID) as HTMLButtonElement | null)
      : null

    let filterButton: HTMLButtonElement | null = null
    if (showFilter) {
      filterButton = document.getElementById(GRID_FILTER_TOGGLE_BUTTON_ID) as HTMLButtonElement | null
      if (!filterButton) {
        filterButton = document.createElement('button')
        filterButton.id = GRID_FILTER_TOGGLE_BUTTON_ID
        filterButton.type = 'button'
        filterButton.className = 'plm-extension-btn plm-extension-btn--secondary'
        filterButton.setAttribute('aria-label', 'Filter')

        const icon = document.createElement('span')
        icon.className = 'icon-Filter'
        icon.setAttribute('aria-hidden', 'true')
        filterButton.appendChild(icon)

        const label = document.createElement('span')
        label.className = 'label plm-extension-grid-filter-text'
        label.textContent = 'Filter'
        filterButton.appendChild(label)

        filterButton.addEventListener('click', () => {
          deps.setPanelVisible(!deps.getPanelVisible())
          applyPanelVisibility()
          updateFilterToggleButtonState()
        })
      }
    }

    let exportButton: HTMLButtonElement | null = null
    if (showExport) {
      exportButton = document.getElementById(GRID_EXPORT_BUTTON_ID) as HTMLButtonElement | null
      if (!exportButton) {
        exportButton = document.createElement('button')
        exportButton.id = GRID_EXPORT_BUTTON_ID
        exportButton.type = 'button'
        exportButton.className = 'plm-extension-btn plm-extension-btn--secondary'
        exportButton.setAttribute('aria-label', 'Export')

        const exportIcon = createHostExcelToolbarIcon('export-excel-btn', GRID_EXPORT_EXCEL_ICON_SRC)

        const exportText = document.createElement('span')
        exportText.className = 'label plm-extension-grid-export-text'
        exportText.textContent = 'Export'

        exportButton.appendChild(exportIcon)
        exportButton.appendChild(exportText)
        exportButton.addEventListener('click', () => {
          deps.onExportCsv()
        })
      }
    }

    let importButton: HTMLButtonElement | null = null
    if (showImport) {
      importButton = document.getElementById(GRID_IMPORT_BUTTON_ID) as HTMLButtonElement | null
      if (!importButton) {
        importButton = document.createElement('button')
        importButton.id = GRID_IMPORT_BUTTON_ID
        importButton.type = 'button'
        importButton.className = 'plm-extension-btn plm-extension-btn--secondary'
        importButton.setAttribute('aria-label', 'Import')

        const importIcon = createImportToolbarIcon()

        const importText = document.createElement('span')
        importText.className = 'label plm-extension-grid-import-text'
        importText.textContent = 'Import'

        importButton.appendChild(importIcon)
        importButton.appendChild(importText)
        importButton.addEventListener('click', () => {
          deps.onImportCsv()
        })
      }
    }

    if (filterButton) {
      filterButton.classList.add('plm-extension-btn', 'plm-extension-btn--secondary')
    }
    if (exportButton) {
      exportButton.classList.add('plm-extension-btn', 'plm-extension-btn--secondary')
    }
    if (importButton) {
      importButton.classList.add('plm-extension-btn', 'plm-extension-btn--secondary')
      ensureImportToolbarIcon(importButton)
    }

    const advancedInHost = Boolean(advancedEditorButton && advancedEditorButton.parentElement === host)
    const filterInHost = Boolean(filterButton && filterButton.parentElement === host)
    const exportInHost = Boolean(exportButton && exportButton.parentElement === host)
    const importInHost = Boolean(importButton && importButton.parentElement === host)

    const ordered: HTMLElement[] = []
    if (advancedEditorButton) ordered.push(advancedEditorButton)
    if (filterButton) ordered.push(filterButton)
    if (exportButton) ordered.push(exportButton)
    if (importButton) ordered.push(importButton)

    let orderOk = true
    if (ordered.length > 0) {
      for (let i = 0; i < ordered.length; i += 1) {
        if (ordered[i].parentElement !== host) {
          orderOk = false
          break
        }
      }
      if (orderOk) {
        for (let i = 0; i < ordered.length - 1; i += 1) {
          if (ordered[i].nextElementSibling !== ordered[i + 1]) {
            orderOk = false
            break
          }
        }
      }
    }

    if (!orderOk || (filterButton && !filterInHost) || (exportButton && !exportInHost) || (importButton && !importInHost)) {
      if (advancedEditorButton && advancedInHost) advancedEditorButton.remove()
      if (filterButton && filterInHost) filterButton.remove()
      if (exportButton && exportInHost) exportButton.remove()
      if (importButton && importInHost) importButton.remove()
      if (advancedEditorButton) host.appendChild(advancedEditorButton)
      if (filterButton) host.appendChild(filterButton)
      if (exportButton) host.appendChild(exportButton)
      if (importButton) host.appendChild(importButton)
    }

    updateFilterToggleButtonState()
    updateActionButtons()
  }

  function removeFilterExportButtons(): void {
    const button = document.getElementById(GRID_FILTER_TOGGLE_BUTTON_ID)
    if (button) button.remove()
    const exportButton = document.getElementById(GRID_EXPORT_BUTTON_ID)
    if (exportButton) exportButton.remove()
    const importButton = document.getElementById(GRID_IMPORT_BUTTON_ID)
    if (importButton) importButton.remove()
    const rightHost = document.getElementById(GRID_COMMAND_RIGHT_HOST_ID)
    if (rightHost && rightHost.childElementCount === 0) rightHost.remove()
  }

  function ensurePanel(table: HTMLTableElement): HTMLDivElement | null {
    ensureStyles()
    const host = getPanelHost(table)
    if (!host) return null

    const toolbar = deps.getToolbarFlags()

    if (!toolbar.enableFiltering && (toolbar.enableCsvExport || toolbar.enableGridImport)) {
      let exportOnlyPanel = document.getElementById(GRID_PANEL_ID) as HTMLDivElement | null
      if (!exportOnlyPanel) {
        exportOnlyPanel = document.createElement('div')
        exportOnlyPanel.id = GRID_PANEL_ID
        exportOnlyPanel.style.display = 'none'
        exportOnlyPanel.setAttribute('aria-hidden', 'true')
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
        exportOnlyPanel.appendChild(exportProgress)
      }
      const spreadsheet = table.closest('spreadsheet')
      if (!host.contains(exportOnlyPanel)) {
        if (spreadsheet && spreadsheet.parentElement === host) {
          host.insertBefore(exportOnlyPanel, spreadsheet)
        } else {
          host.insertBefore(exportOnlyPanel, host.firstChild)
        }
      }
      updateActionButtons()
      return exportOnlyPanel
    }

    if (!toolbar.enableFiltering) {
      return null
    }

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

      if (toolbar.enableCsvExport) {
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
      }

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
    ensureToolbarButtons,
    removeFilterExportButtons,
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
