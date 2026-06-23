import { describe, expect, it } from 'vitest'
import {
  appendTopLevelNode,
  collectExpandableNodeIds,
  collectTopLevelChildItemIdsFromTree,
  flattenNodesForDisplay,
  mergeTargetTreeWithStagedByOperation,
  removeTopLevelNodeById,
  resolveNodeItemId
} from '../services/structure/tree.service'
import type { BomCloneNode } from '../clone.types'

function createNode(overrides: Partial<BomCloneNode> & Pick<BomCloneNode, 'id' | 'label'>): BomCloneNode {
  return {
    id: overrides.id,
    label: overrides.label,
    number: overrides.number || overrides.id,
    itemNumber: overrides.itemNumber || overrides.id,
    iconHtml: overrides.iconHtml || '',
    revision: overrides.revision || '',
    status: overrides.status || '',
    quantity: overrides.quantity || '',
    unitOfMeasure: overrides.unitOfMeasure || '',
    hasExpandableChildren: overrides.hasExpandableChildren ?? false,
    childrenLoaded: overrides.childrenLoaded ?? true,
    children: overrides.children || [],
    bomFieldValues: overrides.bomFieldValues,
    itemLink: overrides.itemLink,
    splitSourceNodeId: overrides.splitSourceNodeId
  }
}

describe('bom/tree.service', () => {
  it('resolves item IDs from direct id, split source, or item link', () => {
    expect(resolveNodeItemId(createNode({ id: '14669', label: 'Direct' }))).toBe(14669)
    expect(resolveNodeItemId(createNode({ id: 'node-a', splitSourceNodeId: '7001', label: 'Split' }))).toBe(7001)
    expect(resolveNodeItemId(createNode({
      id: 'node-b',
      itemLink: '/api/v3/workspaces/57/items/9123',
      label: 'Linked'
    }))).toBe(9123)
    expect(resolveNodeItemId(createNode({ id: 'node-c', label: 'Missing' }))).toBeNull()
  })

  it('collects expandable node ids and flattens rows for display without the root row', () => {
    const tree = [
      createNode({
        id: 'root',
        label: 'Root',
        hasExpandableChildren: true,
        children: [
          createNode({
            id: 'child-1',
            label: 'Child 1',
            hasExpandableChildren: true,
            children: [createNode({ id: 'leaf-1', label: 'Leaf 1' })]
          }),
          createNode({ id: 'child-2', label: 'Child 2' })
        ]
      })
    ]

    const expandable = new Set<string>()
    collectExpandableNodeIds(tree, expandable)
    expect(Array.from(expandable)).toEqual(['root', 'child-1'])

    const rows = flattenNodesForDisplay(tree, new Set(['root', 'child-1']), 'root')
    expect(rows.map((row) => ({ id: row.id, level: row.level }))).toEqual([
      { id: 'child-1', level: 0 },
      { id: 'leaf-1', level: 1 },
      { id: 'child-2', level: 0 }
    ])
  })

  it('appends and removes top-level nodes under the target root', () => {
    const root = createNode({
      id: '100',
      label: 'Root',
      children: [createNode({ id: '200', label: 'Existing' })]
    })
    const appended = appendTopLevelNode([root], createNode({ id: '300', label: 'Added' }))
    expect(appended[0]!.children.map((node) => node.id)).toEqual(['200', '300'])

    const removed = removeTopLevelNodeById(appended, '200')
    expect(removed.removed).toBe(true)
    expect(removed.nextTree[0]!.children.map((node) => node.id)).toEqual(['300'])
  })

  it('merges staged nodes into operation buckets and preserves ordering by top-level item number', () => {
    const targetTree = [
      createNode({
        id: '100',
        label: 'Root',
        children: [
          createNode({ id: 'op-b', label: 'Operation B', itemNumber: '1.20', children: [] }),
          createNode({ id: 'op-a', label: 'Operation A', itemNumber: '1.10', children: [] })
        ]
      })
    ]
    const sourceTree = [
      createNode({
        id: 'source-root',
        label: 'Source Root',
        children: [createNode({ id: 'part-1', label: 'Part 1' })]
      })
    ]

    const merged = mergeTargetTreeWithStagedByOperation(
      targetTree,
      sourceTree,
      ['part-1'],
      { 'part-1': 'op-a' },
      null
    )

    expect(merged[0]!.children.map((node) => node.id)).toEqual(['op-a', 'op-b'])
    expect(merged[0]!.children[0]!.children.map((node) => node.id)).toEqual(['part-1'])
    expect(merged[0]!.children[0]!.children[0]!.children).toEqual([])
  })

  it('collects top-level child item ids while excluding the root item id', () => {
    const tree = [
      createNode({
        id: '57',
        label: 'Root',
        children: [
          createNode({ id: '14669', label: 'Direct child' }),
          createNode({ id: 'child-a', splitSourceNodeId: '20002', label: 'Split child' }),
          createNode({ id: 'child-b', itemLink: '/api/v3/workspaces/57/items/30003', label: 'Linked child' })
        ]
      })
    ]

    expect(collectTopLevelChildItemIdsFromTree(tree, 57)).toEqual([14669, 20002, 30003])
  })
})
