// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const httpRequest = vi.fn()

vi.mock('../http', () => ({
  httpRequest: (...args: unknown[]) => httpRequest(...args)
}))

describe('searchBulk', () => {
  beforeEach(() => {
    httpRequest.mockReset()
    httpRequest.mockResolvedValue({ items: [] })
  })

  it('passes the PLM search query without encoding DSL operators', async () => {
    const { searchBulk } = await import('../plm.misc')
    const query = 'ITEM_DETAILS:DESCRIPTION=Rear Connector+AND+workspaceId%3D57'

    await searchBulk({
      tenant: 'test',
      query,
      limit: 25,
      offset: 0,
      bulk: false
    })

    expect(httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining(`query=${query}`)
      })
    )
    const url = String(httpRequest.mock.calls[0]?.[0]?.url ?? '')
    expect(url).not.toContain('%2BAND%2B')
    expect(url).not.toContain('%253D')
  })
})
