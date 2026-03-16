import { el } from './domBuilder'
import { isBooleanFieldType, isMultiLookupFieldType } from '../services/fieldTypes'
import type { ApiTableColumn, SelectedRowModel } from '../types'

/**
 * Staged insert row snapshot rendered alongside existing selected rows.
 */
export interface PendingInsertDraftLike {
  payload: Map<string, string>
  display: Map<string, string>
  source: 'add' | 'clone'
}

/**
 * Result state returned after row-table render completes.
 */
export interface RowTableRenderResult {
  hasRows: boolean
  hasMetadata: boolean
}

/**
 * Input contract for rendering modal row table and binding selection handlers.
 */
export interface RowTableRenderArgs {
  rowTableHeadRow: HTMLTableRowElement
  rowTableBody: HTMLTableSectionElement
  apiTableColumns: ApiTableColumn[]
  selectedRowModels: SelectedRowModel[]
  pendingInsertDrafts: PendingInsertDraftLike[]
  pendingChangesByDomRowIndex: Map<number, Map<string, string>>
  pendingDisplayByDomRowIndex: Map<number, Map<string, string>>
  pendingRemovalRowIndexes: Set<number>
  selectedExistingRowIndexes: Set<number>
  selectedInsertIndexes: Set<number>
  erroredExistingRowIndexes: Set<number>
  erroredInsertIndexes: Set<number>
  rowIdByDomRowIndex: Map<number, string>
  columnWidthByIndex: Map<number, number>
  normalizeActiveSelection: () => void
  resolveTableValue: (model: SelectedRowModel, column: ApiTableColumn) => string
  onSelectAllToggle: (checked: boolean) => void
  onExistingRowToggle: (rowIndex: number, checked: boolean, model: SelectedRowModel) => void
  onInsertRowToggle: (insertIndex: number, checked: boolean) => void
}

function splitMultiValue(raw: string): string[] {
  return String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function applyColumnWidth(
  rowTableHeadRow: HTMLTableRowElement,
  rowTableBody: HTMLTableSectionElement,
  columnWidthByIndex: Map<number, number>,
  columnIndex: number,
  width: number
): void {
  const minWidth = columnIndex === 0 ? 44 : 70
  const normalizedWidth = Math.max(minWidth, Math.round(width))
  columnWidthByIndex.set(columnIndex, normalizedWidth)
  const headerCell = rowTableHeadRow.cells[columnIndex] as HTMLTableCellElement | undefined
  if (headerCell) {
    headerCell.style.width = `${normalizedWidth}px`
    headerCell.style.minWidth = `${normalizedWidth}px`
    headerCell.style.maxWidth = `${normalizedWidth}px`
  }
  const rows = Array.from(rowTableBody.rows) as HTMLTableRowElement[]
  for (const rowNode of rows) {
    const cell = rowNode.cells[columnIndex] as HTMLTableCellElement | undefined
    if (!cell) continue
    cell.style.width = `${normalizedWidth}px`
    cell.style.minWidth = `${normalizedWidth}px`
    cell.style.maxWidth = `${normalizedWidth}px`
  }
}

function attachColumnResizers(
  rowTableHeadRow: HTMLTableRowElement,
  rowTableBody: HTMLTableSectionElement,
  columnWidthByIndex: Map<number, number>
): void {
  const headerCells = Array.from(rowTableHeadRow.cells) as HTMLTableCellElement[]
  for (let columnIndex = 0; columnIndex < headerCells.length; columnIndex += 1) {
    const headerCell = headerCells[columnIndex]
    headerCell.classList.add('has-resize-handle')
    if (!headerCell.style.width) {
      const seededWidth = columnWidthByIndex.get(columnIndex)
      if (typeof seededWidth === 'number') {
        applyColumnWidth(rowTableHeadRow, rowTableBody, columnWidthByIndex, columnIndex, seededWidth)
      }
    }

    const handle = el('span').cls('plm-extension-grid-form-col-resizer').build()
    handle.addEventListener('mousedown', (event) => {
      event.preventDefault()
      event.stopPropagation()
      const startX = event.clientX
      const startWidth = (rowTableHeadRow.cells[columnIndex] as HTMLTableCellElement).getBoundingClientRect().width

      const onMove = (moveEvent: MouseEvent): void => {
        const nextWidth = startWidth + (moveEvent.clientX - startX)
        applyColumnWidth(rowTableHeadRow, rowTableBody, columnWidthByIndex, columnIndex, nextWidth)
      }

      const onUp = (): void => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }

      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    })
    headerCell.appendChild(handle)
  }
}

