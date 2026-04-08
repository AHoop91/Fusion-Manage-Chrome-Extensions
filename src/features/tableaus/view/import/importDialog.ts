import { decompressFromBase64 } from '../../../../shared/utils/export'
import {
  buildAllowedFieldIdSetFromTableauMeta,
  collectTableauFieldImportIssues,
  type TableauFieldImportIssue
} from '../../services/fieldSelf'
import { parseTableauExport, ValidationError } from '../../services/schema'
import { extractTenant } from '../../services/tableaus.service'
import type { TableausApi } from '../../services/tableaus.api'
import type { TableauExport } from '../../tableaus.types'
import { COMPRESS_EXPORT } from '../../tableaus.constants'

type ImportFlowOptions = {
  text: string
  wsId: string
  api: TableausApi
}

type ImportDialog = {
  remove: () => void
}

// ---------------------------------------------------------------------------
// Payload transformation helpers (exported for unit testing)
// ---------------------------------------------------------------------------

export function stripFieldObject(field: unknown): unknown {
  if (!field || typeof field !== 'object' || Array.isArray(field)) return field
  const f = field as Record<string, unknown>
  const { value: _v, uomConverted: _uc, formulaField: _ff, defaultValue: _dv, ...clean } = f
  if (clean.type && typeof clean.type === 'object' && !Array.isArray(clean.type)) {
    const t = clean.type as Record<string, unknown>
    clean.type = { link: t.link }
  }
  return clean
}

export function stripColumn(col: unknown): unknown {
  if (!col || typeof col !== 'object' || Array.isArray(col)) return col
  const c = col as Record<string, unknown>
  const { displayOrder, sort, visible: _v, originalElement: _oe, appliedFilters: _af, ...baseFields } = c
  const cleanedBase = { ...baseFields, field: stripFieldObject(baseFields.field) }
  const result: Record<string, unknown> = {
    ...cleanedBase,
    originalElement: cleanedBase,
    displayOrder,
    visible: true
  }
  if (sort !== undefined) result.sort = sort
  return result
}

export function stripDefaults(body: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...body }
  if (!cleaned.showOnlyDeletedRecords) delete cleaned.showOnlyDeletedRecords
  if (!cleaned.description) delete cleaned.description
  if (Array.isArray(cleaned.columns)) {
    cleaned.columns = cleaned.columns.map(stripColumn)
  }
  return cleaned
}

/**
 * Returns the next available name that is not in `existingTitles` or `reserved`.
 * Strips any existing trailing " (N)" suffix and increments from the base name.
 * `reserved` tracks names claimed earlier in the same batch to avoid intra-batch collisions.
 */
export function resolveUniqueName(
  base: string,
  existingTitles: Set<string>,
  reserved: Set<string>
): string {
  const key = base.trim().toLowerCase()
  if (!existingTitles.has(key) && !reserved.has(key)) return base.trim()
  const stripped = base.trim().replace(/\s*\(\d+\)$/, '')
  for (let n = 1; n <= 9999; n++) {
    const candidate = `${stripped} (${n})`
    const candidateKey = candidate.toLowerCase()
    if (!existingTitles.has(candidateKey) && !reserved.has(candidateKey)) return candidate
  }
  return `${stripped} (${Date.now()})`
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function createOverlay(): HTMLElement {
  const overlay = document.createElement('div')
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:10000',
    'background:rgba(15,23,42,0.45)',
    'display:flex',
    'align-items:center',
    'justify-content:center'
  ].join(';')
  return overlay
}

function createDialogBox(): HTMLElement {
  const box = document.createElement('div')
  box.style.cssText = [
    'background:#fff',
    'border:1px solid #d8dee9',
    'border-radius:12px',
    'box-shadow:0 22px 40px rgba(16,24,40,0.24)',
    'padding:24px',
    'width:min(560px,92vw)',
    'max-height:min(75vh,700px)',
    'display:flex',
    'flex-direction:column',
    'box-sizing:border-box',
    'font-size:14px',
    'font-family:inherit'
  ].join(';')
  return box
}

