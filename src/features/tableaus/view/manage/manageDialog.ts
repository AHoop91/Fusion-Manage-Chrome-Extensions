import type { TableausApi } from '../../services/tableaus.api'

type ManageDialogOptions = {
  wsId: string
  api: TableausApi
  onClose: () => void
}

type ManageDialog = {
  remove: () => void
}

const TRASH_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;flex-shrink:0"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>'

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
      ? 'background:#dc2626;color:#fff;'
      : 'background:#fff;color:#334155;border:1px solid #cbd5e1;'
  ].join(';')
  return btn
}

export async function createManageDialog(options: ManageDialogOptions): Promise<ManageDialog> {
  const { wsId, api, onClose } = options

  const overlay = createOverlay()
  const box = createDialogBox()

  // Header
  const titleEl = document.createElement('h3')
  titleEl.style.cssText = 'margin:0 0 4px;font:700 18px/1.3 Segoe UI,Arial,sans-serif;color:#0f172a;flex-shrink:0;'
  titleEl.textContent = 'Manage Views'

  const subtitle = document.createElement('p')
  subtitle.style.cssText = 'margin:0 0 14px;font:500 12px/1.4 Segoe UI,Arial,sans-serif;color:#64748b;flex-shrink:0;'
  subtitle.textContent = 'Click Delete on each view to stage it for removal, then click the Delete button to confirm.'

  // Table
  const tableWrap = document.createElement('div')
  tableWrap.style.cssText = 'flex:1;overflow-y:auto;margin-bottom:14px;border:1px solid #e2e8f0;border-radius:8px;'

  const table = document.createElement('table')
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:13px;'

  const thead = document.createElement('thead')
  thead.innerHTML = `<tr style="background:#f8fafc;">
    <th style="text-align:left;padding:8px 12px;font:600 11px/1.3 Segoe UI,Arial,sans-serif;color:#64748b;border-bottom:1px solid #e2e8f0;">View Name</th>
    <th style="text-align:center;padding:8px 12px;font:600 11px/1.3 Segoe UI,Arial,sans-serif;color:#64748b;border-bottom:1px solid #e2e8f0;white-space:nowrap;width:100px;">Status</th>
    <th style="text-align:center;padding:8px 12px;font:600 11px/1.3 Segoe UI,Arial,sans-serif;color:#64748b;border-bottom:1px solid #e2e8f0;white-space:nowrap;">Actions</th>
    <th style="text-align:center;padding:8px 12px;font:600 11px/1.3 Segoe UI,Arial,sans-serif;color:#64748b;border-bottom:1px solid #e2e8f0;width:40px;">Result</th>
  </tr>`

  const tbody = document.createElement('tbody')

  // Loading state
  const loadingRow = document.createElement('tr')
  const loadingCell = document.createElement('td')
  loadingCell.colSpan = 4
  loadingCell.style.cssText = 'padding:16px 12px;color:#64748b;font-size:13px;text-align:center;'
  loadingCell.textContent = 'Loading views\u2026'
  loadingRow.appendChild(loadingCell)
  tbody.appendChild(loadingRow)

  table.appendChild(thead)
  table.appendChild(tbody)
  tableWrap.appendChild(table)

  // Progress bar
  const progressWrap = document.createElement('div')
  progressWrap.style.cssText = 'display:none;margin-bottom:12px;flex-shrink:0;'

  const progressLabel = document.createElement('div')
  progressLabel.style.cssText = 'font:500 12px/1.4 Segoe UI,Arial,sans-serif;color:#64748b;margin-bottom:4px;'

  const progressTrack = document.createElement('div')
  progressTrack.style.cssText = 'height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;'

  const progressFill = document.createElement('div')
  progressFill.style.cssText = 'height:100%;width:0%;background:#dc2626;border-radius:999px;transition:width 0.2s ease;'

  progressTrack.appendChild(progressFill)
  progressWrap.appendChild(progressLabel)
  progressWrap.appendChild(progressTrack)

  // Footer
  const footer = document.createElement('div')
  footer.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;flex-shrink:0;'

  const stagedCount = document.createElement('span')
  stagedCount.style.cssText = 'font:500 12px/1.4 Segoe UI,Arial,sans-serif;color:#64748b;'

  const footerBtns = document.createElement('div')
  footerBtns.style.cssText = 'display:flex;gap:8px;'

  const cancelBtn = createButton('Cancel', false)
  const deleteBtn = createButton('Delete', true)
  deleteBtn.disabled = true
  deleteBtn.style.opacity = '0.4'
  deleteBtn.style.cursor = 'not-allowed'

  footerBtns.appendChild(cancelBtn)
  footerBtns.appendChild(deleteBtn)
  footer.appendChild(stagedCount)
  footer.appendChild(footerBtns)

  box.appendChild(titleEl)
  box.appendChild(subtitle)
  box.appendChild(tableWrap)
  box.appendChild(progressWrap)
  box.appendChild(footer)
  overlay.appendChild(box)
  document.body.appendChild(overlay)

  let saveCompleted = false

  function remove(): void {
    overlay.remove()
    onClose()
    if (saveCompleted) window.location.reload()
  }

  cancelBtn.addEventListener('click', remove)

  // ---------------------------------------------------------------------------
  // Row state
  // ---------------------------------------------------------------------------

  type RowEntry = {
    id: string
    nameCell: HTMLTableCellElement
    pill: HTMLElement
    actionBtn: HTMLButtonElement
    resultCell: HTMLTableCellElement
    staged: boolean
  }

  const rows: RowEntry[] = []

  function updateFooter(): void {
    const count = rows.filter((r) => r.staged).length
    const allStaged = count >= rows.length && rows.length > 0
    const enabled = count > 0 && !allStaged
    stagedCount.textContent = allStaged
      ? 'At least one view must remain — unmark a view to continue.'
      : count > 0 ? `${count} view${count !== 1 ? 's' : ''} marked for deletion` : ''
    stagedCount.style.color = allStaged ? '#9f1239' : '#64748b'
    deleteBtn.disabled = !enabled
    deleteBtn.style.opacity = enabled ? '1' : '0.4'
    deleteBtn.style.cursor = enabled ? 'pointer' : 'not-allowed'
    deleteBtn.textContent = enabled ? `Delete (${count})` : 'Delete'
  }

  function setStaged(entry: RowEntry, staged: boolean): void {
    entry.staged = staged
    if (staged) {
      entry.pill.textContent = 'Delete'
      entry.pill.style.cssText = [
        'display:inline-block',
        'padding:2px 10px',
        'border-radius:999px',
        'font:600 11px/1.6 Segoe UI,Arial,sans-serif',
        'white-space:nowrap',
        'background:#fee2e2;color:#991b1b;'
      ].join(';')
      entry.actionBtn.textContent = 'Undo'
      entry.actionBtn.style.cssText = 'border:1px solid #fca5a5;background:#fff;color:#dc2626;padding:4px 10px;border-radius:6px;cursor:pointer;font:600 11px/1.3 Segoe UI,Arial,sans-serif;'
    } else {
      entry.pill.textContent = ''
      entry.pill.style.cssText = 'display:inline-block;min-width:60px;'
      entry.actionBtn.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;">${TRASH_ICON} Delete</span>`
      entry.actionBtn.style.cssText = 'border:1px solid #cbd5e1;background:#fff;color:#334155;padding:4px 10px;border-radius:6px;cursor:pointer;font:600 11px/1.3 Segoe UI,Arial,sans-serif;'
    }
    updateFooter()
  }

  // ---------------------------------------------------------------------------
  // Load views
  // ---------------------------------------------------------------------------

  try {
    const response = await api.fetchTableauList(wsId)
    const tableaus = (response?.tableaus ?? []).filter((t) => !t.deleted)

    tbody.innerHTML = ''

    if (tableaus.length === 0) {
      const emptyRow = document.createElement('tr')
      const emptyCell = document.createElement('td')
      emptyCell.colSpan = 4
      emptyCell.style.cssText = 'padding:16px 12px;color:#64748b;font-size:13px;text-align:center;'
      emptyCell.textContent = 'No views found for this workspace.'
      emptyRow.appendChild(emptyCell)
      tbody.appendChild(emptyRow)
    } else {
      tableaus.forEach((t, i) => {
        const id = api.getTableauIdFromSelf(t.link) ?? ''
        if (!id) return

        const tr = document.createElement('tr')
        tr.style.cssText = i % 2 === 0 ? 'background:#fff;' : 'background:#f8fafc;'

        const nameCell = document.createElement('td')
        nameCell.style.cssText = 'padding:10px 12px;color:#0f172a;font-weight:600;'
        nameCell.textContent = t.title ?? (t as Record<string, unknown>).name as string ?? ''

        const statusCell = document.createElement('td')
        statusCell.style.cssText = 'padding:10px 12px;text-align:center;'
        const pill = document.createElement('span')
        pill.style.cssText = 'display:inline-block;min-width:60px;'
        statusCell.appendChild(pill)

        const actionsCell = document.createElement('td')
        actionsCell.style.cssText = 'padding:10px 12px;text-align:center;'
        const actionBtn = document.createElement('button')
        actionBtn.type = 'button'
        actionsCell.appendChild(actionBtn)

        const resultCell = document.createElement('td')
        resultCell.style.cssText = 'padding:10px 12px;text-align:center;font-size:16px;'

        tr.appendChild(nameCell)
        tr.appendChild(statusCell)
        tr.appendChild(actionsCell)
        tr.appendChild(resultCell)
        tbody.appendChild(tr)

        const entry: RowEntry = { id, nameCell, pill, actionBtn, resultCell, staged: false }
        rows.push(entry)

        setStaged(entry, false)

        actionBtn.addEventListener('click', () => {
          setStaged(entry, !entry.staged)
        })
      })
    }
  } catch {
    tbody.innerHTML = ''
    const errRow = document.createElement('tr')
    const errCell = document.createElement('td')
    errCell.colSpan = 4
    errCell.style.cssText = 'padding:16px 12px;color:#9f1239;font-size:13px;text-align:center;'
    errCell.textContent = 'Failed to load views. Please refresh the page and try again.'
    errRow.appendChild(errCell)
    tbody.appendChild(errRow)
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  deleteBtn.addEventListener('click', () => {
    const staged = rows.filter((r) => r.staged)
    if (staged.length === 0) return

    deleteBtn.disabled = true
    deleteBtn.style.opacity = '0.4'
    deleteBtn.style.cursor = 'not-allowed'
    cancelBtn.disabled = true
    progressWrap.style.display = 'block'

    for (const entry of rows) {
      entry.actionBtn.disabled = true
      entry.actionBtn.style.opacity = '0.4'
      entry.actionBtn.style.cursor = 'not-allowed'
    }

    void (async () => {
      let done = 0
      let succeeded = 0
      let failed = 0
      const total = staged.length

      progressLabel.textContent = `Deleting 0 of ${total}\u2026`
      progressFill.style.width = '0%'

      for (const entry of staged) {
        try {
          await api.deleteTableau(wsId, entry.id)
          entry.resultCell.textContent = '✓'
          entry.resultCell.style.color = '#166534'
          entry.nameCell.style.textDecoration = 'line-through'
          entry.nameCell.style.color = '#94a3b8'
          succeeded++
        } catch (err) {
          entry.resultCell.textContent = '✕'
          entry.resultCell.style.color = '#9f1239'
          entry.resultCell.style.cursor = 'help'
          entry.resultCell.title = err instanceof Error ? err.message : 'Unknown error'
          failed++
        }

        done++
        progressFill.style.width = `${Math.round((done / total) * 100)}%`
        progressLabel.textContent = done < total ? `Deleting ${done} of ${total}\u2026` : ''
      }

      if (failed > 0) {
        progressFill.style.background = failed === total ? '#9f1239' : '#d97706'
        progressLabel.textContent = `${succeeded} deleted, ${failed} failed`
      } else {
        progressFill.style.background = '#166534'
        progressLabel.textContent = `All ${succeeded} view${succeeded !== 1 ? 's' : ''} deleted successfully`
      }

      saveCompleted = true
      cancelBtn.disabled = false
      cancelBtn.textContent = 'Close'
    })()
  })

  return { remove }
}
