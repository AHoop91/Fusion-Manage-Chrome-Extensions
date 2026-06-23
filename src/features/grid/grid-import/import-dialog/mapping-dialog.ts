import { createGenericLoaderElement } from '../../../shared/generic-loader'
import { createButton, IMPORT_UI_FONT, renderImportIssues, style } from './dom'
import { renderMappingPreview } from './mapping-preview'
import type { GridImportDialog, GridImportDialogCallbacks, GridImportDialogState } from './types'

const EMPTY_STATE: GridImportDialogState = {
  fileName: '',
  parsed: null,
  fields: [],
  mapping: [],
  matchFieldIds: [],
  validation: null,
  showValidationColumn: false,
  rowValidation: {},
  loading: false,
  submitting: false,
  progress: null,
  failures: [],
  status: '',
  enableAdvancedEditor: false,
  fromAdvancedEditor: false
}

type MappingDialogRefs = {
  content: HTMLDivElement
  previewPane: HTMLDivElement
  issues: HTMLDivElement
  importButton: HTMLButtonElement
  editButton: HTMLButtonElement
  confirmButton: HTMLButtonElement
  closeButton: HTMLButtonElement
  progress: HTMLDivElement
  progressSection: HTMLDivElement
  progressLabel: HTMLDivElement
  progressCount: HTMLDivElement
  progressBarFill: HTMLDivElement
  progressTrack: HTMLDivElement
}

function buildMappingDialogChrome(callbacks: GridImportDialogCallbacks): MappingDialogRefs {
  const overlay = document.createElement('div')
  overlay.id = 'plm-extension-grid-import-modal'
  style(
    overlay,
    `position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,0.45);display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;font-family:${IMPORT_UI_FONT};`
  )

  const panel = document.createElement('div')
  style(
    panel,
    'width:min(1560px,98vw);height:min(820px,90vh);background:#fff;border:1px solid #d0dbe8;border-radius:10px;box-shadow:0 16px 40px rgba(15,23,42,0.22);display:flex;flex-direction:column;overflow:hidden;'
  )

  const header = document.createElement('div')
  style(header, 'display:flex;justify-content:flex-start;gap:12px;padding:14px;border-bottom:1px solid #e2e8f0;')
  const titleWrap = document.createElement('div')
  const title = document.createElement('div')
  title.textContent = 'Grid Import'
  style(title, 'font:700 16px/1.2 "Segoe UI",Arial,sans-serif;color:#1f2d3d;')
  const subtitle = document.createElement('div')
  subtitle.textContent = 'Map CSV columns to grid fields.'
  style(subtitle, 'margin-top:4px;font:500 12px/1.35 "Segoe UI",Arial,sans-serif;color:#4b637a;')
  titleWrap.appendChild(title)
  titleWrap.appendChild(subtitle)
  header.appendChild(titleWrap)

  const body = document.createElement('div')
  style(body, 'flex:1;min-height:0;display:flex;flex-direction:column;padding:14px;gap:12px;overflow:hidden;background:#f8fbff;')

  const content = document.createElement('div')
  style(content, 'flex:1;min-height:0;display:flex;overflow:hidden;')
  const previewPane = document.createElement('div')
  style(previewPane, 'flex:1;min-width:0;background:#fff;border:1px solid #d7e3ef;border-radius:8px;overflow:auto;')
  content.appendChild(previewPane)

  const issues = document.createElement('div')
  style(issues, 'min-height:26px;font:600 12px/1.35 "Segoe UI",Arial,sans-serif;')

  const footer = document.createElement('div')
  style(footer, 'display:flex;flex-direction:column;gap:10px;padding:12px 14px;border-top:1px solid #e2e8f0;background:#fff;')

  const progressSection = document.createElement('div')
  style(progressSection, 'display:none;flex-direction:column;gap:6px;')
  const progressLabelRow = document.createElement('div')
  style(progressLabelRow, 'display:flex;justify-content:space-between;align-items:center;gap:10px;')
  const progressLabel = document.createElement('div')
  style(progressLabel, 'font:600 12px/1.35 "Segoe UI",Arial,sans-serif;color:#334155;')
  const progressCount = document.createElement('div')
  style(progressCount, 'font:600 12px/1.35 "Segoe UI",Arial,sans-serif;color:#64748b;white-space:nowrap;')
  progressLabelRow.appendChild(progressLabel)
  progressLabelRow.appendChild(progressCount)

  const progressTrack = document.createElement('div')
  style(progressTrack, 'height:8px;border-radius:999px;background:#e2e8f0;overflow:hidden;')
  const progressBarFill = document.createElement('div')
  style(
    progressBarFill,
    'height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg,#0284c7 0%,#0ea5e9 100%);transition:width .2s ease;'
  )
  progressTrack.appendChild(progressBarFill)
  progressSection.appendChild(progressLabelRow)
  progressSection.appendChild(progressTrack)

  const footerRow = document.createElement('div')
  style(footerRow, 'display:flex;justify-content:space-between;align-items:center;gap:10px;')
  const progress = document.createElement('div')
  style(progress, 'flex:1;min-width:0;font:600 12px/1.35 "Segoe UI",Arial,sans-serif;color:#4b637a;')

  const actions = document.createElement('div')
  style(actions, 'display:flex;justify-content:flex-end;align-items:center;gap:8px;flex:0 0 auto;')
  const closeButton = createButton('Close')
  closeButton.addEventListener('click', callbacks.onClose)
  const editButton = createButton('Edit In Advanced Editor')
  editButton.addEventListener('click', callbacks.onEdit)
  const confirmButton = createButton('Confirm', true)
  confirmButton.addEventListener('click', callbacks.onEdit)
  const importButton = createButton('Import', true)
  importButton.addEventListener('click', callbacks.onImport)
  actions.appendChild(closeButton)
  actions.appendChild(editButton)
  actions.appendChild(confirmButton)
  actions.appendChild(importButton)
  footerRow.appendChild(progress)
  footerRow.appendChild(actions)
  footer.appendChild(progressSection)
  footer.appendChild(footerRow)

  body.appendChild(content)
  body.appendChild(issues)
  panel.appendChild(header)
  panel.appendChild(body)
  panel.appendChild(footer)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  return {
    content,
    previewPane,
    issues,
    importButton,
    editButton,
    confirmButton,
    closeButton,
    progress,
    progressSection,
    progressLabel,
    progressCount,
    progressBarFill,
    progressTrack
  }
}

