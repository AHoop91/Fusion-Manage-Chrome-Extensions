import { DESIGN_COMPONENTS_MODAL_ID } from './components.constants'
import { createGenericLoaderElement } from '../../shared/generic-loader'
import type { ConversionState, DerivativeOutputType, DesignItemDetails, FormatOptionField, OutputFormatOption } from './components.types'

let activeModalAbort: AbortController | null = null

function detachModalDom(): void {
  document.getElementById(DESIGN_COMPONENTS_MODAL_ID)?.remove()
}

export function removeConversionModal(): void {
  activeModalAbort?.abort()
  activeModalAbort = null
  detachModalDom()
}

export type ConversionModalApi = {
  abortSignal: AbortSignal
  onConvert: (handler: () => void) => void
  getSelectedFormat: () => string
  getAdvancedOptions: () => Record<string, string>
  getFilename: () => string
  getForceRetranslate: () => boolean
  renderSourceLoading: () => void
  renderDesignDetails: (details: DesignItemDetails) => void
  renderFormatList: (options: OutputFormatOption[], onFormatChange?: (format: string) => void) => void
  setForceRetranslate: (available: boolean) => void
  renderSourceError: (error: unknown) => void
  renderState: (state: ConversionState) => void
  renderError: (error: unknown) => void
  setConvertDisabled: (disabled: boolean) => void
  setConversionProgress: (ratio: number | null, statusText: string) => void
  setConversionProgressVisible: (visible: boolean) => void
  downloadDerivativeFile: (params: { base64: string; contentType: string; filename: string }) => void
  close: () => void
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text != null) e.textContent = text
  return e
}

function formatFileSize(sizeStr: string): string {
  const bytes = Number.parseInt(sizeStr, 10)
  if (!Number.isFinite(bytes) || bytes <= 0) return sizeStr
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function base64ToBlob(base64: string, contentType: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: contentType })
}

function makeSection(title: string): { section: HTMLDivElement; fieldsWrap: HTMLDivElement } {
  const section = el('div', 'plm-ext-dc-section')
  section.appendChild(el('p', 'plm-ext-dc-section-title', title))
  section.appendChild(el('hr', 'plm-ext-dc-divider'))
  const fieldsWrap = el('div')
  section.appendChild(fieldsWrap)
  return { section, fieldsWrap }
}

function renderOptionFields(container: HTMLElement, fields: FormatOptionField[]): void {
  container.replaceChildren()
  for (const field of fields) {
    const wrap = el('div', 'plm-ext-dc-option-field')
    wrap.appendChild(el('label', 'plm-ext-dc-label', field.label))
    const select = el('select', 'plm-ext-dc-select')
    select.dataset.key = field.key
    for (const opt of field.options) {
      const o = el('option')
      o.value = opt.value
      o.textContent = opt.label
      if (opt.value === field.defaultValue) o.selected = true
      select.appendChild(o)
    }
    wrap.appendChild(select)
    container.appendChild(wrap)
  }
}

const EXT_MAP: Record<string, string> = {
  step: 'step', stl: 'stl', iges: 'iges', obj: 'obj',
  dwg: 'dwg', pdf: 'pdf', fbx: 'fbx', thumbnail: 'png', svf: 'svf', svf2: 'svf2'
}

