// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createItemSelectorService } from '../service'
import type { ItemSelectorContext, ItemSelectorSearchFilterGroup } from '../types'
import type { PlmExtRuntime } from '../../runtime/types'

type RequestMock = ReturnType<typeof vi.fn>

function createContext(overrides: Partial<ItemSelectorContext> = {}): ItemSelectorContext {
  return {
    tenant: 'test',
    workspaceId: 57,
    ...overrides
  }
}

function createAdvancedGroups(): ItemSelectorSearchFilterGroup[] {
  return [
    {
      groupId: 'group-1',
      joinWithNext: 'AND',
      filters: [
        {
          filterId: 'filter-1',
          fieldId: 'item_details:description',
          fieldLabel: 'Description',
          value: 'Rear Connector',
          operator: 'contains',
          joinWithNext: 'AND'
        }
      ]
    }
  ]
}

function createRuntime(requestPlmAction: RequestMock): Pick<PlmExtRuntime, 'requestPlmAction'> {
  return {
    requestPlmAction: requestPlmAction as unknown as PlmExtRuntime['requestPlmAction']
  }
}

describe('item selector service', () => {
  let requestPlmAction: RequestMock

  beforeEach(() => {
    document.body.innerHTML = ''
    requestPlmAction = vi.fn()
  })

  it('fetches workspace fields as deduped, sorted search fields', async () => {
    requestPlmAction.mockResolvedValueOnce([
      {
        __self__: '/api/v3/workspaces/57/fields/description',
        title: 'Description',
        section: { title: 'General' }
      },
      {
        __self__: '/api/v3/workspaces/57/fields/part_number',
        title: 'Part Number',
        section: { title: 'Mechanical' }
      },
      {
        __self__: '/api/v3/workspaces/57/fields/description',
        title: 'Description Duplicate',
        section: { title: 'General' }
      }
    ])

    const service = createItemSelectorService(createRuntime(requestPlmAction))
    const fields = await service.fetchWorkspaceFields(createContext())

    expect(requestPlmAction).toHaveBeenCalledWith('fetchFields', {
      tenant: 'test',
      workspaceId: 57
    })
    expect(fields).toEqual([
      { id: 'DESCRIPTION', label: 'Description', sectionLabel: 'General' },
      { id: 'PART_NUMBER', label: 'Part Number', sectionLabel: 'Mechanical' }
    ])
  })

  it('falls back to field names, section names, and non-array workspace payloads', async () => {
    requestPlmAction.mockResolvedValueOnce([
      {
        name: 'z_code',
        sectionName: 'Zulu'
      },
      {
        __self__: '/api/v3/workspaces/57/fields/custom%20field',
        name: 'custom field',
        section: { name: 'Alpha' }
      }
    ])

    const service = createItemSelectorService(createRuntime(requestPlmAction))
    const fields = await service.fetchWorkspaceFields(createContext())

    expect(fields).toEqual([
      { id: 'CUSTOM FIELD', label: 'custom field', sectionLabel: 'Alpha' },
      { id: 'Z_CODE', label: 'z_code', sectionLabel: 'Zulu' }
    ])
  })

  it('builds scoped searches and excludes the current item from results', async () => {
    requestPlmAction.mockResolvedValueOnce({
      data: {
        items: [
          {
            dmsId: 101,
            workspaceId: 57,
            descriptor: 'Rear Connector',
            version: 'A',
            title: 'Rear Connector'
          },
          {
            dmsId: 102,
            workspaceId: 57,
            descriptor: 'Current Item',
            version: 'B',
            title: 'Current Item'
          }
        ],
        totalCount: 2
      }
    })

    const service = createItemSelectorService(createRuntime(requestPlmAction))
    const result = await service.searchItems(
      createContext({ excludedItemId: 102 }),
      createAdvancedGroups(),
      0,
      25
    )

    expect(requestPlmAction).toHaveBeenCalledWith(
      'searchBulk',
      expect.objectContaining({
        tenant: 'test',
        offset: 0,
        limit: 25,
        query: 'ITEM_DETAILS:DESCRIPTION=Rear Connector+AND+workspaceId%3D57'
      })
    )
    expect(result).toEqual({
      items: [
        {
          id: 101,
          dmsId: 101,
          workspaceId: 57,
          descriptor: 'Rear Connector',
          revision: 'A',
          title: 'Rear Connector',
          itemUrn: undefined
        }
      ],
      totalResults: 1
    })
  })

  it('uses query overrides, keeps existing workspace scope, and normalizes fallback item shapes', async () => {
    requestPlmAction.mockResolvedValueOnce({
      items: [
        {
          __self__: '/api/v3/workspaces/57/items/301',
          title: 'Fallback Title',
          revision: 7
        },
        {
          __self__: '/api/v3/workspaces/57/items/not-a-number',
          title: 'Invalid item'
        }
      ],
      totalHits: 1
    })

    const service = createItemSelectorService(createRuntime(requestPlmAction))
    const result = await service.searchItems(
      createContext(),
      [],
      25,
      25,
      'descriptor=foo+AND+workspaceId%3D57'
    )

    expect(requestPlmAction).toHaveBeenCalledWith(
      'searchBulk',
      expect.objectContaining({
        query: 'descriptor=foo+AND+workspaceId%3D57',
        offset: 25,
        limit: 25
      })
    )
    expect(result).toEqual({
      items: [
        {
          id: 301,
          dmsId: 301,
          workspaceId: 57,
          descriptor: 'Fallback Title',
          revision: '7',
          title: 'Fallback Title',
          itemUrn: undefined
        }
      ],
      totalResults: 1
    })
  })

  it('filters hidden detail fields and hydrates image rows', async () => {
    requestPlmAction
      .mockResolvedValueOnce([
        {
          __self__: '/api/v3/workspaces/57/fields/hidden_field',
          title: 'Hidden Field',
          hidden: true,
          section: { title: 'General' }
        },
        {
          __self__: '/api/v3/workspaces/57/fields/image_field',
          title: 'Image Field',
          section: { title: 'General' },
          expanded: true
        }
      ])
      .mockResolvedValueOnce({
        sections: [
          {
            title: 'General',
            fields: [
              {
                __self__: '/api/v3/workspaces/57/fields/hidden_field',
                title: 'Hidden Field',
                value: 'Should not render'
              },
              {
                __self__: '/api/v3/workspaces/57/fields/image_field',
                title: 'Image Field',
                value: '{"link":"/api/v3/workspaces/57/items/100/field-values/image_field/image/22"}'
              }
            ]
          }
        ]
      })
      .mockResolvedValueOnce({
        dataUrl: 'data:image/png;base64,abc123'
      })

    const service = createItemSelectorService(createRuntime(requestPlmAction))
    await service.fetchWorkspaceFields(createContext())
    const details = await service.fetchItemDetails(createContext(), 100)

    expect(details).toEqual([
      {
        title: 'General',
        expandedByDefault: true,
        rows: [
          {
            label: 'Image Field',
            value: '-',
            isRichHtml: false,
            imageLink: '/api/v3/workspaces/57/items/100/field-values/image_field/image/22',
            imageDataUrl: 'data:image/png;base64,abc123'
          }
        ]
      }
    ])
  })

  it('falls back to flattened item detail rows when structured sections are unavailable', async () => {
    requestPlmAction.mockResolvedValueOnce({
      partNumber: 'A-100',
      attributes: {
        empty: null,
        values: ['one', { title: 'two' }]
      }
    })

    const service = createItemSelectorService(createRuntime(requestPlmAction))
    const details = await service.fetchItemDetails(createContext(), 200)

    expect(details).toEqual([
      {
        title: 'Item Details',
        rows: [
          { label: 'partNumber', value: 'A-100' },
          { label: 'attributes.empty', value: '-' },
          { label: 'attributes.values[0]', value: 'one' },
          { label: 'attributes.values[1].title', value: 'two' }
        ]
      }
    ])
  })

  it('keeps rendering details when image hydration fails and hides fields by title or visibility rules', async () => {
    requestPlmAction
      .mockResolvedValueOnce([
        {
          title: 'Title Hidden',
          visibility: 'NEVER',
          sectionTitle: 'General'
        },
        {
          __self__: '/api/v3/workspaces/57/fields/visible_field',
          title: 'Visible Field',
          visible: 'true',
          sectionTitle: 'General',
          collapsed: 'true'
        }
      ])
      .mockResolvedValueOnce({
        sections: [
          {
            title: 'General',
            fields: [
              {
                title: 'Title Hidden',
                value: 'drop me'
              },
              {
                __self__: '/api/v3/workspaces/57/fields/visible_field',
                title: 'Visible Field',
                value: '<p>Rich</p>'
              },
              {
                title: 'Image Only',
                value: [{ data: [{ link: '/api/v3/workspaces/57/items/100/field-values/photo/image/88' }] }]
              }
            ]
          }
        ]
      })
      .mockRejectedValueOnce(new Error('image failed'))

    const service = createItemSelectorService(createRuntime(requestPlmAction))
    await service.fetchWorkspaceFields(createContext())
    const details = await service.fetchItemDetails(createContext(), 100)

    expect(details).toEqual([
      {
        title: 'General',
        expandedByDefault: false,
        rows: [
          {
            label: 'Visible Field',
            value: '<p>Rich</p>',
            isRichHtml: true,
            imageLink: undefined,
            imageDataUrl: undefined
          },
          {
            label: 'Image Only',
            value: '-',
            isRichHtml: false,
            imageLink: '/api/v3/workspaces/57/items/100/field-values/photo/image/88',
            imageDataUrl: undefined
          }
        ]
      }
    ])
  })

  it('normalizes attachments and viewer URLs', async () => {
    requestPlmAction.mockResolvedValueOnce({
      attachments: [
        {
          id: 8351,
          resourceName: '002771.iam',
          version: 5,
          size: 6103181,
          url: 'https://bucket.example/file',
          type: {
            extension: '.dwf'
          }
        }
      ]
    })

    const service = createItemSelectorService(createRuntime(requestPlmAction))
    const attachments = await service.fetchItemAttachments(createContext(), 14669)

    expect(attachments).toEqual([
      {
        id: '8351',
        name: '002771.iam.dwf',
        resourceName: '002771.iam',
        extension: '.dwf',
        size: 6103181,
        version: '5',
        link: 'https://bucket.example/file',
        viewerUrl:
          'https://test.autodeskplm360.net/plm/fileViewer?itemUrn=urn%3Aadsk.plm%3Atenant.workspace.item%3ATEST.57.14669&fileUrn=urn%3Aadsk.plm%3Atenant.workspace.item.attachment%3ATEST.57.14669.8351'
      }
    ])
  })

  it('normalizes attachment payloads from data arrays with fallback ids and links', async () => {
    requestPlmAction.mockResolvedValueOnce({
      data: [
        {
          name: 'Loose Attachment',
          size: 'not-a-size',
          selfLink: '/api/v3/workspaces/57/items/200/attachments/1'
        }
      ]
    })

    const service = createItemSelectorService(createRuntime(requestPlmAction))
    const attachments = await service.fetchItemAttachments(createContext(), 200)

    expect(attachments).toEqual([
      {
        id: 'attachment-1',
        name: 'Loose Attachment',
        resourceName: 'Loose Attachment',
        extension: '',
        size: null,
        version: '-',
        link: '/api/v3/workspaces/57/items/200/attachments/1',
        viewerUrl:
          'https://test.autodeskplm360.net/plm/fileViewer?itemUrn=urn%3Aadsk.plm%3Atenant.workspace.item%3ATEST.57.200&fileUrn=urn%3Aadsk.plm%3Atenant.workspace.item.attachment%3ATEST.57.200.attachment-1'
      }
    ])
  })
})
