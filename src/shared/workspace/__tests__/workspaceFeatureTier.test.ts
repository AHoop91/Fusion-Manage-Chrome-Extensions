// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { fetchWorkspaceTierSnapshot, isDesignWorkspaceSystemName } from '../workspaceFeatureTier'

describe('isDesignWorkspaceSystemName', () => {
  it('matches CW_COMPONENTS and CW_DRAWINGS case-insensitively', () => {
    expect(isDesignWorkspaceSystemName('CW_COMPONENTS')).toBe(true)
    expect(isDesignWorkspaceSystemName('cw_components')).toBe(true)
    expect(isDesignWorkspaceSystemName('CW_DRAWINGS')).toBe(true)
    expect(isDesignWorkspaceSystemName('CW_DRAWINGS ')).toBe(true)
  })

  it('returns false for other workspaces', () => {
    expect(isDesignWorkspaceSystemName('CW_OTHER')).toBe(false)
    expect(isDesignWorkspaceSystemName('')).toBe(false)
  })
})

describe('fetchWorkspaceTierSnapshot', () => {
  it('returns design when API returns CW_COMPONENTS', async () => {
    const runtime = {
      requestPlmAction: vi.fn().mockResolvedValue({ systemName: 'CW_COMPONENTS' })
    }
    await expect(fetchWorkspaceTierSnapshot(runtime, 'TEST', 57)).resolves.toEqual({
      tier: 'design',
      systemNameUpper: 'CW_COMPONENTS'
    })
    expect(runtime.requestPlmAction).toHaveBeenCalledWith('fetchApiJson', {
      tenant: 'TEST',
      path: '/api/v3/workspaces/57'
    })
  })

  it('returns design when API returns CW_DRAWINGS', async () => {
    const runtime = {
      requestPlmAction: vi.fn().mockResolvedValue({ systemName: 'CW_DRAWINGS' })
    }
    await expect(fetchWorkspaceTierSnapshot(runtime, 'TEST', 58)).resolves.toEqual({
      tier: 'design',
      systemNameUpper: 'CW_DRAWINGS'
    })
  })

  it('returns professional for any other systemName', async () => {
    const runtime = {
      requestPlmAction: vi.fn().mockResolvedValue({ systemName: 'INVENTORY' })
    }
    await expect(fetchWorkspaceTierSnapshot(runtime, 'TEST', 59)).resolves.toEqual({
      tier: 'professional',
      systemNameUpper: 'INVENTORY'
    })
  })

  it('returns professional on API failure', async () => {
    const runtime = {
      requestPlmAction: vi.fn().mockRejectedValue(new Error('network'))
    }
    await expect(fetchWorkspaceTierSnapshot(runtime, 'TEST', 1)).resolves.toEqual({
      tier: 'professional',
      systemNameUpper: ''
    })
  })

  it('returns tier and normalized system name', async () => {
    const runtime = {
      requestPlmAction: vi.fn().mockResolvedValue({ systemName: 'cw_components' })
    }
    await expect(fetchWorkspaceTierSnapshot(runtime, 'T', 1)).resolves.toEqual({
      tier: 'design',
      systemNameUpper: 'CW_COMPONENTS'
    })
  })
})
