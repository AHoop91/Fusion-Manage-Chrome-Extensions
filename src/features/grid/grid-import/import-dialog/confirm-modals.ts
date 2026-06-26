import { createGenericLoaderElement } from '../../../cross-feature-ui/generic-loader'
import type { GridImportValidationResult } from '../types'
import {
  appendParagraphs,
  createButton,
  createModalActions,
  createModalBody,
  createModalPanel,
  createModalTitle,
  mountModal,
  renderMessageList,
  style
} from './dom'
import type {
  GridImportEditAllSkippedModal,
  GridImportEditAllSkippedOptions,
  GridImportEditConfirmModal,
  GridImportEditConfirmOptions,
  GridImportValidationIssuesModal,
  GridImportValidationIssuesModalOptions,
  GridImportValidationModal
} from './types'

export function showGridImportValidationModal(onClose: () => void): GridImportValidationModal {
  const panel = createModalPanel('min(560px,94vw)')
  style(panel, `${panel.style.cssText}max-height:min(680px,86vh);border-radius:10px;padding:18px;gap:12px;`)
  const { close } = mountModal(panel)

  function renderShell(titleText: string): HTMLDivElement {
    panel.textContent = ''
    const title = document.createElement('div')
    title.textContent = titleText
    style(title, 'font:700 16px/1.2 "Segoe UI",Arial,sans-serif;color:#1f2d3d;')
    const body = document.createElement('div')
    style(body, 'font:600 12px/1.45 "Segoe UI",Arial,sans-serif;color:#475569;min-height:90px;')
    panel.appendChild(title)
    panel.appendChild(body)
    return body
  }

  return {
    showLoading(message: string): void {
      const body = renderShell('Validating Import')
      style(body, `${body.style.cssText}display:flex;align-items:center;justify-content:center;`)
      body.appendChild(createGenericLoaderElement(message))
    },
    showResult(validation: GridImportValidationResult, onContinue: () => void): void {
      const blocking = [
        ...validation.mappingIssues.map((message) => `Mapping: ${message}`),
        ...validation.rowIssues.map(
          (issue) => `Row ${issue.row}${issue.fieldName ? `, ${issue.fieldName}` : ''}: ${issue.message}`
        )
      ]
      const warnings = validation.warningIssues.map(
        (issue) => `Row ${issue.row}${issue.fieldName ? `, ${issue.fieldName}` : ''}: ${issue.message}`
      )
      const checkedSummary = `Checked ${validation.checkedRows} CSV row(s) and ${validation.checkedCells} mapped cell value(s).`
      const body = renderShell(blocking.length > 0 ? 'Validation Failed' : 'Validation Complete')
      if (blocking.length > 0) {
        body.textContent = `${checkedSummary} ${blocking.length} field validation issue(s) must be fixed before importing.`
        body.appendChild(renderMessageList(blocking, 'error'))
      } else if (warnings.length > 0) {
        body.textContent = `${checkedSummary} ${warnings.length} known issue(s) found. You can continue importing; unsupported picklist values will be left blank.`
        body.appendChild(renderMessageList(warnings, 'warning'))
      } else {
        body.textContent = `${checkedSummary} All mapped field and picklist validations passed. Ready to import.`
      }
      const closeBtn = createButton(blocking.length > 0 ? 'Close' : 'Cancel')
      closeBtn.addEventListener('click', onClose)
      const actionButtons = [closeBtn]
      if (blocking.length === 0) {
        const proceed = createButton(warnings.length > 0 ? 'Continue Import' : 'Import', true)
        proceed.addEventListener('click', onContinue)
        actionButtons.push(proceed)
      }
      panel.appendChild(createModalActions(actionButtons))
    },
    close
  }
}