function createButton(label: string, primary: boolean): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.textContent = label
  btn.style.cssText = [
    'padding:8px 16px',
    'border-radius:8px',
    'border:none',
    'cursor:pointer',
    'font:600 12px/1 Segoe UI,Arial,sans-serif',
    primary
      ? 'background:#2563eb;color:#fff;'
      : 'background:#fff;color:#334155;border:1px solid #cbd5e1;'
  ].join(';')
  return btn
}

function buildErrorDialog(message: string, onClose: () => void): HTMLElement {
  const overlay = createOverlay()
  const box = createDialogBox()

  const title = document.createElement('div')
  title.style.cssText = 'font:700 18px/1.3 Segoe UI,Arial,sans-serif;color:#0f172a;margin-bottom:8px;'
  title.textContent = 'Import Failed'

  const msg = document.createElement('div')
  msg.style.cssText = 'color:#9f1239;margin-bottom:20px;font-size:13px;white-space:pre-wrap;'
  msg.textContent = message

  const closeBtn = createButton('Close', true)
  closeBtn.addEventListener('click', onClose)

  box.appendChild(title)
  box.appendChild(msg)
  box.appendChild(closeBtn)
  overlay.appendChild(box)
  return overlay
}

type ImportViewValidationRow = {
  index: number
  name: string
  issues: TableauFieldImportIssue[]
}

function viewCountPhrase(n: number): string {
  return n === 1 ? '1 view' : `${n} views`
}

