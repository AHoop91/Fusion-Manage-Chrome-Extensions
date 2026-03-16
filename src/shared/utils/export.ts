export type ExportUiState = {
  isExporting: boolean
  processed: number
  total: number
}

type ExportButtonLabelOptions = {
  button: HTMLElement | null
  textSelector: string
  isExporting: boolean
  idleLabel: string
  activeLabel: string
}

type ExportProgressOptions = {
  container: HTMLElement | null
  text: HTMLElement | null
  fill: HTMLElement | null
  state: ExportUiState
  labelPrefix?: string
}

/**
 * Shared CSV/export utility helpers for content features.
 */
export function csvEscape(value: unknown): string {
  let normalized = String(value ?? '')
  if (normalized.includes('"')) {
    normalized = normalized.replace(/"/g, '""')
  }
  return /[",\r\n]/.test(normalized) ? `"${normalized}"` : normalized
}

export function makeTimestamp(): string {
  const now = new Date()
  const year = String(now.getFullYear())
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  return `${year}${month}${day}-${hour}${minute}`
}

export function nextTick(): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, 0)
  })
}

export function downloadCsv(filename: string, csvContent: string): void {
  const withBom = `\uFEFF${csvContent}`
  const blob = new Blob([withBom], { type: 'text/csv;charset=utf-8;' })
  const objectUrl = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()

  URL.revokeObjectURL(objectUrl)
}

/**
 * Apply export button text state consistently across features.
 */
export function setExportButtonLabel(options: ExportButtonLabelOptions): void {
  if (!options.button) return
  const textNode = options.button.querySelector(options.textSelector)
  if (!textNode) return
  textNode.textContent = options.isExporting ? options.activeLabel : options.idleLabel
}

/**
 * Apply export progress row visibility and fill values.
 */
export function setExportProgress(options: ExportProgressOptions): void {
  const { container, text, fill, state } = options
  if (!container || !text || !fill) return

  if (!state.isExporting || !state.total) {
    container.style.display = 'none'
    fill.style.width = '0%'
    text.textContent = ''
    return
  }

  const safeProcessed = Math.max(0, Math.min(state.processed, state.total))
  const percent = state.total > 0 ? Math.round((safeProcessed / state.total) * 100) : 0
  const labelPrefix = options.labelPrefix || 'Exporting'

  container.style.display = 'flex'
  text.textContent = `${labelPrefix} ${safeProcessed} of ${state.total} (${percent}%)`
  fill.style.width = `${percent}%`
}
