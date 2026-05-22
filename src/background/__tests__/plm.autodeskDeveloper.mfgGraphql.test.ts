import { afterEach, describe, expect, it, vi } from 'vitest'

describe('fetchMfgGraphQL', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('rejects a legacy raw query payload', async () => {
    const { fetchMfgGraphQL } = await import('../plm.autodeskDeveloper')
    await expect(
      fetchMfgGraphQL({
        operation: 'getModelSourceFile',
        query: 'query Evil { __typename }',
        variables: { modelId: 'm1' }
      })
    ).rejects.toThrow(/raw GraphQL query strings are not accepted/)
  })

  it('rejects unknown operation', async () => {
    const { fetchMfgGraphQL } = await import('../plm.autodeskDeveloper')
    await expect(
      fetchMfgGraphQL({
        operation: 'arbitraryOperation',
        variables: { modelId: 'm1' }
      })
    ).rejects.toThrow(/unsupported or missing operation/)
  })

  it('rejects variables with extra keys', async () => {
    const { fetchMfgGraphQL } = await import('../plm.autodeskDeveloper')
    await expect(
      fetchMfgGraphQL({
        operation: 'getModelSourceFile',
        variables: { modelId: 'm1', extra: 'x' }
      })
    ).rejects.toThrow(/must be \{ modelId \} only/)
  })

  it('posts the built-in query with session cookies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { model: { id: 'm1' } } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const { fetchMfgGraphQL } = await import('../plm.autodeskDeveloper')
    const out = await fetchMfgGraphQL({
      operation: 'getModelSourceFile',
      variables: { modelId: '  model-xyz  ' }
    })

    expect(out).toEqual({ data: { model: { id: 'm1' } } })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]
    expect((init as RequestInit).credentials).toBe('include')
    expect((init as RequestInit).headers).toEqual({ 'Content-Type': 'application/json' })
    const body = JSON.parse(String((init as RequestInit).body))
    expect(body.variables).toEqual({ modelId: 'model-xyz' })
    expect(String(body.query)).toContain('GetModelSourceFile')
    expect(String(body.query)).toContain('$modelId: ID!')
  })
})