function buildFieldValidationSummaryDialog(options: {
  rows: ImportViewValidationRow[]
  totalViewCount: number
  successfulExports: TableauExport[]
  onClose: () => void
  onContinueWithSuccessful: () => void
}): HTMLElement {
  const { rows, totalViewCount, successfulExports, onClose, onContinueWithSuccessful } = options

  const overlay = createOverlay()
  const box = document.createElement('div')
  box.style.cssText = [
    'background:#fff',
    'border:1px solid #d8dee9',
    'border-radius:12px',
    'box-shadow:0 22px 40px rgba(16,24,40,0.24)',
    'padding:24px',
    'width:min(820px,96vw)',
    'max-height:min(82vh,760px)',
    'display:flex',
    'flex-direction:column',
    'box-sizing:border-box',
    'font-size:14px',
    'font-family:Segoe UI,system-ui,sans-serif'
  ].join(';')

  const title = document.createElement('div')
  title.style.cssText = 'font:700 18px/1.3 Segoe UI,system-ui,sans-serif;color:#0f172a;margin-bottom:6px;'
  title.textContent = 'Review import'

  const subtitle = document.createElement('p')
  subtitle.style.cssText = 'margin:0 0 18px;font:500 13px/1.5 Segoe UI,system-ui,sans-serif;color:#64748b;'
  subtitle.textContent =
    successfulExports.length > 0
      ? 'Some views reference workspace fields that are not available here. Select a view for details. You can continue with only the views that passed validation, or close to cancel.'
      : 'Every view in this file references at least one column field that is not defined in this workspace. Select a view for details, or close to cancel.'

  const body = document.createElement('div')
  body.style.cssText = [
    'display:flex',
    'flex:1',
    'min-height:260px',
    'max-height:min(52vh,480px)',
    'border:1px solid #e2e8f0',
    'border-radius:10px',
    'overflow:hidden',
    'margin-bottom:18px'
  ].join(';')

  const leftPane = document.createElement('div')
  leftPane.style.cssText = [
    'width:min(260px,34vw)',
    'flex-shrink:0',
    'border-right:1px solid #e2e8f0',
    'background:#f8fafc',
    'overflow-y:auto',
    'display:flex',
    'flex-direction:column'
  ].join(';')

  const rightPane = document.createElement('div')
  rightPane.style.cssText = [
    'flex:1',
    'min-width:0',
    'display:flex',
    'flex-direction:column',
    'padding:16px 18px',
    'background:#fff',
    'overflow:hidden'
  ].join(';')

  const rightHeading = document.createElement('div')
  rightHeading.style.cssText = 'font:600 13px/1.4 Segoe UI,system-ui,sans-serif;color:#0f172a;margin-bottom:12px;'

  const rightBody = document.createElement('div')
  rightBody.style.cssText = 'flex:1;min-height:0;display:flex;flex-direction:column;position:relative;'

  const emptyState = document.createElement('div')
  emptyState.style.cssText = [
    'display:none',
    'flex:1',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'text-align:center',
    'gap:16px',
    'padding:24px 16px',
    'border:1px solid #e2e8f0',
    'border-radius:8px',
    'background:#fafafa'
  ].join(';')
  const emptyTick = document.createElement('div')
  emptyTick.setAttribute('aria-hidden', 'true')
  emptyTick.textContent = '✓'
  emptyTick.style.cssText = [
    'font-size:56px',
    'line-height:1',
    'color:#16a34a',
    'font-weight:700',
    'font-family:Segoe UI,system-ui,sans-serif',
    'user-select:none'
  ].join(';')
  const emptySub = document.createElement('div')
  emptySub.style.cssText =
    'font:500 13px/1.5 Segoe UI,system-ui,sans-serif;color:#64748b;max-width:300px;'
  emptySub.textContent = 'This view is ready to import if you continue with the validated views.'
  emptyState.appendChild(emptyTick)
  emptyState.appendChild(emptySub)

  const tableWrap = document.createElement('div')
  tableWrap.style.cssText = 'flex:1;overflow:auto;border:1px solid #e2e8f0;border-radius:8px;display:none;'

  const table = document.createElement('table')
  table.style.cssText = 'width:100%;border-collapse:collapse;font:13px/1.45 Segoe UI,system-ui,sans-serif;'
  table.setAttribute('role', 'grid')

  const thead = document.createElement('thead')
  thead.innerHTML = `<tr style="background:#f1f5f9;">
    <th scope="col" style="text-align:left;padding:10px 12px;font:600 11px/1.3 Segoe UI,system-ui,sans-serif;color:#475569;border-bottom:1px solid #e2e8f0;">Issue</th>
  </tr>`
  const tbody = document.createElement('tbody')

  let selectedIdx = 0

  function applyListSelection(): void {
    const children = leftPane.children
    for (let i = 0; i < children.length; i++) {
      const row = children[i] as HTMLElement
      const on = i === selectedIdx
      row.style.background = on ? '#eff6ff' : 'transparent'
      row.style.borderLeft = on ? '3px solid #2563eb' : '3px solid transparent'
      row.setAttribute('aria-selected', on ? 'true' : 'false')
    }
  }

  function renderRight(row: ImportViewValidationRow): void {
    const multi = totalViewCount > 1
    rightHeading.textContent = multi
      ? `${row.name} · View ${row.index + 1} of ${totalViewCount}`
      : row.name
    if (row.issues.length === 0) {
      tableWrap.style.display = 'none'
      emptyState.style.display = 'flex'
      tbody.innerHTML = ''
    } else {
      emptyState.style.display = 'none'
      tableWrap.style.display = 'block'
      tbody.innerHTML = ''
      for (const issue of row.issues) {
        const tr = document.createElement('tr')
        tr.style.cssText = 'border-bottom:1px solid #f1f5f9;'
        const td = document.createElement('td')
        td.style.cssText =
          'padding:10px 12px;color:#0f172a;vertical-align:top;width:100%;word-break:break-word;line-height:1.5;'
        td.textContent = issue.detail
        tr.appendChild(td)
        tbody.appendChild(tr)
      }
    }
  }

  function selectView(i: number): void {
    selectedIdx = i
    applyListSelection()
    renderRight(rows[i])
  }

  for (let i = 0; i < rows.length; i++) {
    const v = rows[i]
    const row = document.createElement('button')
    row.type = 'button'
    row.style.cssText = [
      'display:block',
      'width:100%',
      'text-align:left',
      'padding:12px 14px',
      'border:none',
      'border-bottom:1px solid #e2e8f0',
      'background:transparent',
      'cursor:pointer',
      'font:inherit',
      'color:#0f172a'
    ].join(';')
    row.setAttribute('role', 'option')
    const nameLine = document.createElement('div')
    nameLine.style.cssText = 'font:600 13px/1.35 Segoe UI,system-ui,sans-serif;'
    nameLine.textContent = v.name
    row.appendChild(nameLine)
    if (totalViewCount > 1) {
      const meta = document.createElement('div')
      meta.style.cssText = 'font:500 11px/1.4 Segoe UI,system-ui,sans-serif;color:#64748b;margin-top:4px;'
      meta.textContent = `View ${v.index + 1} of ${totalViewCount}`
      row.appendChild(meta)
    }
    const statusLine = document.createElement('div')
    statusLine.style.cssText = 'font:500 11px/1.4 Segoe UI,system-ui,sans-serif;margin-top:6px;'
    if (v.issues.length === 0) {
      statusLine.style.color = '#166534'
      statusLine.textContent = 'No errors'
    } else {
      statusLine.style.color = '#9f1239'
      statusLine.textContent = v.issues.length === 1 ? '1 issue' : `${v.issues.length} issues`
    }
    row.appendChild(statusLine)
    row.addEventListener('click', () => selectView(i))
    row.addEventListener('mouseenter', () => {
      if (i !== selectedIdx) row.style.background = '#f1f5f9'
    })
    row.addEventListener('mouseleave', () => {
      applyListSelection()
    })
    leftPane.appendChild(row)
  }

  leftPane.setAttribute('role', 'listbox')
  leftPane.setAttribute('aria-label', 'Imported views')

  table.appendChild(thead)
  table.appendChild(tbody)
  tableWrap.appendChild(table)
  rightBody.appendChild(emptyState)
  rightBody.appendChild(tableWrap)
  rightPane.appendChild(rightHeading)
  rightPane.appendChild(rightBody)

  body.appendChild(leftPane)
  body.appendChild(rightPane)

  const footer = document.createElement('div')
  footer.style.cssText = 'display:flex;justify-content:flex-end;align-items:center;gap:10px;flex-wrap:wrap;'

  const successfulCount = successfulExports.length
  if (successfulCount > 0) {
    const continueBtn = createButton(`Continue with ${viewCountPhrase(successfulCount)}`, true)
    continueBtn.addEventListener('click', onContinueWithSuccessful)
    footer.appendChild(continueBtn)
  }

  const closeBtn = createButton('Close', successfulCount > 0 ? false : true)
  closeBtn.addEventListener('click', onClose)
  footer.appendChild(closeBtn)

  box.appendChild(title)
  box.appendChild(subtitle)
  box.appendChild(body)
  box.appendChild(footer)
  overlay.appendChild(box)

  const firstFailedIdx = rows.findIndex((r) => r.issues.length > 0)
  selectView(firstFailedIdx >= 0 ? firstFailedIdx : 0)
  return overlay
}

