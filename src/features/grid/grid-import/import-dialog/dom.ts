import type { GridImportSubmitFailure } from '../submit.service'
import type { GridImportValidationResult } from '../types'

export const IMPORT_UI_FONT = '"ArtifaktElement","Segoe UI",Arial,sans-serif'

export function style(el: HTMLElement, cssText: string): void {
  el.style.cssText = cssText
}

export function createButton(label: string, primary = false): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  button.className = primary
    ? 'plm-extension-btn plm-extension-btn--primary'
    : 'plm-extension-btn plm-extension-btn--secondary'
  style(button, `height:34px;padding:0 14px;font:600 13px/1 ${IMPORT_UI_FONT};`)
  return button
}

export function createModalOverlay(zIndex: number): HTMLDivElement {
  const overlay = document.createElement('div')
  style(
    overlay,
    `position:fixed;inset:0;z-index:${zIndex};background:rgba(15,23,42,0.35);display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;font-family:${IMPORT_UI_FONT};`
  )
  document.body.appendChild(overlay)
  return overlay
}

export function createModalPanel(width: string): HTMLDivElement {
  const panel = document.createElement('div')
  style(
    panel,
    `width:${width};background:#fff;border:1px solid #d0dbe8;border-radius:12px;box-shadow:0 18px 44px rgba(15,23,42,0.24);padding:20px;box-sizing:border-box;display:flex;flex-direction:column;gap:14px;`
  )
  return panel
}

export function createModalTitle(text: string): HTMLDivElement {
  const title = document.createElement('div')
  title.textContent = text
  style(title, `font:700 17px/1.2 ${IMPORT_UI_FONT};color:#172033;`)
  return title
}

export function createModalBody(): HTMLDivElement {
  const body = document.createElement('div')
  style(body, `display:flex;flex-direction:column;gap:10px;font:600 12px/1.5 ${IMPORT_UI_FONT};color:#475569;`)
  return body
}

export function appendParagraphs(container: HTMLElement, lines: string[]): void {
  for (const text of lines) {
    const paragraph = document.createElement('p')
    paragraph.textContent = text
    style(paragraph, 'margin:0;')
    container.appendChild(paragraph)
  }
}

export function createModalActions(buttons: HTMLButtonElement[]): HTMLDivElement {
  const actions = document.createElement('div')
  style(actions, 'display:flex;justify-content:flex-end;gap:8px;')
  for (const button of buttons) {
    actions.appendChild(button)
  }
  return actions
}

export function mountModal(
  panel: HTMLElement,
  zIndex = 2147483647
): { overlay: HTMLDivElement; close: () => void } {
  const overlay = createModalOverlay(zIndex)
  overlay.appendChild(panel)
  return {
    overlay,
    close: () => overlay.remove()
  }
}

export function createTableCell(text: string, header = false): HTMLTableCellElement {
  const node = document.createElement(header ? 'th' : 'td') as HTMLTableCellElement
  node.textContent = text
  style(
    node,
    header
      ? 'position:sticky;top:0;background:#f1f5f9;text-align:left;padding:8px 10px;border-bottom:1px solid #d8e2ee;font:700 11px/1.2 "Segoe UI",Arial,sans-serif;color:#475569;text-transform:uppercase;'
      : 'padding:8px 10px;border-bottom:1px solid #edf2f7;font:500 12px/1.35 "Segoe UI",Arial,sans-serif;color:#24364a;vertical-align:top;'
  )
  return node
}

export function createKeyIcon(): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', '15')
  svg.setAttribute('height', '15')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', '2')
  svg.setAttribute('stroke-linecap', 'round')
  svg.setAttribute('stroke-linejoin', 'round')
  svg.setAttribute('aria-hidden', 'true')
  const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
  circle.setAttribute('cx', '7.5')
  circle.setAttribute('cy', '14.5')
  circle.setAttribute('r', '3.5')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', 'M10 12 21 1M15 6l3 3M12 9l3 3')
  svg.appendChild(circle)
  svg.appendChild(path)
  return svg
}

export function createValidationStatusIcon(
  tone: 'success' | 'danger' | 'warning',
  size = '22'
): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', size)
  svg.setAttribute('height', size)
  svg.setAttribute('aria-hidden', 'true')
  svg.dataset.validationTone = tone

  if (tone === 'success') {
    svg.setAttribute('fill', 'none')
    svg.setAttribute('stroke', 'currentColor')
    svg.setAttribute('stroke-width', '2.25')
    svg.setAttribute('stroke-linecap', 'round')
    svg.setAttribute('stroke-linejoin', 'round')
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    circle.setAttribute('cx', '12')
    circle.setAttribute('cy', '12')
    circle.setAttribute('r', '10')
    const check = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    check.setAttribute('d', 'm8.5 12.5 2.5 2.5 5-5.5')
    svg.appendChild(circle)
    svg.appendChild(check)
    return svg
  }

  const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  triangle.setAttribute('d', 'M12 3.2 20.8 19.8H3.2L12 3.2z')
  triangle.setAttribute('fill', 'currentColor')
  const exclamation = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  exclamation.setAttribute('fill', '#fff')
  exclamation.setAttribute(
    'd',
    'M12 8.4a.85.85 0 0 1 .85.85v3.5a.85.85 0 1 1-1.7 0v-3.5A.85.85 0 0 1 12 8.4zm0 6.8a1 1 0 1 1 0-2 1 1 0 0 1 0 2z'
  )
  svg.appendChild(triangle)
  svg.appendChild(exclamation)
  return svg
}

export function renderMessageList(items: string[], tone: 'error' | 'warning', limit = 30): HTMLElement {
  const list = document.createElement('ul')
  style(
    list,
    `margin:8px 0 0;padding-left:18px;max-height:220px;overflow:auto;color:${tone === 'error' ? '#9f1239' : '#92400e'};`
  )
  for (const message of items.slice(0, limit)) {
    const item = document.createElement('li')
    item.textContent = message
    list.appendChild(item)
  }
  if (items.length > limit) {
    const item = document.createElement('li')
    item.textContent = `+${items.length - limit} more`
    list.appendChild(item)
  }
  return list
}

export function renderImportIssues(
  container: HTMLElement,
  validation: GridImportValidationResult | null,
  failures: GridImportSubmitFailure[]
): void {
  container.textContent = ''
  const messages = [
    ...(validation?.mappingIssues || []).map((message) => `Mapping: ${message}`),
    ...(validation?.rowIssues || []).map(
      (issue) => `Row ${issue.row}${issue.fieldName ? `, ${issue.fieldName}` : ''}: ${issue.message}`
    ),
    ...(validation?.warningIssues || []).map(
      (issue) => `Known issue - Row ${issue.row}${issue.fieldName ? `, ${issue.fieldName}` : ''}: ${issue.message}`
    ),
    ...failures.map((failure) => `Row ${failure.row}: ${failure.message}`)
  ]
  if (messages.length === 0) {
    container.textContent = validation ? 'No validation issues.' : ''
    container.style.color = '#166534'
    return
  }
  container.style.color = '#9f1239'
  container.appendChild(renderMessageList(messages, 'error', 25))
}
