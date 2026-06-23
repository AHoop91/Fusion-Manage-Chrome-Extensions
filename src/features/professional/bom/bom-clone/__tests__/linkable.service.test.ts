import { describe, expect, it, vi } from 'vitest'
import {
  addSelectedLinkableItemsToSourceTree,
  resolveFilteredLinkableItems,
  resolveMergedLinkableItems,
  resolveOnTargetBomItemIdsForDialog,
  resolvePreselectedLinkableItemIds,
  resolveSanitizedSelectedLinkableIds
} from '../services/linkable.service'
import type { BomCloneLinkableItem, BomCloneNode } from '../clone.types'

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
    fromLinkableDialog: overrides.fromLinkableDialog
  }
}

describe('bom/linkable.service', () => {
  it('resolves preselected and on-target linkable item ids from the tree state', () => {
    const sourceBomTree = [
      createNode({
        id: 'root',
        label: 'Root',
        children: [
          createNode({
            id: '1001',
            label: 'Existing',
            number: '1001',
            itemLink: '/api/v3/workspaces/57/items/1001'
          }),
          createNode({
            id: 'staged-linkable',
            label: 'Linkable Child',
            number: '2002',
            itemLink: '/api/v3/workspaces/57/items/2002',
            fromLinkableDialog: true
          })
        ]
      })
    ]

    expect(resolvePreselectedLinkableItemIds({
      sourceBomTree,
      selectedNodesToClone: ['root', '1001', 'staged-linkable']
    })).toEqual([1001, 2002])

    expect(resolveOnTargetBomItemIdsForDialog({
      targetBomPreExistingItemIds: [3003],
      selectedNodesToClone: ['staged-linkable'],
      sourceBomTree
    })).toEqual([3003, 2002])
  })

  it('filters, merges, and sanitizes linkable item selections', () => {
    const existing: BomCloneLinkableItem[] = [
      { id: 1, label: 'Assembly A', workspace: 'WS', lifecycle: 'Released' }
    ]
    const incoming: BomCloneLinkableItem[] = [
      { id: 1, label: 'Assembly A Updated', workspace: 'WS', lifecycle: 'Released' },
      { id: 2, label: 'Assembly B', workspace: 'WS', lifecycle: 'Draft' }
    ]

    expect(resolveFilteredLinkableItems(incoming, 2, 1)).toEqual([])
    expect(resolveMergedLinkableItems(existing, incoming)).toEqual([
      { id: 1, label: 'Assembly A Updated', workspace: 'WS', lifecycle: 'Released' },
      { id: 2, label: 'Assembly B', workspace: 'WS', lifecycle: 'Draft' }
    ])
    expect(resolveSanitizedSelectedLinkableIds(incoming, [1, 3, 2])).toEqual([1, 2])
  })

  it('adds selected linkable items in batches, tracks progress, and surfaces item errors', async () => {
    const progress = vi.fn()
    const itemError = vi.fn()
    const fetchSourceBomStructure = vi.fn(async (itemId: number) => {
      if (itemId === 20) return []
      if (itemId === 30) {
        return [
          createNode({
            id: '30',
            label: 'Item 30',
            number: '30',
            children: []
          })
        ]
      }
      if (itemId === 40) throw new Error('network')
      return [
        createNode({
          id: String(itemId),
          label: `Loaded ${itemId}`,
          number: String(itemId),
          quantity: '',
          children: [createNode({ id: `${itemId}-child`, label: `Child ${itemId}` })]
        })
      ]
    })

    const result = await addSelectedLinkableItemsToSourceTree({
      sourceTree: [createNode({ id: 'root', label: 'Root', children: [] })],
      selectedNodeIds: [],
      selectedLinkableItemIds: [10, 20, 30, 40],
      selectedLinkableItemLabelsById: {
        20: 'Fallback Label'
      },
      fetchSourceBomStructure,
      onItemError: itemError,
      onProgress: progress,
      maxConcurrentAdds: 2
    })

    expect(progress).toHaveBeenNthCalledWith(1, 2, 4)
    expect(progress).toHaveBeenNthCalledWith(2, 4, 4)
    expect(itemError).toHaveBeenCalledTimes(1)
    expect(result.selectedNodeIds).toEqual(['10', '20'])
    expect(result.itemErrorsById).toEqual({
      30: 'Unable to add item 30. Source BOM could not be loaded.'
    })
    expect(result.sourceTree[0]!.children.map((node) => ({
      id: node.id,
      label: node.label,
      fromLinkableDialog: node.fromLinkableDialog,
      quantity: node.quantity,
      childMarked: node.children[0]?.fromLinkableDialog ?? false
    }))).toEqual([
      {
        id: '10',
        label: 'Loaded 10',
        fromLinkableDialog: true,
        quantity: '1.0',
        childMarked: true
      },
      {
        id: '20',
        label: 'Fallback Label',
        fromLinkableDialog: true,
        quantity: '1.0',
        childMarked: false
      }
    ])
  })
})
