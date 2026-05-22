import { GRID_IMPORT_PREVIEW_ROW_LIMIT, sampleCsvRows } from '../csv.service'
import type { GridImportDialogCallbacks, GridImportDialogState } from './types'
import {
  createKeyIcon,
  createTableCell,
  createValidationStatusIcon,
  IMPORT_UI_FONT,
  style
} from './dom'

const VALIDATION_COLUMN_WIDTH = '44px'
const MAPPING_GUIDE_BLOCK_HEIGHT_PX = 120
const CSV_COLUMN_LABEL_STICKY_TOP_PX = MAPPING_GUIDE_BLOCK_HEIGHT_PX
const CSV_MAPPING_ROW_STICKY_TOP_PX = MAPPING_GUIDE_BLOCK_HEIGHT_PX + 34

function createMappingPreviewGuide(previewCount: number, totalRows: number): HTMLElement {
  const guide = document.createElement('div')
  style(
    guide,
    'position:sticky;top:0;left:0;z-index:6;padding:10px 12px 12px;background:#fff;border-bottom:1px solid #e2e8f0;box-sizing:border-box;'
  )

  const title = document.createElement('div')
  title.textContent = `Map fields above each CSV column. Preview first ${previewCount} of ${totalRows} rows.`
  style(title, `font:700 12px/1.3 ${IMPORT_UI_FONT};color:#334155;text-transform:uppercase;`)

  const note = document.createElement('div')
  style(note, `margin-top:8px;font:500 12px/1.45 ${IMPORT_UI_FONT};color:#4b637a;`)

  const intro = document.createElement('p')
  intro.textContent = 'Assign each CSV column to the correct grid field using the dropdowns below.'
  style(intro, 'margin:0 0 6px;')

  const list = document.createElement('ul')
  style(list, 'margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px;')
  for (const text of [
    'Only editable fields on this view appear in the dropdown — read-only and formula fields are not available to map.',
    'Use the key icon beside a mapped column header to turn Match On on or off. You can select one or more keys.',
    'Rows that match an existing grid row on all selected Match On keys will update that row; rows with no match are added as new rows.'
  ]) {
    const item = document.createElement('li')
    item.textContent = text
    list.appendChild(item)
  }

  const autoMatchNote = document.createElement('p')
  autoMatchNote.textContent =
    'On load, columns are auto-matched where a CSV header name matches a grid field name (spacing and letter case are ignored). Review every dropdown and adjust any incorrect matches.'
  style(autoMatchNote, `margin:8px 0 0;font:600 12px/1.45 ${IMPORT_UI_FONT};color:#b91c1c;`)

  note.appendChild(intro)
  note.appendChild(list)
  note.appendChild(autoMatchNote)
  guide.appendChild(title)
  guide.appendChild(note)
  return guide
}

function appendValidationHeaderCell(headRow: HTMLTableRowElement): void {
  const validationHeader = createTableCell('', true)
  validationHeader.title = 'Validation'
  validationHeader.style.left = '0'
  validationHeader.style.top = `${CSV_COLUMN_LABEL_STICKY_TOP_PX}px`
  validationHeader.style.zIndex = '5'
  validationHeader.style.width = VALIDATION_COLUMN_WIDTH
  validationHeader.style.minWidth = VALIDATION_COLUMN_WIDTH
  validationHeader.style.maxWidth = VALIDATION_COLUMN_WIDTH
  validationHeader.style.padding = '6px 2px'
  validationHeader.style.textAlign = 'center'
  validationHeader.style.background = '#eaf2fb'
  headRow.appendChild(validationHeader)
}