export function openConversionModal(): ConversionModalApi {
  removeConversionModal()

  const abortController = new AbortController()
  activeModalAbort = abortController

  const overlay = document.createElement('div')
  overlay.id = DESIGN_COMPONENTS_MODAL_ID

  // Shell
  const shell = el('div', 'plm-ext-dc-shell')

  // Header
  const header = el('div', 'plm-ext-dc-header')
  const headerCopy = el('div', 'plm-ext-dc-header-copy')
  const titleRow = el('div', 'plm-ext-dc-title-row')
  titleRow.appendChild(el('h3', 'plm-ext-dc-title', 'Model Derivative Conversion'))
  titleRow.appendChild(el('span', 'plm-ext-dc-premium-badge', 'Paid Tier API'))
  headerCopy.appendChild(titleRow)
  headerCopy.appendChild(el('p', 'plm-ext-dc-subtitle', 'Convert your design to another file format.'))
  const chargeNotice = el('p', 'plm-ext-dc-charge-notice')
  chargeNotice.innerHTML = 'Usage beyond your monthly Autodesk Platform Services limit may incur additional charges. '
  const chargeLink = el('a')
  chargeLink.href = 'https://www.autodesk.com/products/autodesk-platform-services/product-details'
  chargeLink.target = '_blank'
  chargeLink.rel = 'noopener noreferrer'
  chargeLink.textContent = 'Learn about APS plans ↗'
  chargeNotice.appendChild(chargeLink)
  headerCopy.appendChild(chargeNotice)
  header.appendChild(headerCopy)

  // Body columns
  const body = el('div', 'plm-ext-dc-body')
  const colDetails = el('div', 'plm-ext-dc-col-details')
  const colRight = el('div', 'plm-ext-dc-col-right')

  // Format section
  const { section: fmtSection, fieldsWrap: formatWrap } = makeSection('Output Format')
  formatWrap.className = 'plm-ext-dc-format-wrap'

  // Options section (hidden until a format with fields is selected)
  const { section: optSection, fieldsWrap: optFieldsWrap } = makeSection('Format Options')
  optSection.hidden = true

  // Filename section
  const { section: fnSection } = makeSection('Output File')
  const autoToggle = el('label', 'plm-ext-dc-toggle')
  const autoCheck = el('input')
  autoCheck.type = 'checkbox'
  autoCheck.checked = true
  autoToggle.appendChild(autoCheck)
  autoToggle.appendChild(document.createTextNode('Auto-generate filename'))
  const filenameWrap = el('div', 'plm-ext-dc-filename-wrap plm-ext-dc-filename-wrap--disabled')
  const baseInput = el('input', 'plm-ext-dc-filename-base')
  baseInput.type = 'text'
  baseInput.spellcheck = false
  baseInput.disabled = true
  const extSpan = el('span', 'plm-ext-dc-filename-ext')
  filenameWrap.appendChild(baseInput)
  filenameWrap.appendChild(extSpan)
  fnSection.appendChild(autoToggle)
  fnSection.appendChild(filenameWrap)

  autoCheck.addEventListener('change', () => {
    const disabled = autoCheck.checked
    baseInput.disabled = disabled
    filenameWrap.classList.toggle('plm-ext-dc-filename-wrap--disabled', disabled)
    if (!disabled) {
      baseInput.focus()
      baseInput.select()
    }
  })

  // Translation options section
  const { section: txSection } = makeSection('Translation')
  const forceToggle = el('label', 'plm-ext-dc-toggle')
  const forceCheck = el('input')
  forceCheck.type = 'checkbox'
  forceCheck.checked = false
  forceCheck.disabled = true
  forceToggle.style.opacity = '0.45'
  forceToggle.style.cursor = 'not-allowed'
  forceToggle.appendChild(forceCheck)
  forceToggle.appendChild(document.createTextNode('Force re-translation'))
  const forceHint = el('p', 'plm-ext-dc-muted', 'No cached result found for this format.')
  txSection.appendChild(forceToggle)
  txSection.appendChild(forceHint)

  colRight.appendChild(fmtSection)
  colRight.appendChild(optSection)
  colRight.appendChild(fnSection)
  colRight.appendChild(txSection)
  body.appendChild(colDetails)
  body.appendChild(colRight)

  // Footer
  const footer = el('div', 'plm-ext-dc-footer')

  const progressPanel = el('div', 'plm-ext-dc-progress-panel')
  progressPanel.hidden = true
  const progressHeader = el('div', 'plm-ext-dc-progress-header')
  const statusText = el('span')
  const statusPct = el('span')
  progressHeader.appendChild(statusText)
  progressHeader.appendChild(statusPct)
  const progressTrack = el('div', 'plm-ext-dc-progress-track')
  const progressFill = el('span', 'plm-ext-dc-progress-fill')
  progressTrack.appendChild(progressFill)
  progressPanel.appendChild(progressHeader)
  progressPanel.appendChild(progressTrack)

  const actions = el('div', 'plm-ext-dc-actions')
  const cancelBtn = el('button', 'plm-ext-dc-btn-secondary', 'Cancel')
  cancelBtn.type = 'button'
  const convertBtn = el('button', 'plm-ext-dc-btn-primary', 'Convert →')
  convertBtn.type = 'button'
  convertBtn.disabled = true
  actions.appendChild(cancelBtn)
  actions.appendChild(convertBtn)

  footer.appendChild(progressPanel)
  footer.appendChild(actions)

  // Full-shell loading overlay
  const loaderOverlay = createGenericLoaderElement('Loading design details...', { className: 'plm-ext-dc-loader' })
  loaderOverlay.hidden = true

  body.appendChild(loaderOverlay)

  // Confirm-cancel dialog (shown when conversion is in progress)
  let converting = false
  const confirmOverlay = el('div', 'plm-ext-dc-confirm-overlay')
  confirmOverlay.hidden = true
  const confirmDialog = el('div', 'plm-ext-dc-confirm-dialog')
  confirmDialog.setAttribute('role', 'alertdialog')
  confirmDialog.setAttribute('aria-modal', 'true')
  const confirmCopy = el('div', 'plm-ext-dc-confirm-copy')
  confirmCopy.appendChild(el('p', 'plm-ext-dc-confirm-title', 'Cancel conversion?'))
  confirmCopy.appendChild(el('p', 'plm-ext-dc-confirm-text', 'A translation is in progress. Cancelling now will stop the process and no file will be downloaded.'))
  const confirmActions = el('div', 'plm-ext-dc-confirm-actions')
  const keepBtn = el('button', 'plm-ext-dc-confirm-btn plm-ext-dc-confirm-btn--secondary', 'Keep waiting')
  keepBtn.type = 'button'
  const confirmCancelBtn = el('button', 'plm-ext-dc-confirm-btn plm-ext-dc-confirm-btn--danger', 'Cancel conversion')
  confirmCancelBtn.type = 'button'
  confirmActions.appendChild(keepBtn)
  confirmActions.appendChild(confirmCancelBtn)
  confirmDialog.appendChild(confirmCopy)
  confirmDialog.appendChild(confirmActions)
  confirmOverlay.appendChild(confirmDialog)
  shell.appendChild(header)
  shell.appendChild(body)
  shell.appendChild(footer)
  overlay.appendChild(shell)
  overlay.appendChild(confirmOverlay)
  document.body.appendChild(overlay)

  const close = (): void => {
    abortController.abort()
    detachModalDom()
    if (activeModalAbort === abortController) activeModalAbort = null
  }

  const requestClose = (): void => {
    if (converting) {
      confirmOverlay.hidden = false
      keepBtn.focus()
    } else {
      close()
    }
  }

  keepBtn.addEventListener('click', () => { confirmOverlay.hidden = true })
  confirmCancelBtn.addEventListener('click', close)

  cancelBtn.addEventListener('click', requestClose)
  overlay.addEventListener('click', (e) => { if (e.target === overlay) requestClose() })

  function updateStatus(text: string, pct?: number | null): void {
    statusText.textContent = text
    statusPct.textContent = pct != null ? `${Math.round(pct * 100)}%` : ''
  }

  function getSelectedFormat(): string {
    return formatWrap.querySelector<HTMLInputElement>('input[type="radio"]:checked')?.value ?? ''
  }

  function syncOptionsSection(fields: FormatOptionField[] | undefined): void {
    if (fields && fields.length > 0) {
      renderOptionFields(optFieldsWrap, fields)
      optSection.hidden = false
    } else {
      optSection.hidden = true
      optFieldsWrap.replaceChildren()
    }
  }

  let currentDesignName = ''

  function buildAutoBaseName(): string {
    return currentDesignName
      ? currentDesignName
          .replace(/\.[^/.]+$/i, '')
          .replace(/[^\w\-.]+/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '')
          .slice(0, 96) || 'derivative'
      : 'derivative'
  }

  function syncFilenameValue(format: string): void {
    const ext = EXT_MAP[format] ?? format
    extSpan.textContent = `.${ext}`
    baseInput.value = buildAutoBaseName()
    baseInput.placeholder = buildAutoBaseName() || 'filename'
  }

  return {
    abortSignal: abortController.signal,

    onConvert(handler) {
      convertBtn.onclick = () => handler()
    },

    getSelectedFormat,

    getAdvancedOptions() {
      const result: Record<string, string> = {}
      for (const select of Array.from(optFieldsWrap.querySelectorAll<HTMLSelectElement>('select[data-key]'))) {
        if (select.dataset.key) result[select.dataset.key] = select.value
      }
      return result
    },

    getFilename() {
      const ext = extSpan.textContent ?? ''
      if (autoCheck.checked) return `${buildAutoBaseName()}${ext}`
      const base = baseInput.value.trim()
      return base ? `${base}${ext}` : `${buildAutoBaseName()}${ext}`
    },

    getForceRetranslate() {
      return forceCheck.checked
    },

    setForceRetranslate(available) {
      forceCheck.checked = false
      forceCheck.disabled = !available
      forceToggle.style.opacity = available ? '' : '0.45'
      forceToggle.style.cursor = available ? '' : 'not-allowed'
      forceHint.textContent = available
        ? 'A cached result exists. Enable to force a fresh conversion.'
        : 'No cached result found for this format.'
    },

    renderSourceLoading() {
      loaderOverlay.hidden = false
      formatWrap.replaceChildren()
      optSection.hidden = true
      optFieldsWrap.replaceChildren()
      cancelBtn.disabled = true
      convertBtn.disabled = true
      progressPanel.hidden = true
      updateStatus('')
    },

    renderDesignDetails(details) {
      loaderOverlay.hidden = true
      cancelBtn.disabled = false
      currentDesignName = details.name || ''
      colDetails.replaceChildren()

      const rows: [string, string | null][] = [
        ['Name',      details.name],
        ['Extension', details.extensionType ? details.extensionType.toUpperCase() : null],
        ['Size',      details.size ? formatFileSize(details.size) : null]
      ]
      for (const [label, value] of rows) {
        if (!value) continue
        const block = el('div', 'plm-ext-dc-detail-block')
        block.appendChild(el('p', 'plm-ext-dc-detail-label', label))
        block.appendChild(el('p', 'plm-ext-dc-detail-value', value))
        colDetails.appendChild(block)
      }
      if (details.fusionWebUrl) {
        const block = el('div', 'plm-ext-dc-detail-block')
        block.appendChild(el('p', 'plm-ext-dc-detail-label', 'Link'))
        const link = el('a', 'plm-ext-dc-detail-value', 'Open in Fusion')
        link.href = details.fusionWebUrl
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        block.appendChild(link)
        colDetails.appendChild(block)
      }
    },

    renderFormatList(options, onFormatChange) {
      formatWrap.replaceChildren()
      convertBtn.disabled = true
      updateStatus('')

      if (options.length === 0) {
        formatWrap.appendChild(el('p', 'plm-ext-dc-muted', 'No supported output formats for this file type.'))
        optSection.hidden = true
        return
      }

      const groupName = `plm-ext-dc-fmt-${Date.now()}`
      const fieldsByFormat = new Map(options.map((o) => [o.value, o.fields]))

      options.forEach((opt, i) => {
        const card = el('label', 'plm-ext-dc-format-card')
        const radio = el('input')
        radio.type = 'radio'
        radio.name = groupName
        radio.value = opt.value
        if (i === 0) {
          radio.checked = true
          syncOptionsSection(opt.fields)
          syncFilenameValue(opt.value)
          onFormatChange?.(opt.value)
        }
        radio.addEventListener('change', () => {
          if (radio.checked) {
            syncOptionsSection(fieldsByFormat.get(radio.value as DerivativeOutputType))
            syncFilenameValue(radio.value)
            onFormatChange?.(radio.value)
          }
        })
        card.appendChild(radio)
        card.appendChild(document.createTextNode(opt.value.toUpperCase()))
        formatWrap.appendChild(card)
      })

      convertBtn.disabled = false
    },

    renderSourceError(error) {
      loaderOverlay.hidden = true
      cancelBtn.disabled = false
      colDetails.replaceChildren(el('p', 'plm-ext-dc-err', 'Unable to load design details.'))
      formatWrap.replaceChildren()
      optSection.hidden = true
      updateStatus(error instanceof Error ? error.message : String(error))
      convertBtn.disabled = true
      progressPanel.hidden = true
    },

    renderState(state) {
      updateStatus(state.message)
      if (state.state === 'success') {
        progressTrack.hidden = true
        progressPanel.hidden = false
      }
    },

    renderError(error) {
      converting = false
      confirmOverlay.hidden = true
      progressFill.classList.remove('indeterminate')
      progressTrack.hidden = true
      progressPanel.hidden = false
      updateStatus(error instanceof Error ? error.message : String(error))
    },

    setConvertDisabled(disabled) {
      convertBtn.disabled = disabled
    },

    setConversionProgress(ratio, text) {
      converting = true
      progressTrack.hidden = false
      progressPanel.hidden = false
      if (ratio === null) {
        progressFill.classList.add('indeterminate')
        progressFill.style.width = ''
        updateStatus(text)
      } else {
        progressFill.classList.remove('indeterminate')
        progressFill.style.width = `${Math.round(Math.min(100, Math.max(0, ratio * 100)))}%`
        updateStatus(text, ratio)
      }
    },

    setConversionProgressVisible(visible) {
      progressPanel.hidden = !visible
      if (!visible) {
        converting = false
        confirmOverlay.hidden = true
      }
    },

    downloadDerivativeFile(params) {
      const blob = base64ToBlob(params.base64, params.contentType)
      const url = URL.createObjectURL(blob)
      const anchor = el('a')
      anchor.href = url
      anchor.download = params.filename
      anchor.rel = 'noopener'
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    },

    close
  }
}
