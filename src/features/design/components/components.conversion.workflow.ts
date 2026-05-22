import {
  derivativeDownloadFilename,
  downloadDerivativeAsset,
  downloadDerivativeThumbnail,
  getConversionManifest,
  submitConversionJob
} from './components.api'
import { parseManifestProgressRatio } from './components.conversion.progress'
import {
  DESIGN_COMPONENTS_MAX_POLL_ATTEMPTS,
  DESIGN_COMPONENTS_POLL_INTERVAL_MS
} from './components.constants'
import {
  findDerivativeForFormat,
  getManifestStatusLower,
  isManifestSuccess,
  isManifestTerminal,
  type ManifestNode
} from './components.manifest'
import type {
  ConversionJobManifest,
  DerivativeOutputType,
  DesignComponentsRuntime
} from './components.types'

/** Thrown when `AbortSignal` fires during polling or between steps (modal closed or view unmounted). */
export class ConversionWorkflowAbortedError extends Error {
  override readonly name = 'ConversionWorkflowAbortedError'

  constructor() {
    super('Cancelled.')
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/** Viewer-only formats: APS stores the result in the viewer, no file to download. */
const SVF_VIEWER_FORMATS = new Set<DerivativeOutputType>(['svf', 'svf2'])

function resolveFilename(override: string | undefined, baseName: string, format: DerivativeOutputType): string {
  return override?.trim() || derivativeDownloadFilename(baseName, format)
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new ConversionWorkflowAbortedError()
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    throwIfAborted(signal)
    const id = globalThis.setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      globalThis.clearTimeout(id)
      reject(new ConversionWorkflowAbortedError())
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

export type ConversionWorkflowCallbacks = {
  setProgress: (ratio: number | null, statusText: string) => void
  setSubmitting: () => void
  showSuccess: (message: string) => void
  showFailure: (message: string) => void
  downloadFile: (params: { base64: string; contentType: string; filename: string }) => void
}

async function finalizeWithDownload(params: {
  runtime: DesignComponentsRuntime
  encodedDesignUrn: string
  outputFormat: DerivativeOutputType
  designBaseName: string
  derivative: ManifestNode
  callbacks: ConversionWorkflowCallbacks
  filenameOverride?: string
}): Promise<void> {
  const { runtime, encodedDesignUrn, outputFormat, designBaseName, derivative, callbacks, filenameOverride } = params
  const derivativeUrn = typeof derivative.urn === 'string' ? derivative.urn.trim() : ''
  if (!derivativeUrn) {
    callbacks.showFailure('Derivative URN missing from manifest.')
    return
  }

  callbacks.setProgress(1, 'Downloading…')

  try {
    const file = await downloadDerivativeAsset(runtime, encodedDesignUrn, derivativeUrn)
    callbacks.downloadFile({
      base64: file.base64,
      contentType: file.contentType,
      filename: resolveFilename(filenameOverride, designBaseName, outputFormat)
    })
    callbacks.showSuccess('File downloaded.')
  } catch (error: unknown) {
    callbacks.showFailure(error instanceof Error ? error.message : String(error))
  }
}

export async function runModelDerivativeConversionWorkflow(params: {
  runtime: DesignComponentsRuntime
  encodedDesignUrn: string
  outputFormat: DerivativeOutputType
  designBaseName: string
  signal: AbortSignal
  callbacks: ConversionWorkflowCallbacks
  advancedOptions?: Record<string, string>
  filenameOverride?: string
  forceRetranslate?: boolean
}): Promise<void> {
  const { runtime, encodedDesignUrn, outputFormat, designBaseName, signal, callbacks, advancedOptions, filenameOverride, forceRetranslate } = params

  throwIfAborted(signal)
  callbacks.setSubmitting()
  await submitConversionJob(runtime, encodedDesignUrn, outputFormat, advancedOptions, forceRetranslate)
  throwIfAborted(signal)
  callbacks.setProgress(null, 'Translation scheduled…')

  const manifest = await pollManifestUntilTerminal(runtime, encodedDesignUrn, signal, (m) => {
    const fromAps = parseManifestProgressRatio(m.progress)
    const ratio = fromAps !== null && fromAps > 0 ? fromAps : null
    callbacks.setProgress(ratio, ratio !== null ? `Translating… ${String(m.progress || '').trim()}` : 'Translating…')
  })

  const status = getManifestStatusLower(manifest)

  if (status === 'failed') {
    callbacks.showFailure('Translation failed.')
    return
  }

  if (!isManifestSuccess(manifest)) {
    callbacks.showFailure(`Translation ended with unexpected status "${status}".`)
    return
  }

  if (outputFormat === 'thumbnail') {
    callbacks.setProgress(1, 'Downloading…')
    try {
      const file = await downloadDerivativeThumbnail(
        runtime,
        encodedDesignUrn,
        advancedOptions?.width,
        advancedOptions?.height
      )
      callbacks.downloadFile({
        base64: file.base64,
        contentType: file.contentType,
        filename: resolveFilename(filenameOverride, designBaseName, outputFormat)
      })
      callbacks.showSuccess('Thumbnail downloaded.')
    } catch (error: unknown) {
      callbacks.showFailure(error instanceof Error ? error.message : String(error))
    }
    return
  }

  const derivative = findDerivativeForFormat(manifest, outputFormat)
  if (!derivative) {
    callbacks.showFailure(`Translation succeeded but no "${outputFormat}" derivative was found in the manifest.`)
    return
  }

  if (SVF_VIEWER_FORMATS.has(outputFormat)) {
    callbacks.showSuccess('Translation complete. Open in Viewer to access the result.')
    return
  }

  await finalizeWithDownload({ runtime, encodedDesignUrn, outputFormat, designBaseName, derivative, callbacks, filenameOverride })
}

async function pollManifestUntilTerminal(
  runtime: DesignComponentsRuntime,
  encodedDesignUrn: string,
  signal: AbortSignal,
  onUpdate: (manifest: ConversionJobManifest, attemptIndex: number) => void
): Promise<ConversionJobManifest> {
  for (let attempt = 0; attempt < DESIGN_COMPONENTS_MAX_POLL_ATTEMPTS; attempt += 1) {
    throwIfAborted(signal)
    const manifest = await getConversionManifest(runtime, encodedDesignUrn)
    onUpdate(manifest, attempt)
    if (isManifestTerminal(manifest)) {
      return manifest
    }
    await sleep(DESIGN_COMPONENTS_POLL_INTERVAL_MS, signal)
  }
  throw new Error('Timed out waiting for conversion to finish.')
}
