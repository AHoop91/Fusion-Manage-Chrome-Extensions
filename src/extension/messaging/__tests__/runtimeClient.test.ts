// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeChromeMock } from '../../../test/mocks/chrome'

type SendMessageCallback = (response?: unknown) => void

describe('sendMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('rejects with a timeout error when the callback is never called within timeoutMs', async () => {
    // sendMessage that never calls its callback
    const sendMessageMock = vi.fn()
    vi.stubGlobal('chrome', makeChromeMock(sendMessageMock))

    const { sendMessage } = await import('../runtimeClient')

    const promise = sendMessage({ type: 'TEST' }, 500)
    // Attach rejection handler BEFORE advancing timers to avoid unhandled rejection warnings
    const rejection = expect(promise).rejects.toThrow('sendMessage timed out after 500ms')

    await vi.advanceTimersByTimeAsync(500)

    await rejection
  })

  it('resolves and clears the timer when the callback is called within the timeout', async () => {
    const sendMessageMock = vi.fn((
      _msg: unknown,
      callback: SendMessageCallback
    ) => {
      // Simulate an immediate response
      callback({ result: 'ok' })
    })
    vi.stubGlobal('chrome', makeChromeMock(sendMessageMock))

    const { sendMessage } = await import('../runtimeClient')

    const promise = sendMessage<{ type: string }, { result: string }>({ type: 'TEST' }, 500)

    const result = await promise

    expect(result).toEqual({ result: 'ok' })

    // Advance past the timeout — promise should already be resolved, no rejection
    await vi.advanceTimersByTimeAsync(500)

    // Confirm the resolved value is still correct (no second settle)
    await expect(Promise.resolve(result)).resolves.toEqual({ result: 'ok' })
  })

  it('rejects with extension context error when chrome.runtime.id is absent', async () => {
    vi.stubGlobal('chrome', { runtime: { id: undefined, sendMessage: vi.fn(), lastError: undefined } })

    const { sendMessage } = await import('../runtimeClient')

    await expect(sendMessage({ type: 'TEST' })).rejects.toThrow('Extension context is unavailable')
  })

  it('rejects with lastError message when chrome sets runtime.lastError', async () => {
    const sendMessageMock = vi.fn((
      _msg: unknown,
      callback: SendMessageCallback
    ) => {
      callback(undefined)
    })
    const chromeMock = {
      runtime: {
        id: 'test-ext-id',
        sendMessage: sendMessageMock,
        lastError: { message: 'Could not establish connection.' }
      }
    }
    vi.stubGlobal('chrome', chromeMock)

    const { sendMessage } = await import('../runtimeClient')

    await expect(sendMessage({ type: 'TEST' })).rejects.toThrow('Could not establish connection.')
  })
})
