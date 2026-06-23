// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { toBomTreeV1 } from '../services/api/parseTreeV1'

describe('bom/api parseTreeV1', () => {
  it('parses legacy V1 BOM payloads into a rooted tree with field values and load state', () => {
    const tree = toBomTreeV1({
      item: { descriptor: 'Top Assembly [REV:A]' },
      payload: {
        list: {
          data: [
            {
              'bom-item': {
                bomDepthLevel: 1,
                dmsID: 2001,
                descriptor: 'Sub Assembly',
                itemNumber: '1',
                assembly: 'true',
                leaf: 'false',
                revision: 'A',
                lifecycleStatus: 'Released',
                formattedQuantity: '2.0',
                units: 'EA',
                fields: {
                  entry: {
                    key: 'PIN',
                    fieldData: { formattedValue: 'Pinned' }
                  }
                }
              }
            },
            {
              'bom-item': {
                bomDepthLevel: 2,
                dmsID: 3001,
                descriptor: 'Leaf Part',
                itemNumber: '1',
                assembly: 'false',
                leaf: 'true',
                quantity: '4',
                units: 'EA',
                fields: {
                  entry: [
                    {
                      key: 'DESCRIPTION',
                      fieldData: { label: 'Leaf Part Description' }
                    }
                  ]
                }
              }
            }
          ]
        }
      }
    }, {
      workspaceId: 57,
      rootItemId: 1000,
      depth: 1
    })

    expect(tree).toHaveLength(1)
    expect(tree[0]).toMatchObject({
      id: '1000',
      label: 'Top Assembly [REV:A]',
      itemLink: '/api/v3/workspaces/57/items/1000',
      itemNumber: '0.0',
      hasExpandableChildren: true,
      childrenLoaded: true
    })
    expect(tree[0]!.children[0]).toMatchObject({
      id: '2001',
      label: 'Sub Assembly',
      itemNumber: '1.1',
      revision: 'A',
      status: 'Released',
      quantity: '2.0',
      unitOfMeasure: 'EA',
      hasExpandableChildren: true,
      childrenLoaded: true,
      bomFieldValues: {
        PIN: 'Pinned'
      }
    })
    expect(tree[0]!.children[0]!.children[0]).toMatchObject({
      id: '3001',
      label: 'Leaf Part',
      itemNumber: '2.1',
      quantity: '4',
      unitOfMeasure: 'EA',
      hasExpandableChildren: false,
      childrenLoaded: true,
      bomFieldValues: {
        DESCRIPTION: 'Leaf Part Description'
      }
    })
  })

  it('falls back cleanly when legacy payload sections are sparse or malformed', () => {
    const tree = toBomTreeV1([
      {
        bomDepthLevel: 1,
        itemId: 4001,
        descriptor: '',
        assembly: 'false',
        leaf: 'true'
      },
      {
        bomDepthLevel: 1,
        itemId: 0,
        descriptor: 'Ignored'
      }
    ], {
      workspaceId: 57,
      rootItemId: 999,
      depth: 2
    })

    expect(tree[0]).toMatchObject({
      id: '999',
      label: 'Item 999'
    })
    expect(tree[0]!.children).toEqual([
      expect.objectContaining({
        id: '4001',
        label: 'Item 4001',
        itemLink: '/api/v3/workspaces/57/items/4001',
        children: []
      })
    ])
  })
})