type RowState = 'new' | 'overwrite'

function makePill(state: RowState): HTMLElement {
  const pill = document.createElement('span')
  applyPillStyle(pill, state)
  return pill
}

function applyPillStyle(pill: HTMLElement, state: RowState): void {
  pill.textContent = state === 'new' ? 'New' : 'Overwrite'
  pill.style.cssText = [
    'display:inline-block',
    'padding:2px 10px',
    'border-radius:999px',
    'font:600 11px/1.6 Segoe UI,Arial,sans-serif',
    'white-space:nowrap',
    state === 'new'
      ? 'background:#dcfce7;color:#166534;'
      : 'background:#fef3c7;color:#92400e;'
  ].join(';')
}

// ---------------------------------------------------------------------------
// Main import dialog
// ---------------------------------------------------------------------------

function buildImportDialog(options: {
  validated: TableauExport[]
  existingTitles: Set<string>
  existingMap: Map<string, string>
  wsId: string
  api: TableausApi
  onClose: () => void
}): HTMLElement {
  const { validated, existingTitles, existingMap, wsId, api, onClose } = options

  const overlay = createOverlay()
  const box = createDialogBox()

  // Header
  const titleEl = document.createElement('h3')
  titleEl.style.cssText = 'margin:0 0 4px;font:700 18px/1.3 Segoe UI,Arial,sans-serif;color:#0f172a;flex-shrink:0;'
  titleEl.textContent = 'Import Views'

  const subtitle = document.createElement('p')
  subtitle.style.cssText = 'margin:0 0 14px;font:500 12px/1.4 Segoe UI,Arial,sans-serif;color:#64748b;flex-shrink:0;'
  subtitle.textContent = `${validated.length} view${validated.length !== 1 ? 's' : ''} ready to import. Review and save.`

  // Table
  const tableWrap = document.createElement('div')
  tableWrap.style.cssText = 'flex:1;overflow-y:auto;margin-bottom:14px;border:1px solid #e2e8f0;border-radius:8px;'

  const table = document.createElement('table')
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;'

  const thead = document.createElement('thead')
  thead.innerHTML = `<tr style="background:#f8fafc;">
    <th style="text-align:left;padding:8px 12px;font:600 11px/1.3 Segoe UI,Arial,sans-serif;color:#64748b;border-bottom:1px solid #e2e8f0;">View Name</th>
    <th style="text-align:center;padding:8px 12px;font:600 11px/1.3 Segoe UI,Arial,sans-serif;color:#64748b;border-bottom:1px solid #e2e8f0;white-space:nowrap;">Status</th>
    <th style="text-align:center;padding:8px 12px;font:600 11px/1.3 Segoe UI,Arial,sans-serif;color:#64748b;border-bottom:1px solid #e2e8f0;">Actions</th>
    <th style="text-align:center;padding:8px 12px;font:600 11px/1.3 Segoe UI,Arial,sans-serif;color:#64748b;border-bottom:1px solid #e2e8f0;width:40px;">Result</th>
  </tr>`

  const tbody = document.createElement('tbody')

  // Per-row state
  type RowEntry = {
    data: TableauExport
    currentName: string
    state: RowState
    matchedId: string | null
    pill: HTMLElement
    renameBtn: HTMLButtonElement
    statusRow: HTMLTableRowElement
    resultCell: HTMLTableCellElement
  }

  const rows: RowEntry[] = []
  const usedNames = new Set<string>()

  function computeState(name: string): { state: RowState; matchedId: string | null } {
    const key = name.trim().toLowerCase()
    if (existingTitles.has(key)) {
      return { state: 'overwrite', matchedId: existingMap.get(key) ?? null }
    }
    return { state: 'new', matchedId: null }
  }

  for (let i = 0; i < validated.length; i++) {
    const item = validated[i]

    // Auto-resolve initial name to avoid intra-batch collisions only.
    // Server-side name matching is handled by computeState (overwrite vs new).
    const initialName = resolveUniqueName(item.name, new Set<string>(), usedNames)
    usedNames.add(initialName.toLowerCase())

    const { state: initialState, matchedId: initialMatchedId } = computeState(initialName)

    const tr = document.createElement('tr')
    tr.style.cssText = i % 2 === 0 ? 'background:#fff;' : 'background:#f8fafc;'

    // Name cell
    const nameCell = document.createElement('td')
    nameCell.style.cssText = 'padding:10px 12px;color:#0f172a;font-weight:600;'
    nameCell.textContent = initialName

    // Status cell
    const statusCell = document.createElement('td')
    statusCell.style.cssText = 'padding:10px 12px;text-align:center;'
    const pill = makePill(initialState)
    statusCell.appendChild(pill)

    // Actions cell
    const actionsCell = document.createElement('td')
    actionsCell.style.cssText = 'padding:10px 12px;text-align:center;'
    const renameBtn = document.createElement('button')
    renameBtn.type = 'button'
    renameBtn.textContent = 'Rename'
    renameBtn.style.cssText = 'border:1px solid #cbd5e1;background:#fff;color:#334155;padding:4px 10px;border-radius:6px;cursor:pointer;font:600 11px/1.3 Segoe UI,Arial,sans-serif;'
    actionsCell.appendChild(renameBtn)

    // Result cell (tick/cross shown after save)
    const resultCell = document.createElement('td')
    resultCell.style.cssText = 'padding:10px 12px;text-align:center;font-size:16px;'

    tr.appendChild(nameCell)
    tr.appendChild(statusCell)
    tr.appendChild(actionsCell)
    tr.appendChild(resultCell)

    // Inline rename row
    const statusRow = document.createElement('tr')
    statusRow.style.display = 'none'
    const statusRowCell = document.createElement('td')
    statusRowCell.colSpan = 4
    statusRowCell.style.cssText = 'padding:0 12px 10px;'
    statusRow.appendChild(statusRowCell)

    const entry: RowEntry = {
      data: item,
      currentName: initialName,
      state: initialState,
      matchedId: initialMatchedId,
      pill,
      renameBtn,
      statusRow,
      resultCell
    }
    rows.push(entry)

    renameBtn.addEventListener('click', () => {
      statusRow.style.display = ''
      statusRowCell.innerHTML = ''

      const inputWrap = document.createElement('div')
      inputWrap.style.cssText = 'display:flex;gap:6px;align-items:center;'

      const input = document.createElement('input')
      input.type = 'text'
      input.value = entry.currentName
      input.style.cssText = [
        'flex:1',
        'padding:6px 8px',
        'border:1px solid #cbd5e1',
        'border-radius:6px',
        'font-size:13px',
        'color:#0f172a',
        'outline:none'
      ].join(';')
      input.addEventListener('focus', () => { input.style.borderColor = '#2563eb' })
      input.addEventListener('blur', () => { input.style.borderColor = '#cbd5e1' })

      const confirmBtn = document.createElement('button')
      confirmBtn.type = 'button'
      confirmBtn.textContent = 'Confirm'
      confirmBtn.style.cssText = 'border:none;background:#2563eb;color:#fff;padding:6px 12px;border-radius:6px;cursor:pointer;font:600 11px/1.3 Segoe UI,Arial,sans-serif;white-space:nowrap;'

      const renameCancelBtn = document.createElement('button')
      renameCancelBtn.type = 'button'
      renameCancelBtn.textContent = 'Cancel'
      renameCancelBtn.style.cssText = 'border:1px solid #cbd5e1;background:#fff;color:#334155;padding:6px 10px;border-radius:6px;cursor:pointer;font:600 11px/1.3 Segoe UI,Arial,sans-serif;white-space:nowrap;'

      const validationMsg = document.createElement('span')
      validationMsg.style.cssText = 'font-size:11px;color:#9f1239;white-space:nowrap;'

      function closeRename(): void {
        statusRow.style.display = 'none'
        statusRowCell.innerHTML = ''
      }

      function validateRenameInput(): boolean {
        const newName = input.value.trim()
        if (!newName) {
          validationMsg.textContent = 'Name cannot be empty.'
          input.style.borderColor = '#9f1239'
          return false
        }
        const key = newName.toLowerCase()
        const otherUsed = new Set(usedNames)
        otherUsed.delete(entry.currentName.toLowerCase())
        if (otherUsed.has(key)) {
          validationMsg.textContent = 'This name is already used by another view in this import.'
          input.style.borderColor = '#9f1239'
          return false
        }
        validationMsg.textContent = ''
        input.style.borderColor = '#2563eb'
        return true
      }

      function applyRename(): void {
        if (!validateRenameInput()) return
        const newName = input.value.trim()
        usedNames.delete(entry.currentName.toLowerCase())
        entry.currentName = newName
        usedNames.add(newName.toLowerCase())
        nameCell.textContent = newName
        const { state, matchedId } = computeState(newName)
        entry.state = state
        entry.matchedId = matchedId
        applyPillStyle(pill, state)
        closeRename()
      }

      input.addEventListener('input', () => { if (validationMsg.textContent) validateRenameInput() })
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') applyRename()
        if (e.key === 'Escape') closeRename()
      })
      confirmBtn.addEventListener('click', applyRename)
      renameCancelBtn.addEventListener('click', closeRename)

      inputWrap.appendChild(input)
      inputWrap.appendChild(confirmBtn)
      inputWrap.appendChild(renameCancelBtn)
      inputWrap.appendChild(validationMsg)
      statusRowCell.appendChild(inputWrap)
      input.focus()
      input.select()
    })

    tbody.appendChild(tr)
    tbody.appendChild(statusRow)
  }

  table.appendChild(thead)
  table.appendChild(tbody)
  tableWrap.appendChild(table)

  // Progress bar (hidden until save)
  const progressWrap = document.createElement('div')
  progressWrap.style.cssText = 'display:none;margin-bottom:12px;flex-shrink:0;'

  const progressLabel = document.createElement('div')
  progressLabel.style.cssText = 'font:500 12px/1.4 Segoe UI,Arial,sans-serif;color:#64748b;margin-bottom:4px;'

  const progressTrack = document.createElement('div')
  progressTrack.style.cssText = 'height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;'

  const progressFill = document.createElement('div')
  progressFill.style.cssText = 'height:100%;width:0%;background:#2563eb;border-radius:999px;transition:width 0.2s ease;'

  progressTrack.appendChild(progressFill)
  progressWrap.appendChild(progressLabel)
  progressWrap.appendChild(progressTrack)

  // Actions row
  const actionsRow = document.createElement('div')
  actionsRow.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;flex-shrink:0;'

  const cancelBtn = createButton('Cancel', false)
  const saveBtn = createButton('Save', true)

  actionsRow.appendChild(cancelBtn)
  actionsRow.appendChild(saveBtn)

  box.appendChild(titleEl)
  box.appendChild(subtitle)
  box.appendChild(tableWrap)
  box.appendChild(progressWrap)
  box.appendChild(actionsRow)
  overlay.appendChild(box)

  let saveCompleted = false

  function handleClose(): void {
    onClose()
    if (saveCompleted) window.location.reload()
  }

  cancelBtn.addEventListener('click', handleClose)

  saveBtn.addEventListener('click', () => {
    saveBtn.disabled = true
    cancelBtn.disabled = true
    progressWrap.style.display = 'block'

    // Disable all rename buttons and close any open rename panels immediately
    for (const entry of rows) {
      entry.renameBtn.disabled = true
      entry.renameBtn.style.opacity = '0.4'
      entry.renameBtn.style.cursor = 'not-allowed'
      entry.statusRow.style.display = 'none'
    }

    void (async () => {
      let done = 0
      const total = rows.length

      function updateProgress(): void {
        const pct = total > 0 ? Math.round((done / total) * 100) : 0
        progressFill.style.width = `${pct}%`
        progressLabel.textContent = `Saving ${done} of ${total}\u2026`
      }

      updateProgress()

      let succeeded = 0
      let failed = 0

      for (const entry of rows) {
        const { data, currentName, state, resultCell } = entry

        try {
          const { __self__, urn, createdDate: _cd, modifiedDate, owner, ...rest } = data
          // Re-resolve matchedId at save time in case map was populated after row creation
          const resolvedMatchedId = existingMap.get(currentName.trim().toLowerCase()) ?? null

          if (state === 'overwrite' && resolvedMatchedId) {
            // PUT does not need workspace or createdDate
            const { workspace: _ws, ...restForUpdate } = rest
            await api.updateTableau(wsId, resolvedMatchedId, stripDefaults({ ...restForUpdate, name: currentName }))
          } else {
            // POST requires workspace and a fresh createdDate
            await api.createTableau(wsId, stripDefaults({ ...rest, name: currentName, createdDate: new Date().toISOString() }))
          }

          resultCell.textContent = '✓'
          resultCell.style.color = '#166534'
          succeeded++
        } catch (err) {
          resultCell.textContent = '✕'
          resultCell.style.color = '#9f1239'
          resultCell.style.cursor = 'help'
          resultCell.title = err instanceof Error ? err.message : 'Unknown error'
          failed++
        }

        done++
        updateProgress()
      }

      if (failed > 0) {
        progressFill.style.background = failed === total ? '#9f1239' : '#d97706'
        progressLabel.textContent = `${succeeded} saved, ${failed} failed`
      } else {
        progressFill.style.background = '#166534'
        progressLabel.textContent = `All ${succeeded} view${succeeded !== 1 ? 's' : ''} saved successfully`
      }
      saveCompleted = true
      saveBtn.disabled = true
      saveBtn.style.opacity = '0.4'
      saveBtn.style.cursor = 'not-allowed'
      cancelBtn.disabled = false
      cancelBtn.textContent = 'Close'
    })()
  })

  return overlay
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

