// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ConversionWorkflowAbortedError,
  runModelDerivativeConversionWorkflow
} from '../components.conversion.workflow'
import type { ConversionJobManifest, DesignComponentsRuntime } from '../components.types'

describe('runModelDerivativeConversionWorkflow', () => {
  const noopCallbacks = {
    setProgress: vi.fn(),
    setSubmitting: vi.fn(),
    downloadFile: vi.fn(),
    showSuccess: vi.fn(),
    showFailure: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('rejects with ConversionWorkflowAbortedError when signal is already aborted', async () => {
    const ac = new AbortController()
    ac.abort()
    const runtime = { requestPlmAction: vi.fn() }

    await expect(
      runModelDerivativeConversionWorkflow({
        runtime,
        encodedDesignUrn: 'urn:test',
        outputFormat: 'stl',
        designBaseName: 'Part',
        signal: ac.signal,
        callbacks: noopCallbacks
      })
    ).rejects.toThrow(ConversionWorkflowAbortedError)

    expect(runtime.requestPlmAction).not.toHaveBeenCalled()
  })

  it('downloads when derivative already exists for format', async () => {
    const manifest = {
      status: 'success',
      derivatives: [
        {
          outputType: 'stl',
          status: 'success',
          children: [
            {
              type: 'resource',
              status: 'success',
              role: 'exportedFile',
              urn: 'urn:adsk.forge:derivative:stl'
            }
          ]
        }
      ]
    } as ConversionJobManifest

    const runtime = {
      requestPlmAction: vi.fn(async (action: string) => {
        if (action === 'submitModelDerivativeJob') return {}
        if (action === 'getModelDerivativeManifest') return manifest
        if (action === 'downloadModelDerivativeAsset') {
          return { base64: 'Zg==', contentType: 'application/octet-stream' }
        }
        throw new Error(`unexpected ${action}`)
      })
    } as DesignComponentsRuntime

    await runModelDerivativeConversionWorkflow({
      runtime,
      encodedDesignUrn: 'urn:test',
      outputFormat: 'stl',
      designBaseName: 'MyPart.f3d',
      signal: new AbortController().signal,
      callbacks: noopCallbacks
    })

    expect(runtime.requestPlmAction).toHaveBeenCalledWith('submitModelDerivativeJob', expect.any(Object))
    expect(runtime.requestPlmAction).toHaveBeenCalledWith('downloadModelDerivativeAsset', {
      urn: 'urn:test',
      derivativeUrn: 'urn:adsk.forge:derivative:stl'
    })
    expect(noopCallbacks.downloadFile).toHaveBeenCalled()
    expect(noopCallbacks.showSuccess).toHaveBeenCalled()
    expect(noopCallbacks.setSubmitting).toHaveBeenCalled()
  })

  it('aborts during poll sleep when signal aborts', async () => {
    vi.useFakeTimers()

    const runtime = {
      requestPlmAction: vi
        .fn()
        .mockResolvedValueOnce({ status: 'pending' })
        .mockResolvedValue({ status: 'pending' })
    } as DesignComponentsRuntime

    const ac = new AbortController()
    const runPromise = runModelDerivativeConversionWorkflow({
      runtime,
      encodedDesignUrn: 'urn:test',
      outputFormat: 'stl',
      designBaseName: 'P',
      signal: ac.signal,
      callbacks: noopCallbacks
    })

    for (let i = 0; i < 30; i += 1) {
      await Promise.resolve()
    }

    ac.abort()
    await expect(runPromise).rejects.toThrow(ConversionWorkflowAbortedError)
  })

  it('does not download before submit when manifest omits selected derivative', async () => {
    const manifest = {
      status: 'success',
      derivatives: []
    } as ConversionJobManifest

    const runtime = {
      requestPlmAction: vi.fn(async (action: string) => {
        if (action === 'getModelDerivativeManifest') return manifest
        if (action === 'submitModelDerivativeJob') {
          throw new Error('Model Derivative submit job HTTP 400: failed')
        }
        throw new Error(`unexpected action ${action}`)
      })
    } as DesignComponentsRuntime

    await expect(
      runModelDerivativeConversionWorkflow({
        runtime,
        encodedDesignUrn: 'urn:test',
        outputFormat: 'stl',
        designBaseName: 'P',
        signal: new AbortController().signal,
        callbacks: noopCallbacks
      })
    ).rejects.toThrow(/submit job/)

    expect(noopCallbacks.downloadFile).not.toHaveBeenCalled()
  })

  it('shows success without downloading for svf output', async () => {
    const callbacks = {
      setProgress:   vi.fn(),
      setSubmitting: vi.fn(),
      showSuccess:   vi.fn(),
      showFailure:   vi.fn(),
      downloadFile:  vi.fn()
    }

    const svfManifest = {
      status: 'success',
      progress: 'complete',
      derivatives: [
        {
          children: [
            {
              type: 'resource',
              status: 'success',
              role: 'svf',
              urn: 'urn:adsk.forge:derivative:svf'
            }
          ]
        }
      ]
    } as ConversionJobManifest

    const runtime = {
      requestPlmAction: vi.fn(async (action: string) => {
        if (action === 'submitModelDerivativeJob') return {}
        if (action === 'getModelDerivativeManifest') return svfManifest
        throw new Error(`unexpected ${action}`)
      })
    } as DesignComponentsRuntime

    const signal = new AbortController().signal

    await runModelDerivativeConversionWorkflow({
      runtime,
      encodedDesignUrn: 'urn-abc',
      outputFormat: 'svf',
      designBaseName: 'TestDesign',
      signal,
      callbacks
    })

    expect(callbacks.showSuccess).toHaveBeenCalledWith(
      expect.stringContaining('Translation complete')
    )
    expect(callbacks.downloadFile).not.toHaveBeenCalled()
  })
})
