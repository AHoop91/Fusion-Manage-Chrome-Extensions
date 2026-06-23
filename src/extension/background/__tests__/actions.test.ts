// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

const ensureApsTokenSynced = vi.fn().mockResolvedValue(undefined)
const sendRuntimeMessage = vi.fn()

vi.mock('../apsTokenSync', () => ({
  ensureApsTokenSynced
}))

vi.mock('../../messaging/runtimeClient', () => ({
  sendRuntimeMessage
}))

describe('requestPlmAction', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('awaits APS token sync before APS actions', async () => {
    sendRuntimeMessage.mockResolvedValue({ ok: true, data: { model: null } })

    const { requestPlmAction } = await import('../actions')
    await requestPlmAction('fetchMfgGraphQL', { operation: 'GetModel' })

    expect(ensureApsTokenSynced).toHaveBeenCalledBefore(sendRuntimeMessage)
    expect(ensureApsTokenSynced).toHaveBeenCalledTimes(1)
  })

  it('does not sync token before non-APS actions', async () => {
    sendRuntimeMessage.mockResolvedValue({ ok: true, data: [] })

    const { requestPlmAction } = await import('../actions')
    await requestPlmAction('getBom', { workspaceId: 1 })

    expect(ensureApsTokenSynced).not.toHaveBeenCalled()
    expect(sendRuntimeMessage).toHaveBeenCalledTimes(1)
  })
})