export async function runImportFlow(options: ImportFlowOptions): Promise<ImportDialog> {
  const { text, wsId, api } = options

  let overlay: HTMLElement | null = null

  function remove(): void {
    overlay?.remove()
    overlay = null
  }

  function showOverlay(el: HTMLElement): void {
    remove()
    overlay = el
    document.body.appendChild(overlay)
  }

  let parsed: unknown
  try {
    if (COMPRESS_EXPORT) {
      const encoded = JSON.parse(text.trim()) as string
      parsed = await decompressFromBase64(encoded)
    } else {
      parsed = JSON.parse(text)
    }
    // Restore portable placeholders with the target tenant and workspace ID
    const tenant = extractTenant(window.location.href) ?? ''
    parsed = JSON.parse(
      JSON.stringify(parsed)
        .replaceAll('/workspaces/{WS_ID}/', `/workspaces/${wsId}/`)
        .replaceAll(':{TENANT}.{WS_ID}.', `:${tenant}.${wsId}.`)
    )
  } catch {
    showOverlay(buildErrorDialog('Invalid file: could not parse view data.', remove))
    return { remove }
  }

  const items = Array.isArray(parsed) ? parsed : [parsed]

  const validated: TableauExport[] = []
  for (let i = 0; i < items.length; i++) {
    try {
      validated.push(parseTableauExport(items[i]))
    } catch (err) {
      const message = err instanceof ValidationError ? err.message : 'Invalid file format.'
      const label = items.length > 1 ? `View ${i + 1} of ${items.length}: ${message}` : message
      showOverlay(buildErrorDialog(label, remove))
      return { remove }
    }
  }

  let existingTitles: Set<string>
  let existingMap: Map<string, string>
  try {
    const [response, metaResponse] = await Promise.all([
      api.fetchTableauList(wsId),
      api.fetchTableauListMeta(wsId)
    ])
    const metaFieldIds = buildAllowedFieldIdSetFromTableauMeta(metaResponse)
    const validationRows: ImportViewValidationRow[] = validated.map((item, index) => ({
      index,
      name: item.name,
      issues: collectTableauFieldImportIssues(item, metaFieldIds)
    }))
    const successfulExports = validated.filter(
      (_, i) => validationRows[i].issues.length === 0
    )
    const hasFieldValidationFailures = validationRows.some((r) => r.issues.length > 0)

    const tableaus = (response?.tableaus ?? []).filter((t) => !t.deleted)
    const getLabel = (t: { title: string; [key: string]: unknown }): string =>
      (t.title ?? (t as Record<string, unknown>).name ?? '') as string
    existingTitles = new Set(
      tableaus.map((t) => getLabel(t).trim().toLowerCase()).filter(Boolean)
    )
    existingMap = new Map(
      tableaus
        .map((t) => {
          const id = api.getTableauIdFromSelf(t.link)
          const key = getLabel(t).trim().toLowerCase()
          return id && key ? ([key, id] as [string, string]) : null
        })
        .filter((e): e is [string, string] => e !== null)
    )

    if (hasFieldValidationFailures) {
      showOverlay(
        buildFieldValidationSummaryDialog({
          rows: validationRows,
          totalViewCount: validated.length,
          successfulExports,
          onClose: remove,
          onContinueWithSuccessful: () => {
            remove()
            if (successfulExports.length === 0) return
            showOverlay(
              buildImportDialog({
                validated: successfulExports,
                existingTitles,
                existingMap,
                wsId,
                api,
                onClose: remove
              })
            )
          }
        })
      )
      return { remove }
    }
  } catch {
    showOverlay(
      buildErrorDialog('Failed to load workspace data. Please refresh the page and try again.', remove)
    )
    return { remove }
  }

  showOverlay(buildImportDialog({ validated, existingTitles, existingMap, wsId, api, onClose: remove }))

  return { remove }
}
