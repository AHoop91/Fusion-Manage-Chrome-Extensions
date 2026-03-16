import { GRID_COMMAND_RIGHT_HOST_ID } from './model'

export function getPrimaryCommandButtonHost(): HTMLElement | null {
  for (const id of ['grid-remove-button', 'grid-add-button', 'grid-edit-button']) {
    const button = document.getElementById(id)
    if (button?.parentElement instanceof HTMLElement) return button.parentElement
  }
  return null
}

export function getCommandButtonHost(): HTMLElement | null {
  const gridCommandBar = document.querySelector('#transcluded-buttons .grid-command-bar') as HTMLElement | null
  if (gridCommandBar) {
    gridCommandBar.style.width = '100%'
    gridCommandBar.style.display = 'flex'
    gridCommandBar.style.alignItems = 'center'

    let rightHost = gridCommandBar.querySelector(`#${GRID_COMMAND_RIGHT_HOST_ID}`) as HTMLElement | null
    if (!rightHost) {
      rightHost = document.createElement('span')
      rightHost.id = GRID_COMMAND_RIGHT_HOST_ID
      rightHost.style.cssText = 'display:inline-flex;align-items:center;gap:8px;margin-left:auto;'
      gridCommandBar.appendChild(rightHost)
    }
    return rightHost
  }

  return getPrimaryCommandButtonHost()
}

export function getPanelHost(table: HTMLTableElement): HTMLElement | null {
  const spreadsheet = table.closest('spreadsheet') as HTMLElement | null
  if (spreadsheet?.parentElement) return spreadsheet.parentElement
  return table.parentElement
}

export function getSummaryHost(table: HTMLTableElement): { host: HTMLElement; anchor: HTMLElement | null } | null {
  const spreadsheet = table.closest('spreadsheet') as HTMLElement | null
  if (spreadsheet) {
    const gridRoot = spreadsheet.querySelector('#grid-spreadsheet') as HTMLElement | null
    return { host: spreadsheet, anchor: gridRoot }
  }

  const tableContainer = table.closest('#grid-spreadsheet') as HTMLElement | null
  if (tableContainer?.parentElement instanceof HTMLElement) {
    return { host: tableContainer.parentElement, anchor: tableContainer }
  }

  if (table.parentElement instanceof HTMLElement) {
    return { host: table.parentElement, anchor: table }
  }

  return null
}
