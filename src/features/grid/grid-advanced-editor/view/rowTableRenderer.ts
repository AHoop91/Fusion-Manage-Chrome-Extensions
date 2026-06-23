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
  /** Keys `e:${domRowIndex}:${fieldId}` or `i:${insertIndex}:${fieldId}` for duplicate unique-in-grid cells */
  uniqueDuplicateCellKeys: Set<string>
}

function splitMultiValue(raw: string): string[] {
  return String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function buildUniqueDuplicateWarnSpan(): HTMLElement {
  const wrap = el('span')
    .cls('plm-extension-grid-form-unique-warn')
    .attr('role', 'img')
    .attr('aria-label', 'Warning: duplicate value; must be unique in this grid')
    .title('Matches another row — must be unique in this grid')
    .build()

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('class', 'plm-extension-grid-form-unique-warn-svg')
  svg.setAttribute('focusable', 'false')
  svg.setAttribute('aria-hidden', 'true')

  /* Rounded triangle (flat UI style — curves replace sharp corners). */
  const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  triangle.setAttribute(
    'd',
    'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'
  )
  triangle.setAttribute('fill', '#fb7185')

  /*
   * White “!” — tapered bar (wider at top) + dot; filled shapes, no strokes (flat UI).
   */
  const stem = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  stem.setAttribute('fill', '#ffffff')
  stem.setAttribute('d', 'M10.75 9.25 L13.25 9.25 L12.42 15.1 L11.58 15.1 Z')

  const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  dot.setAttribute('cx', '12')
  dot.setAttribute('cy', '17.5')
  dot.setAttribute('r', '1.48')
  dot.setAttribute('fill', '#ffffff')

  svg.appendChild(triangle)
  svg.appendChild(stem)
  svg.appendChild(dot)
  wrap.appendChild(svg)
  return wrap as HTMLElement
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
    const headerCell = headerCells[columnIndex]!
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

function renderTableValueCell(
  valueCell: HTMLTableCellElement,
  rawValue: string,
  field: ApiTableColumn['field'],
  options?: { showDuplicateUniqueWarning?: boolean }
): void {
  const showWarn = Boolean(options?.showDuplicateUniqueWarning)
  const value = String(rawValue || '').trim()
  if (isBooleanFieldType(field.typeId)) {
    const checkbox = el('input').type('checkbox').disabled(true).build() as HTMLInputElement
    checkbox.tabIndex = -1
    const normalized = value.toLowerCase()
    checkbox.checked = normalized === 'true' || normalized === '1' || normalized === 'yes'
    valueCell.textContent = ''
    valueCell.style.whiteSpace = 'normal'
    const wrap = el('span').cls('plm-extension-grid-form-row-cell-value-wrap').build()
    wrap.appendChild(checkbox)
    if (showWarn) wrap.appendChild(buildUniqueDuplicateWarnSpan())
    valueCell.appendChild(wrap)
    valueCell.title = checkbox.checked ? 'True' : 'False'
    return
  }

  if (!value) {
    valueCell.textContent = ''
    if (showWarn) {
      const wrap = el('span').cls('plm-extension-grid-form-row-cell-value-wrap').build()
      wrap.appendChild(document.createTextNode('-'))
      wrap.appendChild(buildUniqueDuplicateWarnSpan())
      valueCell.appendChild(wrap)
    } else {
      valueCell.textContent = '-'
    }
    valueCell.title = ''
    return
  }

  const lineValue = isMultiLookupFieldType(field.typeId) ? splitMultiValue(value).join('\n') : value
  valueCell.style.whiteSpace = 'pre-line'
  valueCell.textContent = ''
  const wrap = el('span').cls('plm-extension-grid-form-row-cell-value-wrap').build()
  wrap.appendChild(document.createTextNode(lineValue))
  if (showWarn) wrap.appendChild(buildUniqueDuplicateWarnSpan())
  valueCell.appendChild(wrap)
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
    onInsertRowToggle,
    uniqueDuplicateCellKeys
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
    const model = selectedRowModels[index]!
    const rowNode = el('tr').build()
    const isRemoved = pendingRemovalRowIndexes.has(model.domRowIndex)
    const isUpdated = pendingChangesByDomRowIndex.has(model.domRowIndex)
    const rowId = String(model.apiRow?.rowId || '')
    const hasCommitError = erroredExistingRowIndexes.has(index)
    if (rowId) rowIdByDomRowIndex.set(model.domRowIndex, rowId)
    if (isRemoved) rowNode.classList.add('is-removed')
    else if (isUpdated) rowNode.classList.add('is-staged-updated')
    if (hasCommitError) rowNode.classList.add('is-commit-error')
    if (selectedExistingRowIndexes.has(index)) rowNode.classList.add('is-active')

    const rowCheck = el('input').type('checkbox').cls('plm-extension-grid-form-select-checkbox').build() as HTMLInputElement
    rowCheck.checked = selectedExistingRowIndexes.has(index)
    rowCheck.addEventListener('change', () => onExistingRowToggle(index, rowCheck.checked, model))
    rowNode.addEventListener('click', (event) => {
      if (event.target === rowCheck) return
      const next = !rowCheck.checked
      rowCheck.checked = next
      onExistingRowToggle(index, next, model)
    })
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
      const cellKey = `e:${model.domRowIndex}:${column.field.fieldId}`
      renderTableValueCell(valueCell, value || column.field.defaultValue || '', column.field, {
        showDuplicateUniqueWarning: uniqueDuplicateCellKeys.has(cellKey)
      })
      rowNode.appendChild(valueCell)
      const columnCellWidth = columnWidthByIndex.get(rowNode.cells.length - 1)
      if (typeof columnCellWidth === 'number') {
        applyColumnWidth(rowTableHeadRow, rowTableBody, columnWidthByIndex, rowNode.cells.length - 1, columnCellWidth)
      }
    }
    rowTableBody.appendChild(rowNode)
  }

  for (let insertIndex = 0; insertIndex < pendingInsertDrafts.length; insertIndex += 1) {
    const insertDraft = pendingInsertDrafts[insertIndex]!
    const rowNode = el('tr').cls('is-staged-new').build()
    if (erroredInsertIndexes.has(insertIndex)) rowNode.classList.add('is-commit-error')
    if (selectedInsertIndexes.has(insertIndex)) rowNode.classList.add('is-active')
    const insertCheck = el('input').type('checkbox').cls('plm-extension-grid-form-select-checkbox').build() as HTMLInputElement
    insertCheck.checked = selectedInsertIndexes.has(insertIndex)
    insertCheck.addEventListener('change', () => onInsertRowToggle(insertIndex, insertCheck.checked))
    rowNode.addEventListener('click', (event) => {
      if (event.target === insertCheck) return
      const next = !insertCheck.checked
      insertCheck.checked = next
      onInsertRowToggle(insertIndex, next)
    })
    rowNode.appendChild(el('td').append(insertCheck).build())
    const selectWidth = columnWidthByIndex.get(0)
    if (typeof selectWidth === 'number') {
      applyColumnWidth(rowTableHeadRow, rowTableBody, columnWidthByIndex, 0, selectWidth)
    }

    for (const column of apiTableColumns) {
      const valueCell = el('td').build()
      const value = insertDraft.display.get(column.field.fieldId) || column.field.defaultValue || ''
      const cellKey = `i:${insertIndex}:${column.field.fieldId}`
      renderTableValueCell(valueCell, value, column.field, {
        showDuplicateUniqueWarning: uniqueDuplicateCellKeys.has(cellKey)
      })
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
