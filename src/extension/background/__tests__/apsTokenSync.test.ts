import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

function makeChromeMock(sendMessage = vi.fn()) {
  return {
    runtime: { id: 'test-ext-id', sendMessage, lastError: undefined }
  }
}

describe('syncApsTokenToBackground', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('fetches /api/v3/token with credentials same-origin', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'tok', expiresIn: 3600 }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('chrome', makeChromeMock())

    const { syncApsTokenToBackground } = await import('../apsTokenSync')
    await syncApsTokenToBackground()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v3/token',
      expect.objectContaining({ credentials: 'same-origin' })
    )
  })

  it('sends AUTH_TOKEN_SYNC message with token and expiresIn', async () => {
    const sendMessage = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ accessToken: 'my.tok', expiresIn: 3600 }), { status: 200 })
      )
    )
    vi.stubGlobal('chrome', makeChromeMock(sendMessage))

    const { syncApsTokenToBackground } = await import('../apsTokenSync')
    await syncApsTokenToBackground()

    expect(sendMessage).toHaveBeenCalledWith({
      type: 'AUTH_TOKEN_SYNC',
      payload: { token: 'my.tok', expiresIn: 3600 }
    })
  })

  it('schedules refresh at (expiresIn - 300) * 1000 ms', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'tok', expiresIn: 3600 }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('chrome', makeChromeMock())

    const { syncApsTokenToBackground } = await import('../apsTokenSync')
    await syncApsTokenToBackground()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(3_300_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not send message when fetch throws', async () => {
    const sendMessage = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    vi.stubGlobal('chrome', makeChromeMock(sendMessage))

    const { syncApsTokenToBackground } = await import('../apsTokenSync')
    await syncApsTokenToBackground()

    expect(sendMessage).not.toHaveBeenCalled()
  })

  it('does not send message when fetch returns non-200', async () => {
    const sendMessage = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 }))
    )
    vi.stubGlobal('chrome', makeChromeMock(sendMessage))

    const { syncApsTokenToBackground } = await import('../apsTokenSync')
    await syncApsTokenToBackground()

    expect(sendMessage).not.toHaveBeenCalled()
  })
})
