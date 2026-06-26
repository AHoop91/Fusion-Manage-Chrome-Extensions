// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeChromeMock, makeChromeSendMessageMock } from '../../../test/mocks/chrome'

describe('ensureApsTokenSynced', () => {
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
    vi.stubGlobal('chrome', makeChromeMock(makeChromeSendMessageMock()))

    const { ensureApsTokenSynced } = await import('../apsTokenSync')
    await ensureApsTokenSynced()

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v3/token',
      expect.objectContaining({ credentials: 'same-origin' })
    )
  })

  it('sends AUTH_TOKEN_SYNC message with token and expiresIn', async () => {
    const sendMessage = vi.fn((_msg: unknown, cb?: (response: { ok: boolean }) => void) => {
      cb?.({ ok: true })
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ accessToken: 'my.tok', expiresIn: 3600 }), { status: 200 })
      )
    )
    vi.stubGlobal('chrome', makeChromeMock(sendMessage))

    const { ensureApsTokenSynced } = await import('../apsTokenSync')
    await ensureApsTokenSynced()

    expect(sendMessage).toHaveBeenCalledWith(
      {
        type: 'AUTH_TOKEN_SYNC',
        payload: { token: 'my.tok', expiresIn: 3600 }
      },
      expect.any(Function)
    )
  })

  it('deduplicates concurrent sync calls', async () => {
    let resolveFetch: (value: Response) => void = () => {}
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        })
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('chrome', makeChromeMock(makeChromeSendMessageMock()))

    const { ensureApsTokenSynced } = await import('../apsTokenSync')
    const first = ensureApsTokenSynced()
    const second = ensureApsTokenSynced()

    resolveFetch(new Response(JSON.stringify({ accessToken: 'tok', expiresIn: 3600 }), { status: 200 }))
    await Promise.all([first, second])

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('skips re-fetch while cached token is still fresh', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ accessToken: 'tok', expiresIn: 3600 }), { status: 200 })
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('chrome', makeChromeMock(makeChromeSendMessageMock()))

    const { ensureApsTokenSynced } = await import('../apsTokenSync')
    await ensureApsTokenSynced()
    await ensureApsTokenSynced()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('re-fetches when force option is set', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ accessToken: 'tok', expiresIn: 3600 }), { status: 200 })
      )
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('chrome', makeChromeMock(makeChromeSendMessageMock()))

    const { ensureApsTokenSynced } = await import('../apsTokenSync')
    await ensureApsTokenSynced()
    await ensureApsTokenSynced({ force: true })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws when fetch returns non-200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Unauthorized', { status: 401 })))
    vi.stubGlobal('chrome', makeChromeMock(makeChromeSendMessageMock()))

    const { ensureApsTokenSynced } = await import('../apsTokenSync')
    await expect(ensureApsTokenSynced()).rejects.toThrow('APS token fetch failed with status 401')
  })

  it('throws when background rejects AUTH_TOKEN_SYNC', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ accessToken: 'tok', expiresIn: 3600 }), { status: 200 })
      )
    )
    vi.stubGlobal(
      'chrome',
      makeChromeMock(vi.fn((_msg: unknown, cb?: (response: { ok: boolean; error?: string }) => void) => {
        cb?.({ ok: false, error: 'Untrusted sender' })
      }))
    )

    const { ensureApsTokenSynced } = await import('../apsTokenSync')
    await expect(ensureApsTokenSynced()).rejects.toThrow('Untrusted sender')
  })

  it('falls back to expiresIn 3600 when server returns expiresIn 0', async () => {
    const sendMessage = vi.fn((_msg: unknown, cb?: (response: { ok: boolean }) => void) => {
      cb?.({ ok: true })
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ accessToken: 'tok', expiresIn: 0 }), { status: 200 })
      )
    )
    vi.stubGlobal('chrome', makeChromeMock(sendMessage))

    const { ensureApsTokenSynced } = await import('../apsTokenSync')
    await ensureApsTokenSynced()

    expect(sendMessage).toHaveBeenCalledWith(
      {
        type: 'AUTH_TOKEN_SYNC',
        payload: { token: 'tok', expiresIn: 3600 }
      },
      expect.any(Function)
    )
  })
})

describe('syncApsTokenToBackground', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('schedules refresh at (expiresIn - 300) * 1000 ms', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ accessToken: 'tok', expiresIn: 3600 }), { status: 200 })
      )
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('chrome', makeChromeMock(makeChromeSendMessageMock()))

    const { syncApsTokenToBackground } = await import('../apsTokenSync')
    syncApsTokenToBackground()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await vi.advanceTimersByTimeAsync(3_300_000)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('does not send message when fetch throws, but schedules retry', async () => {
    const sendMessage = vi.fn()
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ accessToken: 'tok', expiresIn: 3600 }), { status: 200 })
        )
      )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('chrome', makeChromeMock(sendMessage))

    const { syncApsTokenToBackground } = await import('../apsTokenSync')
    syncApsTokenToBackground()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    expect(sendMessage).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(60_000)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })

  it('schedules retry after 60 seconds when fetch fails with non-200', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }))
      .mockImplementation(() =>
        Promise.resolve(
          new Response(JSON.stringify({ accessToken: 'tok', expiresIn: 3600 }), { status: 200 })
        )
      )
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('chrome', makeChromeMock(makeChromeSendMessageMock()))

    const { syncApsTokenToBackground } = await import('../apsTokenSync')
    syncApsTokenToBackground()
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    await vi.advanceTimersByTimeAsync(60_000)
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
  })
})