export function showGridImportValidationIssuesModal(
  validation: GridImportValidationResult,
  onContinue: () => void,
  onClose: () => void,
  options: GridImportValidationIssuesModalOptions = {}
): GridImportValidationIssuesModal {
  const isEdit = options.intent === 'edit'
  const errorCount = validation.mappingIssues.length + validation.rowIssues.length
  const warningCount = validation.warningIssues.length
  const canContinue = errorCount === 0

  const panel = createModalPanel('min(420px,94vw)')
  panel.appendChild(createModalTitle(canContinue ? (isEdit ? 'Continue to Edit?' : 'Continue Import?') : 'Validation Failed'))

  const summary = document.createElement('div')
  if (canContinue) {
    summary.textContent =
      warningCount > 0
        ? isEdit
          ? `${warningCount} row(s) have validation warnings. Review the flagged rows in the table. Do you want to continue to the advanced editor? Unsupported picklist values will be left blank.`
          : `${warningCount} row(s) have validation warnings. Review the flagged rows in the table. Do you want to continue importing? Unsupported picklist values will be left blank.`
        : isEdit
          ? 'Some rows need review. Do you want to continue to the advanced editor?'
          : 'Some rows need review. Do you want to continue importing?'
  } else {
    summary.textContent = isEdit
      ? `${errorCount} validation error(s) must be fixed before editing in the advanced editor. Review the flagged rows in the table.`
      : `${errorCount} validation error(s) must be fixed before importing. Review the flagged rows in the table.`
  }
  style(summary, 'font:600 12px/1.45 "Segoe UI",Arial,sans-serif;color:#475569;')
  panel.appendChild(summary)

  const closeBtn = createButton(canContinue ? 'Cancel' : 'Close')
  closeBtn.addEventListener('click', onClose)
  const actionButtons = [closeBtn]
  if (canContinue) {
    const proceed = createButton('Accept', true)
    proceed.addEventListener('click', onContinue)
    actionButtons.push(proceed)
  }
  panel.appendChild(createModalActions(actionButtons))

  const { close } = mountModal(panel)
  return { close }
}

export function showGridImportEditAllSkippedModal(
  options: GridImportEditAllSkippedOptions
): GridImportEditAllSkippedModal {
  const panel = createModalPanel('min(480px,94vw)')
  panel.appendChild(createModalTitle('Nothing to stage in Advanced Editor'))
  const body = createModalBody()
  const paragraphs = [
    `${options.skippedRowCount} CSV row(s) could not be staged for editing.`,
    `First reason: ${options.firstReason}`,
    options.hasAdditionalSkippedRows
      ? 'Additional skipped rows may have other reasons. Review mapping and Match On settings.'
      : 'Review mapping and Match On settings, then try again.'
  ]
  appendParagraphs(body, paragraphs)
  panel.appendChild(body)

  const closeBtn = createButton('Close')
  const { close } = mountModal(panel)
  closeBtn.addEventListener('click', () => {
    options.onClose()
    close()
  })
  panel.appendChild(createModalActions([closeBtn]))
  return { close }
}

export function showGridImportEditConfirmModal(options: GridImportEditConfirmOptions): GridImportEditConfirmModal {
  const panel = createModalPanel('min(480px,94vw)')
  panel.appendChild(createModalTitle('Review before editing'))
  const body = createModalBody()
  const paragraphs = [
    'Before opening these rows in the Advanced Editor, please confirm you are happy with the imported items.',
    'Any unmapped CSV fields will not be carried forward.',
    'Rows matched by Match On keys will be staged as updates to existing grid rows. Unmatched rows will be staged as new rows.'
  ]
  if (options.skippedRowCount > 0) {
    paragraphs.push(
      `${options.skippedRowCount} CSV row(s) could not be staged and will be skipped. The advanced editor will open with ${options.stagedRowCount} staged row(s).`
    )
  }
  appendParagraphs(body, paragraphs)
  panel.appendChild(body)

  const { close } = mountModal(panel)
  const cancel = createButton('Cancel')
  cancel.addEventListener('click', () => {
    options.onCancel()
    close()
  })
  const proceed = createButton('Continue to Advanced Editor', true)
  proceed.addEventListener('click', () => {
    options.onContinue()
    close()
  })
  panel.appendChild(createModalActions([cancel, proceed]))
  return { close }
}