function appendColumnHeaderCell(
  headRow: HTMLTableRowElement,
  state: GridImportDialogState,
  headerName: string,
  callbacks: GridImportDialogCallbacks
): void {
  const matchedFieldId = state.mapping.find((entry) => entry.header === headerName)?.fieldId || ''
  const isKeyHeader = Boolean(matchedFieldId && state.matchFieldIds.includes(matchedFieldId))

  const headerCell = createTableCell(headerName, true)
  headerCell.style.top = `${CSV_COLUMN_LABEL_STICKY_TOP_PX}px`
  headerCell.style.zIndex = '3'
  headerCell.style.minWidth = '190px'
  headerCell.style.maxWidth = '260px'
  headerCell.textContent = ''

  const headerWrap = document.createElement('span')
  style(headerWrap, 'display:inline-flex;align-items:center;gap:6px;min-width:0;max-width:100%;')

  const keyBadge = document.createElement('button')
  keyBadge.type = 'button'
  keyBadge.disabled = !matchedFieldId
  style(
    keyBadge,
    [
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'width:21px',
      'height:21px',
      'padding:0',
      'border-radius:5px',
      'border:1px solid',
      'flex:0 0 auto',
      matchedFieldId && isKeyHeader
        ? 'background:#e0f2fe;color:#0369a1;border-color:#7dd3fc;'
        : 'background:#fff;color:#94a3b8;border-color:#cbd5e1;',
      matchedFieldId ? 'cursor:pointer;' : 'cursor:not-allowed;opacity:.45;'
    ].join(';')
  )
  keyBadge.title = matchedFieldId
    ? 'Toggle Match On for this mapped column (one or more keys can be active)'
    : 'Map this column to a grid field before using Match On'
  keyBadge.appendChild(createKeyIcon())
  keyBadge.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (!matchedFieldId) return
    const next = isKeyHeader
      ? state.matchFieldIds.filter((fieldId) => fieldId !== matchedFieldId)
      : [...state.matchFieldIds, matchedFieldId]
    callbacks.onMatchFieldsChanged(next)
  })

  const headerText = document.createElement('span')
  headerText.textContent = headerName
  style(headerText, 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;')
  headerWrap.appendChild(keyBadge)
  headerWrap.appendChild(headerText)
  headerCell.appendChild(headerWrap)
  headRow.appendChild(headerCell)
}

function appendMappingSelectCell(
  mappingRow: HTMLTableRowElement,
  state: GridImportDialogState,
  headerName: string,
  callbacks: GridImportDialogCallbacks
): void {
  const th = document.createElement('th')
  style(
    th,
    [
      'position:sticky',
      `top:${CSV_MAPPING_ROW_STICKY_TOP_PX}px`,
      'z-index:2',
      'background:#f8fbff',
      'min-width:190px',
      'max-width:260px',
      'padding:0',
      'border-bottom:1px solid #d8e2ee',
      'text-align:left',
      'vertical-align:top'
    ].join(';')
  )

  const select = document.createElement('select')
  style(
    select,
    'display:block;width:100%;box-sizing:border-box;height:32px;padding:0 8px;border:1px solid #cbd5e1;border-radius:0;background:#fff;font:600 12px/1.2 "Segoe UI",Arial,sans-serif;color:#24364a;'
  )

  const currentFieldId = state.mapping.find((entry) => entry.header === headerName)?.fieldId || ''
  const usedFieldIds = new Set(
    state.mapping.filter((entry) => entry.header && entry.header !== headerName).map((entry) => entry.fieldId)
  )

  const emptyOption = document.createElement('option')
  emptyOption.value = ''
  emptyOption.textContent = ''
  emptyOption.selected = currentFieldId === ''
  select.appendChild(emptyOption)

  for (const field of state.fields) {
    if (usedFieldIds.has(field.fieldId)) continue
    const option = document.createElement('option')
    option.value = field.fieldId
    option.textContent = `${field.name}${field.field.required ? ' *' : ''}`
    option.selected = field.fieldId === currentFieldId
    select.appendChild(option)
  }

  select.addEventListener('change', () => {
    const selectedFieldId = select.value
    const next = state.mapping.map((entry) => {
      if (entry.header === headerName) return { ...entry, header: '' }
      if (selectedFieldId && entry.fieldId === selectedFieldId) return { ...entry, header: headerName }
      return entry
    })
    callbacks.onMappingChanged(next)
  })

  th.appendChild(select)
  mappingRow.appendChild(th)
}

