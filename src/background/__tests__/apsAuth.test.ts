// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

function makeSessionMock() {
  const store: Record<string, unknown> = {}
  return {
    get: vi.fn(async (keys: string[]) =>
      Object.fromEntries(keys.map((k) => [k, store[k]]))
    ),
    set: vi.fn(async (values: Record<string, unknown>) => {
      Object.assign(store, values)
    }),
    _store: store
  }
}

describe('apsAuth', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('setApsToken stores normalized token and computes expiresAt', async () => {
    const session = makeSessionMock()
    vi.stubGlobal('chrome', { storage: { session } })
    const { setApsToken } = await import('../apsAuth')

    const before = Date.now()
    await setApsToken('eyJabc', 3600)
    const after = Date.now()

    expect(session.set).toHaveBeenCalledTimes(1)
    const stored = session.set.mock.calls[0]![0] as Record<string, unknown>
    expect(stored.apsAccessToken).toBe('eyJabc')
    const meta = stored.apsAccessTokenMeta as { expiresAt: number }
    expect(meta.expiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000)
    expect(meta.expiresAt).toBeLessThanOrEqual(after + 3600 * 1000)
  })

  it('setApsToken strips "Bearer " prefix', async () => {
    const session = makeSessionMock()
    vi.stubGlobal('chrome', { storage: { session } })
    const { setApsToken } = await import('../apsAuth')

    await setApsToken('Bearer my.token.here', 3600)

    const stored = session.set.mock.calls[0]![0] as Record<string, unknown>
    expect(stored.apsAccessToken).toBe('my.token.here')
  })

  it('ensureApsToken returns token when valid', async () => {
    const session = makeSessionMock()
    session._store['apsAccessToken'] = 'valid.token'
    session._store['apsAccessTokenMeta'] = {
      expiresAt: Date.now() + 3_600_000,
      updatedAt: Date.now()
    }
    vi.stubGlobal('chrome', { storage: { session } })
    const { ensureApsToken } = await import('../apsAuth')

    const token = await ensureApsToken()
    expect(token).toBe('valid.token')
  })

  it('ensureApsToken throws when token is missing', async () => {
    const session = makeSessionMock()
    vi.stubGlobal('chrome', { storage: { session } })
    const { ensureApsToken } = await import('../apsAuth')

    await expect(ensureApsToken()).rejects.toThrow('No APS token — open a Fusion Manage tab')
  })

  it('ensureApsToken throws when token is expired', async () => {
    const session = makeSessionMock()
    session._store['apsAccessToken'] = 'old.token'
    session._store['apsAccessTokenMeta'] = {
      expiresAt: Date.now() - 1000,
      updatedAt: Date.now() - 4000
    }
    vi.stubGlobal('chrome', { storage: { session } })
    const { ensureApsToken } = await import('../apsAuth')

    await expect(ensureApsToken()).rejects.toThrow(
      'APS token expired — switch to a Fusion Manage tab to refresh'
    )
  })

  it('ensureApsToken throws when meta is absent', async () => {
    const session = makeSessionMock()
    session._store['apsAccessToken'] = 'some.token'
    // apsAccessTokenMeta deliberately NOT set
    vi.stubGlobal('chrome', { storage: { session } })
    const { ensureApsToken } = await import('../apsAuth')

    await expect(ensureApsToken()).rejects.toThrow(
      'APS token expired — switch to a Fusion Manage tab to refresh'
    )
  })
})
