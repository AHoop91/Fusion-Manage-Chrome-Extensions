import { describe, expect, it, vi } from 'vitest'
import type { PlmExtRuntime } from '../../../shared/runtime/types'

describe('shouldLoadLazyModule', () => {
  it('does not tier-gate shared loaders (e.g. grid)', async () => {
    vi.resetModules()
    const { shouldLoadLazyModule } = await import('../workspaceTierGate')
    const gridUrl = 'https://test.autodeskplm360.net/plm/workspaces/9/items/grid'
    expect(shouldLoadLazyModule('grid', gridUrl)).toBe(true)
    expect(shouldLoadLazyModule('tableaus', gridUrl)).toBe(true)
  })

  it('allows tier-gated loaders when tier resolves to professional after failed fetch', async () => {
    vi.resetModules()
    const {
      prepareWorkspaceTierForUrl,
      shouldLoadLazyModule,
      getWorkspaceFeatureTierForCurrentUrl
    } = await import('../workspaceTierGate')

    const runtime = {
      requestPlmAction: vi.fn().mockRejectedValue(new Error('auth'))
    } as unknown as PlmExtRuntime
    const workspaceUrl = 'https://test.autodeskplm360.net/plm/workspaces/9/items/itemDetails?itemId=x%2Cy%2Cz'

    await prepareWorkspaceTierForUrl(runtime, workspaceUrl)
    expect(getWorkspaceFeatureTierForCurrentUrl(workspaceUrl)).toBe('professional')
    expect(shouldLoadLazyModule('itemDetails', workspaceUrl)).toBe(true)
  })

  it('loads item-details/BOM only for professional workspaces when tier is resolved', async () => {
    vi.resetModules()
    const { prepareWorkspaceTierForUrl, shouldLoadLazyModule } = await import('../workspaceTierGate')

    const designRuntime = {
      requestPlmAction: vi.fn().mockResolvedValue({ systemName: 'CW_COMPONENTS' })
    } as unknown as PlmExtRuntime
    const professionalRuntime = {
      requestPlmAction: vi.fn().mockResolvedValue({ systemName: 'OTHER_WS' })
    } as unknown as PlmExtRuntime

    const itemUrl = 'https://test.autodeskplm360.net/plm/workspaces/9/items/itemDetails?itemId=a%2Cb%2Cc'

    await prepareWorkspaceTierForUrl(designRuntime, itemUrl)
    expect(shouldLoadLazyModule('itemDetails', itemUrl)).toBe(false)
    expect(shouldLoadLazyModule('bom', itemUrl)).toBe(false)

    vi.resetModules()
    const gate2 = await import('../workspaceTierGate')
    await gate2.prepareWorkspaceTierForUrl(professionalRuntime, itemUrl)
    expect(gate2.shouldLoadLazyModule('itemDetails', itemUrl)).toBe(true)
    expect(gate2.shouldLoadLazyModule('bom', itemUrl)).toBe(true)
  })

  it('flags CW_COMPONENTS for design-only surfaces', async () => {
    vi.resetModules()
    const { prepareWorkspaceTierForUrl, isCwComponentsWorkspaceForUrl } = await import('../workspaceTierGate')

    const runtime = {
      requestPlmAction: vi.fn().mockResolvedValue({ systemName: 'CW_COMPONENTS' })
    } as unknown as PlmExtRuntime
    const url = 'https://test.autodeskplm360.net/plm/workspaces/9/items/itemDetails?itemId=a'

    await prepareWorkspaceTierForUrl(runtime, url)
    expect(isCwComponentsWorkspaceForUrl(url)).toBe(true)
  })

  it('does not flag CW_DRAWINGS as CW_COMPONENTS', async () => {
    vi.resetModules()
    const { prepareWorkspaceTierForUrl, isCwComponentsWorkspaceForUrl } = await import('../workspaceTierGate')

    const runtime = {
      requestPlmAction: vi.fn().mockResolvedValue({ systemName: 'CW_DRAWINGS' })
    } as unknown as PlmExtRuntime
    const url = 'https://test.autodeskplm360.net/plm/workspaces/9/items/itemDetails?itemId=a'

    await prepareWorkspaceTierForUrl(runtime, url)
    expect(isCwComponentsWorkspaceForUrl(url)).toBe(false)
  })
})
