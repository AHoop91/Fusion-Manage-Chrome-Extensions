import { vi } from 'vitest'

type SendMessageCallback = (response?: unknown) => void

export function makeChromeMock(sendMessage = vi.fn()) {
  return {
    runtime: { id: 'test-ext-id', sendMessage, lastError: undefined }
  }
}

export function makeChromeSendMessageMock(
  onSend?: (msg: unknown, callback: SendMessageCallback) => void
) {
  return vi.fn((msg: unknown, callback: SendMessageCallback) => {
    if (onSend) {
      onSend(msg, callback)
      return
    }
    callback({ ok: true })
  })
}
