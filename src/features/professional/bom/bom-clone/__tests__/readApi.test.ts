// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createReadApi } from '../services/api/read'
import type { ApiClient } from '../services/api/client'
import type { BomCloneContext } from '../clone.types'

function createClient(overrides: Partial<ApiClient> = {}): ApiClient {
  return {
    getBom: vi.fn(),
    getBomFlat: vi.fn(),
    getBomViewFields: vi.fn(),
    getBomV1: vi.fn(),
    getBomViews: vi.fn(),
    fetchFields: vi.fn(),
    fetchSections: vi.fn(),
    createItem: vi.fn(),
    fetchBomLinkableItems: vi.fn(),
    addBomItem: vi.fn(),
    updateBomItem: vi.fn(),
    removeBomItem: vi.fn(),
    ...overrides
  }
}

function createContext(overrides: Partial<BomCloneContext> = {}): BomCloneContext {
  return {
    tenant: 'TEST',
    workspaceId: 57,
    currentItemId: 100,
    viewId: 5,
    viewDefId: 10,
    ...overrides
  }
}

describe('bom/readApi', () => {
  it('dedupes workspace bom view definition ids from context and api response', async () => {
    const client = createClient({
      getBomViews: vi.fn().mockResolvedValue({
        data: {
          bomViews: [
            { id: 10 },
            { id: 20 },
            { link: '/api/v3/workspaces/57/views/5/viewdef/30' }
          ]
        }
      })
    })

    const api = createReadApi({ client })
    const ids = await api.fetchWorkspaceBomViewDefIds(createContext())

    expect(ids).toEqual([10, 20, 30])
  })

  it('retries through v3, then v1, then v3 again before returning a parsed tree', async () => {
    const client = createClient({
      getBom: vi.fn()
        .mockRejectedValueOnce(new Error('bulk unavailable'))
        .mockResolvedValueOnce({
          data: {
            item: { id: 100, title: 'Root Assembly' },
            edges: [
              {
                parent: { id: 100, title: 'Root Assembly' },
                child: { id: 14669, title: 'Child Component', link: '/api/v3/workspaces/57/items/14669' },
                depth: 1,
                itemNumber: '1',
                lastNode: true,
                fields: [
                  {
                    metaData: { link: '/api/v3/workspaces/57/views/5/viewdef/10/fields/103' },
                    value: '2'
                  }
                ]
              }
            ]
          }
        }),
      getBomV1: vi.fn().mockRejectedValue(new Error('v1 unavailable'))
    })

    const api = createReadApi({ client })
    const tree = await api.fetchSourceBomStructure(createContext(), 100, { depth: 1 })

    expect(client.getBom).toHaveBeenCalledTimes(2)
    expect(client.getBomV1).toHaveBeenCalledTimes(1)
    expect(tree[0]!.label).toBe('Root Assembly')
    expect(tree[0]!.children[0]).toMatchObject({
      id: '14669',
      label: 'Child Component',
      quantity: '2'
    })
  })

  it('maps linkable item payloads into normalized rows', async () => {
    const client = createClient({
      fetchBomLinkableItems: vi.fn().mockResolvedValue({
        data: {
          items: [
            {
              item: {
                __self__: '/api/v3/workspaces/57/items/2001',
                descriptor: 'Assembly 2001'
              },
              workspace: { title: 'Buildings' },
              lifecycle: { title: 'Released' }
            }
          ],
          totalCount: 12,
          offset: 5,
          limit: 25
        }
      })
    })

    const api = createReadApi({ client })
    const result = await api.fetchLinkableItems(createContext(), { search: 'assembly', offset: 5, limit: 25 })

    expect(result).toEqual({
      items: [
        {
          id: 2001,
          label: 'Assembly 2001',
          workspace: 'Buildings',
          lifecycle: 'Released'
        }
      ],
      totalCount: 12,
      offset: 5,
      limit: 25
    })
  })

  it('merges bom trees across multiple view definitions and tolerates per-view failures', async () => {
    const client = createClient({
      getBom: vi.fn()
        .mockResolvedValueOnce({
          data: {
            item: { id: 100, title: 'Root Assembly' },
            edges: [
              {
                parent: { id: 100, title: 'Root Assembly' },
                child: { id: 2001, title: 'Child A', link: '/api/v3/workspaces/57/items/2001' },
                depth: 1,
                itemNumber: '1',
                lastNode: true
              }
            ]
          }
        })
        .mockRejectedValueOnce(new Error('bad view'))
        .mockResolvedValueOnce({
          data: {
            item: { id: 100, title: 'Root Assembly' },
            edges: [
              {
                parent: { id: 100, title: 'Root Assembly' },
                child: { id: 2002, title: 'Child B', link: '/api/v3/workspaces/57/items/2002' },
                depth: 1,
                itemNumber: '2',
                lastNode: true
              }
            ]
          }
        })
    })

    const api = createReadApi({ client, fetchConcurrency: 2 })
    const onViewLoad = vi.fn()
    const tree = await api.fetchSourceBomStructureAcrossViews(createContext(), 100, [10, 20, 30], onViewLoad)

    expect(onViewLoad).toHaveBeenCalledTimes(3)
    expect(tree[0]!.children.map((node) => node.id)).toEqual(['2001', '2002'])
  })

  it('validates linkable items from either nested data or root items payloads', async () => {
    const nestedClient = createClient({
      fetchBomLinkableItems: vi.fn().mockResolvedValue({
        data: {
          items: [{ dmsId: 500 }]
        }
      })
    })
    const nestedApi = createReadApi({ client: nestedClient })
    await expect(nestedApi.validateLinkableItem(createContext(), 500)).resolves.toBe(true)

    const rootClient = createClient({
      fetchBomLinkableItems: vi.fn().mockResolvedValue({
        items: [{ itemId: 300 }]
      })
    })
    const rootApi = createReadApi({ client: rootClient })
    await expect(rootApi.validateLinkableItem(createContext(), 999)).resolves.toBe(false)
  })

  it('builds the operation form definition from fetched fields and sections', async () => {
    const client = createClient({
      fetchFields: vi.fn().mockResolvedValue({
        fields: [
          {
            __self__: '/api/v3/workspaces/57/fields/description',
            name: 'DESCRIPTION',
            label: 'Description',
            displayOrder: 1,
            visibility: 'ALWAYS',
            editability: 'always',
            fieldValidators: [{ validatorName: 'required' }],
            type: { id: 4, title: 'Single Line Text' }
          }
        ]
      }),
      fetchSections: vi.fn().mockResolvedValue({
        sections: [
          {
            title: 'General',
            displayOrder: 1,
            fields: [{ type: 'FIELD', link: '/api/v3/workspaces/57/fields/description' }]
          }
        ]
      })
    })

    const api = createReadApi({ client })
    const result = await api.fetchOperationFormDefinition(createContext())

    expect(result.fields).toHaveLength(1)
    expect(result.fields[0]).toMatchObject({
      fieldId: 'description',
      title: 'Description',
      required: true
    })
    expect(result.sections).toEqual([
      {
        title: 'General',
        expandedByDefault: true,
        fieldIds: ['description']
      }
    ])
  })
})
