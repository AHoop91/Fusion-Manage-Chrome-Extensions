import { createCompactActionButton } from '../../professional/item-details/view/item-details.command-bar.view'
import {
  ConversionWorkflowAbortedError,
  runModelDerivativeConversionWorkflow
} from './components.conversion.workflow'
import {
  getConversionManifest,
  resolveDesignSourceForItem,
  resolveTranslationSources
} from './components.api'
import {
  DESIGN_COMPONENTS_ACTION_WRAPPER_ID,
  DESIGN_COMPONENTS_ICON_CLASS,
  FORMAT_OPTION_FIELDS
} from './components.constants'
import {
  ensureDesignComponentsStyles,
  getDesignComponentsStatusRowContainer,
  placeDesignComponentsWrapperAtRight,
  removeLegacyDesignComponentsButtons
} from './components.dom'
import { type ConversionModalApi, openConversionModal, removeConversionModal } from './components.modal'
import { findDerivativeForFormat } from './components.manifest'
import { toConversionState } from './components.state'
import type {
  ConversionJobManifest,
  DerivativeOutputType,
  DesignComponentsRuntime,
  DesignComponentsView,
  OutputFormatOption,
  SourceFileDescriptor
} from './components.types'

function wireConversionWorkflow(
  modal: ConversionModalApi,
  runtime: DesignComponentsRuntime,
  formatOptions: OutputFormatOption[],
  sourcePromise: Promise<SourceFileDescriptor>,
  manifestPromise?: Promise<ConversionJobManifest | null>
): void {
  let cachedManifest: ConversionJobManifest | null = null

  function syncForceForFormat(format: string): void {
    const hasExisting = cachedManifest
      ? findDerivativeForFormat(cachedManifest, format as DerivativeOutputType) !== null
      : false
    modal.setForceRetranslate(hasExisting)
  }

  modal.renderFormatList(
    formatOptions.map((opt) => ({ ...opt, fields: FORMAT_OPTION_FIELDS[opt.value] })),
    syncForceForFormat
  )
  modal.renderState(toConversionState('ready_to_convert'))

  manifestPromise?.then((manifest) => {
    if (modal.abortSignal.aborted) return
    cachedManifest = manifest
    const current = modal.getSelectedFormat()
    if (current) syncForceForFormat(current)
  }).catch(() => {})

  modal.onConvert(() => {
    const selectedFormat = modal.getSelectedFormat() as DerivativeOutputType
    if (!selectedFormat) {
      modal.renderState(toConversionState('error', 'Please choose an output format.'))
      return
    }

    void (async () => {
      try {
        modal.setConvertDisabled(true)
        modal.renderState(toConversionState('loading_source', 'Resolving design…'))

        const source = await sourcePromise
        const advancedOptions = modal.getAdvancedOptions()
        const filenameOverride = modal.getFilename()
        const forceRetranslate = modal.getForceRetranslate()

        await runModelDerivativeConversionWorkflow({
          runtime,
          encodedDesignUrn: source.encodedDesignUrn,
          outputFormat: selectedFormat,
          designBaseName: source.designName || source.resourceName || 'design',
          signal: modal.abortSignal,
          advancedOptions: Object.keys(advancedOptions).length > 0 ? advancedOptions : undefined,
          filenameOverride,
          forceRetranslate,
          callbacks: {
            setProgress: (ratio, message) => {
              modal.setConversionProgressVisible(true)
              modal.setConversionProgress(ratio, message)
              modal.renderState(toConversionState('polling', message))
            },
            setSubmitting: () => {
              modal.setConversionProgressVisible(true)
              modal.setConversionProgress(null, 'Submitting translation job…')
              modal.renderState(toConversionState('submitting'))
            },
            downloadFile: (file) => modal.downloadDerivativeFile(file),
            showSuccess: (message) => {
              modal.setConversionProgressVisible(false)
              modal.renderState(toConversionState('success', message))
            },
            showFailure: (message) => {
              modal.renderError(new Error(message))
            }
          }
        })
      } catch (error: unknown) {
        if (error instanceof ConversionWorkflowAbortedError) return
        modal.renderError(error)
      } finally {
        modal.setConvertDisabled(false)
      }
    })()
  })
}

async function openConversionFlow(runtime: DesignComponentsRuntime): Promise<void> {
  const modal = openConversionModal()
  modal.renderSourceLoading()
  try {
    const { designDetails, formatOptions } = await resolveTranslationSources(runtime, window.location.href)
    modal.renderDesignDetails(designDetails)

    const sourcePromise = resolveDesignSourceForItem(runtime, window.location.href)
    const manifestPromise = sourcePromise
      .then((source) => getConversionManifest(runtime, source.encodedDesignUrn))
      .catch(() => null)

    wireConversionWorkflow(modal, runtime, formatOptions, sourcePromise, manifestPromise)
  } catch (error: unknown) {
    modal.renderSourceError(error)
  }
}

function createTriggerButton(runtime: DesignComponentsRuntime): HTMLButtonElement {
  const btn = createCompactActionButton({
    title: 'Design',
    ariaLabel: 'Design',
    iconClassName: `zmdi zmdi-download ${DESIGN_COMPONENTS_ICON_CLASS}`,
    iconSizePx: 19,
    iconInlineStyle: 'font-size:19px;line-height:1;display:block;color:#4a5568;',
    buttonClassName: 'square-icon md-button md-ink-ripple',
    onClick: () => {
      void openConversionFlow(runtime)
    }
  })
  return btn
}

export function createDesignComponentsView(runtime: DesignComponentsRuntime): DesignComponentsView {
  let wrap: HTMLElement | null = null

  function mount(): void {
    if (wrap && !wrap.isConnected) wrap = null
    if (wrap?.isConnected) return

    const container = getDesignComponentsStatusRowContainer()
    if (!container) return

    ensureDesignComponentsStyles()
    removeLegacyDesignComponentsButtons()

    const existing = document.getElementById(DESIGN_COMPONENTS_ACTION_WRAPPER_ID)
    if (existing) {
      existing.className = 'menu-buttons'
      placeDesignComponentsWrapperAtRight(container, existing)
      wrap = existing
      return
    }

    const wrapper = document.createElement('div')
    wrapper.id = DESIGN_COMPONENTS_ACTION_WRAPPER_ID
    wrapper.className = 'menu-buttons'
    wrapper.appendChild(createTriggerButton(runtime))
    placeDesignComponentsWrapperAtRight(container, wrapper)
    wrap = wrapper
  }

  function update(): void {
    if (!wrap?.isConnected) {
      wrap = null
      mount()
      return
    }
    const container = getDesignComponentsStatusRowContainer()
    if (!container) return
    removeLegacyDesignComponentsButtons()
    placeDesignComponentsWrapperAtRight(container, wrap)
  }

  function unmount(): void {
    wrap?.remove()
    wrap = null
    removeConversionModal()
  }

  return { mount, update, unmount }
}
