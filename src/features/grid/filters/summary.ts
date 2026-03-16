import { getOperatorMeta, operatorRequiresSecondaryValue, operatorRequiresValue } from './filterEngine'
import { GRID_SUMMARY_COUNT_ID, GRID_SUMMARY_ID, GRID_SUMMARY_LIST_ID } from './model'
import type { ColumnFilterGroup } from './model'
import type { GridColumnDef } from '../grid.types'

export function ensureSummaryBar(host: HTMLElement, anchor: HTMLElement | null): void {
  let summary = document.getElementById(GRID_SUMMARY_ID) as HTMLDivElement | null
  if (!summary) {
    summary = document.createElement('div')
    summary.id = GRID_SUMMARY_ID
    summary.style.display = 'none'

    const list = document.createElement('div')
    list.id = GRID_SUMMARY_LIST_ID

    const count = document.createElement('span')
    count.id = GRID_SUMMARY_COUNT_ID
    count.textContent = 'All (0)'

    summary.appendChild(list)
    summary.appendChild(count)
  }

  if (!host.contains(summary)) {
    if (anchor && anchor.parentElement === host) {
      host.insertBefore(summary, anchor)
    } else {
      host.insertBefore(summary, host.firstChild)
    }
  }
}

export function updateSummaryBar(params: {
  panelVisible: boolean
  activeGroups: ColumnFilterGroup[]
  activeColumns: GridColumnDef[]
  onRemove: (groupId: string, conditionId: string) => void
}): void {
  const summary = document.getElementById(GRID_SUMMARY_ID) as HTMLDivElement | null
  const list = document.getElementById(GRID_SUMMARY_LIST_ID) as HTMLDivElement | null
  if (!summary || !list) return

  const activeConditionCount = params.activeGroups.reduce((sum, group) => sum + group.conditions.length, 0)
  const shouldShowSummary = !params.panelVisible && activeConditionCount > 0
  summary.style.display = shouldShowSummary ? '' : 'none'
  if (!shouldShowSummary) return

  list.textContent = ''
  list.style.display = ''

  for (const group of params.activeGroups) {
    const column = params.activeColumns.find((item) => item.key === group.columnKey)
    const columnLabel = column?.title || group.columnKey
    const modeLabel = group.mode.toUpperCase()

    for (const condition of group.conditions) {
      const chip = document.createElement('span')
      chip.className = 'plm-extension-grid-chip'

      const suffix = operatorRequiresValue(condition.operator)
        ? operatorRequiresSecondaryValue(condition.operator)
          ? ` "${condition.value}" .. "${condition.valueTo}"`
          : ` "${condition.value}"`
        : ''

      const label = document.createElement('span')
      label.className = 'plm-extension-grid-chip-label'
      label.textContent = `${columnLabel} [${modeLabel}] ${getOperatorMeta(condition.operator)?.label || condition.operator}${suffix}`

      const removeButton = document.createElement('button')
      removeButton.type = 'button'
      removeButton.className = 'plm-extension-grid-chip-remove'
      removeButton.setAttribute('aria-label', 'Remove applied filter')
      const removeIcon = document.createElement('span')
      removeIcon.className = 'zmdi zmdi-close'
      removeIcon.setAttribute('aria-hidden', 'true')
      removeButton.appendChild(removeIcon)
      removeButton.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        params.onRemove(group.id, condition.id)
      })

      chip.appendChild(label)
      chip.appendChild(removeButton)
      list.appendChild(chip)
    }
  }
}

export function removeSummaryBar(): void {
  const summary = document.getElementById(GRID_SUMMARY_ID)
  if (summary) summary.remove()
}