function renderTableValueCell(valueCell: HTMLTableCellElement, rawValue: string, field: ApiTableColumn['field']): void {
  const value = String(rawValue || '').trim()
  if (isBooleanFieldType(field.typeId)) {
    const checkbox = el('input').type('checkbox').disabled(true).build() as HTMLInputElement
    checkbox.tabIndex = -1
    const normalized = value.toLowerCase()
    checkbox.checked = normalized === 'true' || normalized === '1' || normalized === 'yes'
    valueCell.textContent = ''
    valueCell.style.whiteSpace = 'normal'
    valueCell.appendChild(checkbox)
    valueCell.title = checkbox.checked ? 'True' : 'False'
    return
  }

  if (!value) {
    valueCell.textContent = '-'
    valueCell.title = ''
    return
  }

  const lineValue = isMultiLookupFieldType(field.typeId) ? splitMultiValue(value).join('\n') : value
  valueCell.style.whiteSpace = 'pre-line'
  valueCell.textContent = lineValue
  valueCell.title = value
}

/**
 * Renders row table including headers, row values, selection checkboxes and resizers.
 */
export function renderRowTable(args: RowTableRenderArgs): RowTableRenderResult {
  const {
    rowTableHeadRow,
    rowTableBody,
    apiTableColumns,
    selectedRowModels,
    pendingInsertDrafts,
    pendingChangesByDomRowIndex,
    pendingDisplayByDomRowIndex,
    pendingRemovalRowIndexes,
    selectedExistingRowIndexes,
    selectedInsertIndexes,
    erroredExistingRowIndexes,
    erroredInsertIndexes,
    rowIdByDomRowIndex,
    columnWidthByIndex,
    normalizeActiveSelection,
    resolveTableValue,
    onSelectAllToggle,
    onExistingRowToggle,
    onInsertRowToggle
  } = args

  rowTableHeadRow.textContent = ''
  rowTableBody.textContent = ''
  normalizeActiveSelection()

  const selectHeader = el('th').build()
  const selectAll = el('input').type('checkbox').cls('plm-extension-grid-form-select-checkbox').build() as HTMLInputElement
  const totalRows = selectedRowModels.length + pendingInsertDrafts.length
  const selectedTotal = selectedExistingRowIndexes.size + selectedInsertIndexes.size
  selectAll.checked = totalRows > 0 && selectedTotal === totalRows
  selectAll.indeterminate = selectedTotal > 0 && selectedTotal < totalRows
  selectAll.addEventListener('change', () => onSelectAllToggle(selectAll.checked))
  selectHeader.appendChild(selectAll)
  rowTableHeadRow.appendChild(selectHeader)
  if (columnWidthByIndex.has(0)) {
    applyColumnWidth(rowTableHeadRow, rowTableBody, columnWidthByIndex, 0, Number(columnWidthByIndex.get(0)))
  }

  for (const column of apiTableColumns) {
    const columnHeaderText = el('span').text(column.field.title).build()
    const columnHeader = el('th').append(columnHeaderText).build()
    if (column.field.required) {
      const requiredMark = el('span').cls('plm-extension-grid-form-header-required-mark').text(' *').title('Required').build()
      columnHeader.appendChild(requiredMark)
    }
    rowTableHeadRow.appendChild(columnHeader)
    const columnWidth = columnWidthByIndex.get(rowTableHeadRow.cells.length - 1)
    if (typeof columnWidth === 'number') {
      applyColumnWidth(rowTableHeadRow, rowTableBody, columnWidthByIndex, rowTableHeadRow.cells.length - 1, columnWidth)
    }
  }

  if (selectedRowModels.length === 0 && pendingInsertDrafts.length === 0) {
    const cell = el('td').text('No rows available.').build()
    cell.colSpan = Math.max(1, apiTableColumns.length + 1)
    rowTableBody.appendChild(el('tr').append(cell).build())
    return { hasRows: false, hasMetadata: apiTableColumns.length > 0 }
  }

  if (apiTableColumns.length === 0) {
    const cell = el('td').text('Waiting for row and field metadata...').build()
    cell.colSpan = 1
    rowTableBody.appendChild(el('tr').append(cell).build())
    return { hasRows: true, hasMetadata: false }
  }

  for (let index = 0; index < selectedRowModels.length; index += 1) {
    const model = selectedRowModels[index]
    const rowNode = el('tr').build()
    const isRemoved = pendingRemovalRowIndexes.has(model.domRowIndex)
    const isUpdated = pendingChangesByDomRowIndex.has(model.domRowIndex)
    const rowId = String(model.apiRow?.rowId || '')
    const hasCommitError = erroredExistingRowIndexes.has(index)
    if (rowId) rowIdByDomRowIndex.set(model.domRowIndex, rowId)
    if (isRemoved) rowNode.classList.add('is-removed')
    else if (isUpdated) rowNode.classList.add('is-staged-updated')
    if (hasCommitError) rowNode.classList.add('is-commit-error')

    const rowCheck = el('input').type('checkbox').cls('plm-extension-grid-form-select-checkbox').build() as HTMLInputElement
    rowCheck.checked = selectedExistingRowIndexes.has(index)
    rowCheck.addEventListener('change', () => onExistingRowToggle(index, rowCheck.checked, model))
    const selectCell = el('td').append(rowCheck).build()
    rowNode.appendChild(selectCell)
    const selectWidth = columnWidthByIndex.get(0)
    if (typeof selectWidth === 'number') {
      applyColumnWidth(rowTableHeadRow, rowTableBody, columnWidthByIndex, 0, selectWidth)
    }

    for (const column of apiTableColumns) {
      const valueCell = el('td').build()
      const pendingDisplay = pendingDisplayByDomRowIndex.get(model.domRowIndex)?.get(column.field.fieldId)
      const value =
        typeof pendingDisplay === 'string' ? pendingDisplay : resolveTableValue(model, column)
      renderTableValueCell(valueCell, value || column.field.defaultValue || '', column.field)
      rowNode.appendChild(valueCell)
      const columnCellWidth = columnWidthByIndex.get(rowNode.cells.length - 1)
      if (typeof columnCellWidth === 'number') {
        applyColumnWidth(rowTableHeadRow, rowTableBody, columnWidthByIndex, rowNode.cells.length - 1, columnCellWidth)
      }
    }
    rowTableBody.appendChild(rowNode)
  }

  for (let insertIndex = 0; insertIndex < pendingInsertDrafts.length; insertIndex += 1) {
    const insertDraft = pendingInsertDrafts[insertIndex]
    const rowNode = el('tr').cls('is-staged-new').build()
    if (erroredInsertIndexes.has(insertIndex)) rowNode.classList.add('is-commit-error')
    const insertCheck = el('input').type('checkbox').cls('plm-extension-grid-form-select-checkbox').build() as HTMLInputElement
    insertCheck.checked = selectedInsertIndexes.has(insertIndex)
    insertCheck.addEventListener('change', () => onInsertRowToggle(insertIndex, insertCheck.checked))
    rowNode.appendChild(el('td').append(insertCheck).build())
    const selectWidth = columnWidthByIndex.get(0)
    if (typeof selectWidth === 'number') {
      applyColumnWidth(rowTableHeadRow, rowTableBody, columnWidthByIndex, 0, selectWidth)
    }

    for (const column of apiTableColumns) {
      const valueCell = el('td').build()
      const value = insertDraft.display.get(column.field.fieldId) || column.field.defaultValue || ''
      renderTableValueCell(valueCell, value, column.field)
      rowNode.appendChild(valueCell)
      const columnCellWidth = columnWidthByIndex.get(rowNode.cells.length - 1)
      if (typeof columnCellWidth === 'number') {
        applyColumnWidth(rowTableHeadRow, rowTableBody, columnWidthByIndex, rowNode.cells.length - 1, columnCellWidth)
      }
    }
    rowTableBody.appendChild(rowNode)
  }

  attachColumnResizers(rowTableHeadRow, rowTableBody, columnWidthByIndex)
  return { hasRows: true, hasMetadata: true }
}