function appendPreviewDataRow(
  tbody: HTMLTableSectionElement,
  state: GridImportDialogState,
  row: string[],
  rowIndex: number
): void {
  const csvRowNumber = rowIndex + 2
  const tr = document.createElement('tr')

  if (state.showValidationColumn) {
    const rowStatus = state.rowValidation[csvRowNumber]
    const validationCell = document.createElement('td')
    style(
      validationCell,
      [
        'position:sticky',
        'left:0',
        'z-index:1',
        'background:#fff',
        `width:${VALIDATION_COLUMN_WIDTH}`,
        `min-width:${VALIDATION_COLUMN_WIDTH}`,
        `max-width:${VALIDATION_COLUMN_WIDTH}`,
        'padding:4px 2px',
        'border-bottom:1px solid #edf2f7',
        'text-align:center',
        'vertical-align:middle'
      ].join(';')
    )
    if (rowStatus) {
      const iconTone = rowStatus.tone === 'pass' ? 'success' : rowStatus.tone === 'error' ? 'danger' : 'warning'
      validationCell.style.color =
        rowStatus.tone === 'pass' ? '#16a34a' : rowStatus.tone === 'error' ? '#dc2626' : '#d97706'
      validationCell.title = rowStatus.tone === 'pass' ? 'Row passed validation' : rowStatus.messages.join('\n')
      validationCell.appendChild(createValidationStatusIcon(iconTone))
    }
    tr.appendChild(validationCell)
  }

  for (let index = 0; index < state.parsed!.headers.length; index += 1) {
    tr.appendChild(createTableCell(String(row[index] ?? '')))
  }
  tbody.appendChild(tr)
}

/** Renders the sticky guide, mapping dropdowns, and CSV preview rows into the preview pane. */
export function renderMappingPreview(
  previewPane: HTMLElement,
  state: GridImportDialogState,
  callbacks: GridImportDialogCallbacks
): void {
  previewPane.textContent = ''
  if (!state.parsed) return

  const previewCount = Math.min(GRID_IMPORT_PREVIEW_ROW_LIMIT, state.parsed.rows.length)
  previewPane.appendChild(createMappingPreviewGuide(previewCount, state.parsed.rows.length))

  const table = document.createElement('table')
  style(table, 'width:max-content;min-width:100%;border-collapse:collapse;')

  const head = document.createElement('thead')
  const headRow = document.createElement('tr')
  if (state.showValidationColumn) appendValidationHeaderCell(headRow)
  for (const headerName of state.parsed.headers) {
    appendColumnHeaderCell(headRow, state, headerName, callbacks)
  }

  const mappingRow = document.createElement('tr')
  if (state.showValidationColumn) {
    const validationMappingCell = document.createElement('th')
    style(
      validationMappingCell,
      [
        'position:sticky',
        'left:0',
        `top:${CSV_MAPPING_ROW_STICKY_TOP_PX}px`,
        'z-index:4',
        'background:#f8fbff',
        `width:${VALIDATION_COLUMN_WIDTH}`,
        `min-width:${VALIDATION_COLUMN_WIDTH}`,
        `max-width:${VALIDATION_COLUMN_WIDTH}`,
        'padding:0',
        'border-bottom:1px solid #d8e2ee'
      ].join(';')
    )
    mappingRow.appendChild(validationMappingCell)
  }
  for (const headerName of state.parsed.headers) {
    appendMappingSelectCell(mappingRow, state, headerName, callbacks)
  }

  head.appendChild(headRow)
  head.appendChild(mappingRow)

  const tbody = document.createElement('tbody')
  const sampledRows = sampleCsvRows(state.parsed.rows)
  for (let rowIndex = 0; rowIndex < sampledRows.length; rowIndex += 1) {
    appendPreviewDataRow(tbody, state, sampledRows[rowIndex], rowIndex)
  }

  table.appendChild(head)
  table.appendChild(tbody)
  previewPane.appendChild(table)
}