function renderLoadingOrStatus(previewPane: HTMLElement, state: GridImportDialogState): void {
  previewPane.textContent = ''
  if (state.loading) {
    previewPane.appendChild(createGenericLoaderElement(state.status || 'Loading CSV file...'))
    return
  }
  if (!state.status) return
  const message = document.createElement('div')
  message.textContent = state.status
  style(message, 'padding:24px;font:600 13px/1.45 "Segoe UI",Arial,sans-serif;color:#475569;')
  previewPane.appendChild(message)
}

function updateProgressBar(refs: MappingDialogRefs, state: GridImportDialogState): void {
  const showProgressBar = Boolean(state.progress && (state.loading || state.submitting))
  refs.progressSection.style.display = showProgressBar ? 'flex' : 'none'
  if (showProgressBar && state.progress) {
    const total = Math.max(state.progress.total, 1)
    const completed = Math.min(Math.max(state.progress.completed, 0), total)
    const percent = Math.round((completed / total) * 100)
    refs.progressLabel.textContent = state.progress.message
    refs.progressCount.textContent = `${completed} / ${total}`
    refs.progressBarFill.style.width = `${percent}%`
    refs.progressBarFill.setAttribute('aria-valuenow', String(percent))
    refs.progressBarFill.setAttribute('aria-valuemin', '0')
    refs.progressBarFill.setAttribute('aria-valuemax', '100')
    refs.progressTrack.setAttribute('role', 'progressbar')
    refs.progressTrack.setAttribute('aria-valuenow', String(percent))
    refs.progress.textContent = ''
    return
  }
  refs.progress.textContent = state.submitting ? 'Importing...' : ''
}

export function showGridImportDialog(callbacks: GridImportDialogCallbacks): GridImportDialog {
  document.getElementById('plm-extension-grid-import-modal')?.remove()
  const refs = buildMappingDialogChrome(callbacks)
  const overlay = document.getElementById('plm-extension-grid-import-modal') as HTMLDivElement

  function update(state: GridImportDialogState): void {
    const showMapping = Boolean(state.parsed)
    const showContent = showMapping || state.loading || Boolean(state.status)
    refs.content.style.display = showContent ? 'flex' : 'none'
    const showDefaultActions = showMapping && !state.fromAdvancedEditor
    const showAdvancedEditorActions = showMapping && state.fromAdvancedEditor
    refs.importButton.style.display = showDefaultActions ? '' : 'none'
    refs.editButton.style.display = showDefaultActions && state.enableAdvancedEditor ? '' : 'none'
    refs.confirmButton.style.display = showAdvancedEditorActions ? '' : 'none'

    if (showMapping) {
      renderMappingPreview(refs.previewPane, state, callbacks)
    } else {
      renderLoadingOrStatus(refs.previewPane, state)
    }

    renderImportIssues(refs.issues, null, state.failures)
    refs.importButton.disabled = state.loading || state.submitting || !state.parsed
    refs.editButton.disabled = state.loading || state.submitting || !state.parsed || !state.enableAdvancedEditor
    refs.confirmButton.disabled = state.loading || state.submitting || !state.parsed
    const handoffTitle = callbacks.canEditInAdvancedEditor()
      ? 'Validate CSV rows and confirm mapping in the advanced editor'
      : 'Advanced editor is not available'
    refs.editButton.title = callbacks.canEditInAdvancedEditor()
      ? 'Validate CSV rows and open the advanced editor with staged import data'
      : 'Advanced editor is not available'
    refs.confirmButton.title = handoffTitle
    refs.closeButton.disabled = state.submitting
    updateProgressBar(refs, state)
  }

  update(EMPTY_STATE)

  return {
    update,
    close: () => overlay.remove()
  }
}
