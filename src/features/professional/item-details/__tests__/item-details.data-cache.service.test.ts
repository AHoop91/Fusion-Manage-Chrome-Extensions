// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://test.autodeskplm360.net/"}

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getTenantFromPlmHost } from '../../../../shared/url/parse'
import {
  getCachedItemDetails,
  getCachedItemDetailsForCurrentPage,
  getCachedWorkspaceTitle,
  getCurrentItemContextFromLocation,
  loadItemDetails,
  loadItemDetailsForCurrentPage,
  loadWorkspaceTitleMap
} from '../services/item-details.data-cache.service'
import type { ItemDetailsRuntime } from '../item-details.types'

function createRuntime(
  requestPlmAction: ItemDetailsRuntime['requestPlmAction']
): ItemDetailsRuntime {
  return {
    registerPage: vi.fn(),
    isItemDetailsPage: vi.fn(),
    isAddItemPage: vi.fn(),
    findByIdDeep: vi.fn(),
    getLocalOptions: vi.fn(),
    setLocalOptions: vi.fn(),
    requestPlmAction
  }
}

describe('item-details data cache service', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/plm/workspaces/57/items/itemDetails?itemId=ITEM,57,200')
  })

  it('parses tenant and current item context from location strings', () => {
    expect(getTenantFromPlmHost('https://test.autodeskplm360.net/plm/workspaces/57/items/itemDetails?itemId=ITEM,57,200')).toBe('TEST')
    expect(getTenantFromPlmHost('not-a-url')).toBeNull()
    expect(getCurrentItemContextFromLocation('https://test.autodeskplm360.net/plm/workspaces/57/items/itemDetails?itemId=ITEM,57,200')).toEqual({
      workspaceId: 57,
      dmsId: 200
    })
  })

  it('loads and caches item details, including current-page lookup reuse', async () => {
    const ext = createRuntime(
      vi.fn(async () => ({ sections: [{ title: 'Details' }] })) as unknown as ItemDetailsRuntime['requestPlmAction']
    )
    const tenant = 'TEST'
    const context = { workspaceId: 57, dmsId: 200 }

    const first = await loadItemDetails(ext, tenant, context)
    const second = await loadItemDetails(ext, tenant, context)

    expect(first).toEqual({ sections: [{ title: 'Details' }] })
    expect(second).toBe(first)
    expect(getCachedItemDetails(tenant, context)).toBe(first)
    expect(getCachedItemDetailsForCurrentPage()).toBe(first)
    expect(ext.requestPlmAction).toHaveBeenCalledTimes(1)
  })

  it('deduplicates in-flight workspace title requests and caches results', async () => {
    const ext = createRuntime((vi.fn(async (_action: string, payload: { offset: number }) => {
        if (payload.offset === 0) {
          return {
            items: [
              { link: '/api/v3/workspaces/57', title: 'Engineering' },
              { link: '/api/v3/workspaces/88', title: 'Manufacturing' }
            ]
          }
        }
        return { items: [] }
      }) as unknown) as ItemDetailsRuntime['requestPlmAction'])

    const [first, second] = await Promise.all([
      loadWorkspaceTitleMap(ext, 'TEST'),
      loadWorkspaceTitleMap(ext, 'TEST')
    ])

    expect(first).toEqual(new Map([
      [57, 'Engineering'],
      [88, 'Manufacturing']
    ]))
    expect(second).toEqual(first)
    expect(getCachedWorkspaceTitle('TEST', 57)).toBe('Engineering')
    expect(ext.requestPlmAction).toHaveBeenCalledTimes(1)
  })

  it('returns null when current-page context is missing and when item detail loads fail', async () => {
    const ext = createRuntime((vi.fn(async () => {
        throw new Error('boom')
      }) as unknown) as ItemDetailsRuntime['requestPlmAction'])

    window.history.replaceState({}, '', '/plm/nope')
    expect(getCachedItemDetailsForCurrentPage()).toBeNull()
    expect(await loadItemDetailsForCurrentPage(ext)).toBeNull()

    window.history.replaceState({}, '', '/plm/workspaces/57/items/itemDetails?itemId=ITEM,57,201')
    expect(await loadItemDetails(ext, 'TEST', { workspaceId: 57, dmsId: 201 })).toBeNull()
    expect(getCachedItemDetails('TEST', { workspaceId: 57, dmsId: 201 })).toBeNull()
  })

  it('continues paging workspace titles until a short page is returned and ignores invalid entries', async () => {
    const ext = createRuntime((vi.fn(async (_action: string, payload: { offset: number; limit: number }) => {
        if (payload.offset === 0) {
          return {
            items: Array.from({ length: payload.limit }, (_, index) => ({
              link: `/api/v3/workspaces/${index + 1}`,
              title: `Workspace ${index + 1}`
            }))
          }
        }

        return {
          items: [
            { link: '/api/v3/workspaces/999', title: 'Final Workspace' },
            { link: '/api/v3/not-workspaces/123', title: 'Ignore Me' },
            { link: '/api/v3/workspaces/1000', title: '   ' }
          ]
        }
      }) as unknown) as ItemDetailsRuntime['requestPlmAction'])

    const titles = await loadWorkspaceTitleMap(ext, 'OTHER')

    expect(titles.get(1)).toBe('Workspace 1')
    expect(titles.get(250)).toBe('Workspace 250')
    expect(titles.get(999)).toBe('Final Workspace')
    expect(titles.has(1000)).toBe(false)
    expect(ext.requestPlmAction).toHaveBeenCalledTimes(2)
  })
})
