import { describe, expect, it } from 'vitest'
import {
  asDisplayString,
  extractArray,
  readNodeId,
  readNodeLabel,
  toBomTree
} from '../services/api/parseTree'

describe('bom/parseTree', () => {
  it('extracts only object entries from arrays', () => {
    expect(extractArray([{ id: 1 }, null, 'bad', { id: 2 }])).toEqual([{ id: 1 }, { id: 2 }])
    expect(extractArray('not-an-array')).toEqual([])
  })

  it('resolves node ids from direct values, self links, and urns', () => {
    expect(readNodeId({ id: 14669 }, 'fallback')).toBe('14669')
    expect(readNodeId({ __self__: '/api/v3/workspaces/57/items/9123' }, 'fallback')).toBe('9123')
    expect(readNodeId({ __self__: { link: '/api/v3/workspaces/57/items/8123' } }, 'fallback')).toBe('8123')
    expect(readNodeId({ __self__: { urn: 'urn:adsk.plm:tenant.workspace.item:TEST.57.8124' } }, 'fallback')).toBe('8124')
    expect(readNodeId({ link: '/api/v3/workspaces/57/items/8125' }, 'fallback')).toBe('8125')
    expect(readNodeId({ urn: 'urn:adsk.plm:tenant.workspace.item:TEST.57.7001' }, 'fallback')).toBe('7001')
    expect(readNodeId({}, 'fallback')).toBe('fallback')
  })

  it('resolves readable labels and display strings from mixed payloads', () => {
    expect(readNodeLabel({ itemDescriptor: ' Assembly A ' }, 'Fallback')).toBe('Assembly A')
    expect(readNodeLabel({ descriptor: 'Descriptor Label' }, 'Fallback')).toBe('Descriptor Label')
    expect(readNodeLabel({ title: 'Title Label' }, 'Fallback')).toBe('Title Label')
    expect(readNodeLabel({ name: 'Name Label' }, 'Fallback')).toBe('Name Label')
    expect(readNodeLabel({}, 'Fallback')).toBe('Fallback')

    expect(asDisplayString({ title: 'Released' })).toBe('Released')
    expect(asDisplayString({ value: 42 })).toBe('42')
    expect(asDisplayString({ displayValue: 'Shown' })).toBe('Shown')
    expect(asDisplayString({ name: 'Named' })).toBe('Named')
    expect(asDisplayString(null)).toBe('')
  })

  it('builds a bom tree from nodes and edges with edge metadata', () => {
    const tree = toBomTree({
      data: {
        nodes: [
          {
            item: {
              id: 100,
              title: 'Root Assembly',
              urn: 'urn:adsk.plm:tenant.workspace.item:TEST.57.100'
            }
          },
          {
            item: {
              id: 200,
              title: 'Child Part',
              link: '/api/v3/workspaces/57/items/200',
              urn: 'urn:adsk.plm:tenant.workspace.item:TEST.57.200'
            }
          }
        ],
        edges: [
          {
            __self__: '/api/v3/workspaces/57/items/100/bom-items/555',
            parent: 'urn:adsk.plm:tenant.workspace.item:TEST.57.100',
            child: 'urn:adsk.plm:tenant.workspace.item:TEST.57.200',
            depth: 1,
            itemNumber: '2',
            lastNode: true,
            fields: [
              {
                metaData: { link: '/api/v3/workspaces/57/views/5/viewdef/10/fields/103' },
                value: '3'
              },
              {
                metaData: { link: '/api/v3/workspaces/57/views/5/viewdef/10/fields/104' },
                value: 'EA'
              },
              {
                metaData: { link: '/api/v3/workspaces/57/views/5/viewdef/10/fields/732' },
                value: '99-001'
              }
            ]
          }
        ]
      }
    })

    expect(tree).toHaveLength(1)
    expect(tree[0].label).toBe('Root Assembly')
    expect(tree[0].childrenLoaded).toBe(true)
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0]).toMatchObject({
      id: '200',
      label: 'Child Part',
      itemLink: '/api/v3/workspaces/57/items/200',
      itemNumber: '1.2',
      quantity: '3',
      unitOfMeasure: 'EA',
      bomEdgeId: '555'
    })
    expect(tree[0].children[0].bomFieldValues).toEqual({
      '103': '3',
      '104': 'EA',
      '732': '99-001'
    })
  })

  it('builds a tree from edge-only payloads and merges repeated edge field values', () => {
    const tree = toBomTree({
      data: {
        item: {
          id: 500,
          title: 'Root 500'
        },
        edges: [
          {
            parent: { id: 500, title: 'Root 500' },
            child: { __self__: { link: '/api/v3/workspaces/57/items/600' }, name: 'Child 600', link: '/api/v3/workspaces/57/items/600' },
            itemNumber: '8',
            lastNode: false,
            fields: {
              fields: [
                {
                  metaData: { urn: 'urn:adsk.plm:tenant.workspace.viewdef.field:TEST.57.103' },
                  value: '2'
                }
              ]
            }
          },
          {
            parent: { id: 500, title: 'Root 500' },
            child: { id: 600, title: 'Child 600' },
            fields: {
              '302': true,
              '104': 'EA'
            }
          }
        ]
      }
    })

    expect(tree).toHaveLength(1)
    expect(tree[0]).toMatchObject({
      id: '500',
      label: 'Root 500',
      hasExpandableChildren: true,
      childrenLoaded: true
    })
    expect(tree[0].children[0]).toMatchObject({
      id: '600',
      label: 'Child 600',
      itemLink: '/api/v3/workspaces/57/items/600',
      itemNumber: '8',
      quantity: '2',
      isPinned: true,
      hasExpandableChildren: true
    })
    expect(tree[0].children[0].bomFieldValues).toEqual({
      '103': '2',
      '104': 'EA',
      '302': 'true'
    })
  })
})
