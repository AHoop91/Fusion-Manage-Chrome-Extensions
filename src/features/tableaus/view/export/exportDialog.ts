import { compressToBase64, downloadJson } from '../../../../shared/utils/export'
import type { TableausApi } from '../../services/tableaus.api'
import { extractTenant } from '../../services/tableaus.service'
import { COMPRESS_EXPORT } from '../../tableaus.constants'

type ExportDialogOptions = {
  wsId: string
  activeTableauId: string | null
  api: TableausApi
  onClose: () => void
}

type ExportDialog = {
  remove: () => void
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9\-_ ]/gi, '_').trim() || 'tableau'
}

export async function createExportDialog(options: ExportDialogOptions): Promise<ExportDialog> {
  const { wsId, activeTableauId, api, onClose } = options

  const overlay = document.createElement('div')
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'background:rgba(15,23,42,0.45)',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'z-index:2147483647'
  ].join(';')

  const panel = document.createElement('div')
  panel.style.cssText = [
    'width:min(520px,92vw)',
    'max-height:min(70vh,680px)',
    'display:flex',
    'flex-direction:column',
    'background:#ffffff',
    'border:1px solid #d8dee9',
    'border-radius:12px',
    'box-shadow:0 22px 40px rgba(16,24,40,0.24)',
    'padding:16px',
    'box-sizing:border-box',
    'overflow:hidden'
  ].join(';')

  // Header
  const title = document.createElement('h3')
  title.style.cssText = 'margin:0 0 4px;font:700 18px/1.3 Segoe UI,Arial,sans-serif;color:#0f172a'
  title.textContent = 'Export Views'

  const subtitle = document.createElement('p')
  subtitle.style.cssText = 'margin:0 0 14px;font:500 12px/1.4 Segoe UI,Arial,sans-serif;color:#64748b'
  subtitle.textContent = 'Select one or more views to download as a single JSON file.'

  // List area (scrollable)
  const listContainer = document.createElement('div')
  listContainer.style.cssText = [
    'flex:1',
    'overflow-y:auto',
    'display:flex',
    'flex-direction:column',
    'gap:6px',
    'margin-bottom:14px'
  ].join(';')

  // Select All row (above list)
  const selectAllRow = document.createElement('div')
  selectAllRow.style.cssText = 'display:flex;justify-content:flex-end;margin-bottom:8px;flex-shrink:0'

  function makeBtn(label: string, primary: boolean): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.textContent = label
    btn.style.cssText = [
      'border-radius:8px',
      'padding:8px 14px',
      'cursor:pointer',
      'font:600 12px/1 Segoe UI,Arial,sans-serif',
      primary
        ? 'border:none;background:#2563eb;color:#fff'
        : 'border:1px solid #cbd5e1;background:#fff;color:#334155'
    ].join(';')
    return btn
  }

  const selectAllBtn = makeBtn('Select All', false)
  selectAllRow.appendChild(selectAllBtn)

  // Actions row
  const actions = document.createElement('div')
  actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;flex-shrink:0'

  const cancelBtn = makeBtn('Cancel', false)
  const exportBtn = makeBtn('Export Selected', true)
  exportBtn.disabled = true
  exportBtn.style.opacity = '0.4'
  exportBtn.style.cursor = 'not-allowed'

  actions.appendChild(cancelBtn)
  actions.appendChild(exportBtn)

  // Progress bar (hidden until export starts)
  const progressWrap = document.createElement('div')
  progressWrap.style.cssText = 'display:none;flex-shrink:0;margin-bottom:10px;'

  const progressLabel = document.createElement('div')
  progressLabel.style.cssText = 'font:500 12px/1.4 Segoe UI,Arial,sans-serif;color:#64748b;margin-bottom:4px;'

  const progressTrack = document.createElement('div')
  progressTrack.style.cssText = 'height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;'

  const progressFill = document.createElement('div')
  progressFill.style.cssText = 'height:100%;width:0%;background:#2563eb;border-radius:999px;transition:width 0.2s ease;'

  progressTrack.appendChild(progressFill)
  progressWrap.appendChild(progressLabel)
  progressWrap.appendChild(progressTrack)

  panel.appendChild(title)
  panel.appendChild(subtitle)
  panel.appendChild(selectAllRow)
  panel.appendChild(listContainer)
  panel.appendChild(progressWrap)
  panel.appendChild(actions)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  function remove(): void {
    overlay.remove()
    onClose()
  }

  cancelBtn.addEventListener('click', remove)

  // Track selected IDs and checkboxes for Select All
  const selectedIds = new Set<string>()
  const checkboxes: Array<{ id: string; checkbox: HTMLInputElement; row: HTMLElement }> = []
  let tableauMeta: Array<{ id: string; title: string }> = []

  function updateExportButton(): void {
    const hasSelection = selectedIds.size > 0
    exportBtn.disabled = !hasSelection
    exportBtn.style.opacity = hasSelection ? '1' : '0.4'
    exportBtn.style.cursor = hasSelection ? 'pointer' : 'not-allowed'
    exportBtn.textContent =
      selectedIds.size > 1 ? `Export Selected (${selectedIds.size})` : 'Export Selected'
  }

  function updateSelectAllButton(): void {
    const allSelected = checkboxes.length > 0 && checkboxes.every((c) => c.checkbox.checked)
    selectAllBtn.textContent = allSelected ? 'Deselect All' : 'Select All'
  }

  function setRowSelected(entry: { id: string; checkbox: HTMLInputElement; row: HTMLElement }, checked: boolean): void {
    entry.checkbox.checked = checked
    if (checked) {
      selectedIds.add(entry.id)
      entry.row.style.borderColor = '#2563eb'
      entry.row.style.background = '#eff6ff'
    } else {
      selectedIds.delete(entry.id)
      entry.row.style.borderColor = '#dbe2ee'
      entry.row.style.background = '#f8fafc'
    }
  }

  selectAllBtn.addEventListener('click', () => {
    const allSelected = checkboxes.every((c) => c.checkbox.checked)
    for (const entry of checkboxes) {
      setRowSelected(entry, !allSelected)
    }
    updateExportButton()
    updateSelectAllButton()
  })

  // Load list
  const loadingMsg = document.createElement('div')
  loadingMsg.style.cssText = 'padding:8px 4px;color:#64748b;font-size:13px'
  loadingMsg.textContent = 'Loading views\u2026'
  listContainer.appendChild(loadingMsg)

  try {
    const response = await api.fetchTableauList(wsId)
    const tableaus = (response?.tableaus ?? []).filter((t) => !t.deleted)

    listContainer.innerHTML = ''

    if (tableaus.length === 0) {
      const empty = document.createElement('div')
      empty.style.cssText = 'padding:8px 4px;color:#9f1239;font-size:13px'
      empty.textContent = 'No views found for this workspace.'
      listContainer.appendChild(empty)
      selectAllBtn.disabled = true
      selectAllBtn.style.opacity = '0.4'
    } else {
      tableauMeta = tableaus
        .map((t) => ({ id: api.getTableauIdFromSelf(t.link) ?? '', title: t.title }))
        .filter((t) => t.id !== '')

      for (const { id, title } of tableauMeta) {
        const isActive = id === activeTableauId

        const row = document.createElement('label')
        row.style.cssText = [
          'display:flex',
          'align-items:center',
          'justify-content:space-between',
          'gap:12px',
          'padding:9px 12px',
          'border:1px solid #dbe2ee',
          'border-radius:10px',
          'background:#f8fafc',
          'color:#1e293b',
          'cursor:pointer'
        ].join(';')

        const labelWrap = document.createElement('span')
        labelWrap.style.cssText = 'display:flex;align-items:center;gap:8px;min-width:0'

        const nameSpan = document.createElement('span')
        nameSpan.style.cssText = 'font-size:13px;font-weight:600;color:#0f172a'
        nameSpan.textContent = title

        labelWrap.appendChild(nameSpan)

        if (isActive) {
          const badge = document.createElement('span')
          badge.style.cssText =
            'font:600 11px/1.3 Segoe UI,Arial,sans-serif;color:#166534;white-space:nowrap'
          badge.textContent = '(Active)'
          labelWrap.appendChild(badge)
        }

        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.style.cssText = 'width:18px;height:18px;accent-color:#2563eb;cursor:pointer;flex-shrink:0'

        const entry = { id, checkbox, row }
        checkboxes.push(entry)

        checkbox.addEventListener('change', () => {
          setRowSelected(entry, checkbox.checked)
          updateExportButton()
          updateSelectAllButton()
        })

        row.appendChild(labelWrap)
        row.appendChild(checkbox)
        listContainer.appendChild(row)
      }
    }
  } catch {
    listContainer.innerHTML = ''
    const errMsg = document.createElement('div')
    errMsg.style.cssText = 'padding:8px 4px;color:#9f1239;font-size:13px'
    errMsg.textContent = 'Failed to load views. Please refresh the page and try again.'
    listContainer.appendChild(errMsg)
    selectAllBtn.disabled = true
    selectAllBtn.style.opacity = '0.4'
  }

  exportBtn.addEventListener('click', () => {
    if (selectedIds.size === 0) return
    exportBtn.disabled = true
    cancelBtn.disabled = true
    selectAllBtn.disabled = true
    exportBtn.textContent = 'Exporting\u2026'

    void (async () => {
      const selected = tableauMeta.filter((t) => selectedIds.has(t.id))
      const results: Array<{ title: string; data: unknown }> = []
      const failed: string[] = []
      const total = selected.length
      let done = 0

      progressWrap.style.display = 'block'
      progressLabel.textContent = `Fetching 0 of ${total}\u2026`
      progressFill.style.width = '0%'

      const CONCURRENCY = 5
      for (let i = 0; i < selected.length; i += CONCURRENCY) {
        const batch = selected.slice(i, i + CONCURRENCY)
        const settled = await Promise.allSettled(
          batch.map(({ id }) => api.fetchTableau(wsId, id) as Promise<Record<string, unknown>>)
        )
        for (let j = 0; j < settled.length; j++) {
          const outcome = settled[j]!
          const { title } = batch[j]!
          done++
          progressFill.style.width = `${Math.round((done / total) * 100)}%`
          progressLabel.textContent = done < total ? `Fetching ${done} of ${total}\u2026` : `Preparing download\u2026`
          if (outcome.status === 'fulfilled') {
            const { owner: _o, ...stripped } = outcome.value
            const tenant = extractTenant(window.location.href) ?? ''
            // Replace tenant and workspace ID with portable placeholders for cross-tenant compatibility
            const data = JSON.parse(
              JSON.stringify(stripped)
                .replaceAll(`/workspaces/${wsId}/`, '/workspaces/{WS_ID}/')
                .replaceAll(`:${tenant}.${wsId}.`, ':{TENANT}.{WS_ID}.')
            ) as unknown
            results.push({ title, data })
          } else {
            failed.push(title)
          }
        }
      }

      if (results.length > 0) {
        const payload = results.length === 1 ? results[0]!.data : results.map((r) => r.data)
        const baseName = results.length === 1 ? sanitizeFilename(results[0]!.title) : `tableaus-export-ws${wsId}`

        if (COMPRESS_EXPORT) {
          const encoded = await compressToBase64(payload)
          downloadJson(`${baseName}.plmview`, encoded)
        } else {
          downloadJson(`${baseName}.json`, payload)
        }
      }

      if (failed.length > 0) {
        exportBtn.disabled = false
        cancelBtn.disabled = false
        selectAllBtn.disabled = false
        exportBtn.textContent = `Retry failed (${failed.length})`
        exportBtn.style.opacity = '1'
        exportBtn.style.cursor = 'pointer'
        exportBtn.style.background = '#c00'
      } else {
        remove()
      }
    })()
  })

  return { remove }
}
