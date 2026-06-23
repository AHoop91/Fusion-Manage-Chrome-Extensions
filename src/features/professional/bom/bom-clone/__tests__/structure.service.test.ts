import { describe, expect, it, vi } from 'vitest'
import {
  applySelectionToggle,
  buildManufacturingItemNumberOverrides,
  canStageSourceNode,
  collectAssemblyComponentNodeIds,
  createStagedOperationDraft,
  isManufacturingProcessNodeId,
  isTopLevelSourceNode,
  pruneManufacturingAssignmentsForOperation,
  resolveChildrenLoadContext,
  resolveCollapseAllNodeIds,
  resolveExpandAllExpandedNodeIds,
  resolveExpandAllFetchNodeIds,
  resolveExpandAllPendingNodeIds,
  removeStagedOperationDraftNode,
  removeStagedSplitDraftNode,
  applyLoadedChildren,
  resolveDefaultManufacturingOperationNodeId,
  resolveItemNumberOverrideForEdit,
  resolveManufacturingSourceSplitDialogModel,
  resolveManufacturingSourceSplit,
  resolveManufacturingSplit,
  resolveManufacturingSplitDialogModel,
  resolveManufacturingProcessNodeIds,
  resolveQuantityEdit,
  resolveQuantityFallbackForNode,
  resolveQuantityFieldOverrideForNode,
  resolveRemoveTargetNode
} from '../services/structure/structure.service'
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
    splitSourceNodeId: overrides.splitSourceNodeId,
    stagedOperationDraft: overrides.stagedOperationDraft,
    stagedSplitDraft: overrides.stagedSplitDraft
  }
}

describe('bom/structure.service staged draft flow', () => {
  it('toggles selection state and detects top-level source nodes', () => {
    const snapshot = {
      sourceBomTree: [
        createNode({
          id: 'root',
          label: 'Root',
          children: [
            createNode({ id: 'assembly-1', label: 'Assembly 1', hasExpandableChildren: true }),
            createNode({ id: 'assembly-2', label: 'Assembly 2', hasExpandableChildren: true })
          ]
        })
      ]
    }

    expect(applySelectionToggle(['assembly-1'], 'assembly-2', true)).toEqual(['assembly-1', 'assembly-2'])
    expect(applySelectionToggle(['assembly-1', 'assembly-2'], 'assembly-1', false)).toEqual(['assembly-2'])
    expect(isTopLevelSourceNode(snapshot, 'assembly-1')).toBe(true)
    expect(isTopLevelSourceNode(snapshot, 'missing')).toBe(false)
  })

  it('only stages valid source nodes for engineering and manufacturing modes', () => {
    const sourceBomTree = [
      createNode({
        id: 'root',
        label: 'Root',
        hasExpandableChildren: true,
        children: [
          createNode({
            id: 'assembly',
            label: 'Assembly',
            hasExpandableChildren: true,
            children: [createNode({ id: 'component', label: 'Component' })]
          })
        ]
      })
    ]

    expect(canStageSourceNode({ sourceBomTree, cloneLaunchMode: 'engineering' }, 'assembly')).toBe(true)
    expect(canStageSourceNode({ sourceBomTree, cloneLaunchMode: 'engineering' }, 'component')).toBe(false)
    expect(canStageSourceNode({ sourceBomTree, cloneLaunchMode: 'manufacturing' }, 'assembly')).toBe(false)
    expect(canStageSourceNode({ sourceBomTree, cloneLaunchMode: 'manufacturing' }, 'component')).toBe(true)
  })

  it('collects component descendants for an assembly only', () => {
    const sourceBomTree = [
      createNode({
        id: 'root',
        label: 'Root',
        hasExpandableChildren: true,
        children: [
          createNode({
            id: 'assembly',
            label: 'Assembly',
            hasExpandableChildren: true,
            children: [
              createNode({ id: 'component-a', label: 'Component A' }),
              createNode({
                id: 'subassembly',
                label: 'Subassembly',
                hasExpandableChildren: true,
                children: [createNode({ id: 'component-b', label: 'Component B' })]
              })
            ]
          })
        ]
      })
    ]

    expect(collectAssemblyComponentNodeIds({ sourceBomTree }, 'assembly')).toEqual(['component-a', 'component-b'])
    expect(collectAssemblyComponentNodeIds({ sourceBomTree }, 'component-a')).toEqual([])
  })

  it('creates a new staged top-level operation draft and auto-selects it', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)

    const snapshot = {
      targetBomTree: [
        createNode({
          id: 'root',
          label: 'Root',
          itemNumber: '1',
          children: [
            createNode({ id: 'op-1', label: 'Op 1', itemNumber: '1.1' }),
            createNode({ id: 'op-2', label: 'Op 2', itemNumber: '1.2' })
          ]
        })
      ],
      selectedNodesToClone: ['op-1']
    }

    const result = createStagedOperationDraft(snapshot)

    expect(result.draftNodeId).toBe('staged-operation:1700000000000:0')
    expect(result.nextSelectedNodeIds).toEqual(['op-1', 'staged-operation:1700000000000:0'])
    expect(result.nextTargetBomTree[0]!.children.map((node) => ({
      id: node.id,
      itemNumber: node.itemNumber,
      stagedOperationDraft: node.stagedOperationDraft
    }))).toEqual([
      { id: 'op-1', itemNumber: '1.1', stagedOperationDraft: undefined },
      { id: 'op-2', itemNumber: '1.2', stagedOperationDraft: undefined },
      { id: 'staged-operation:1700000000000:0', itemNumber: '1.3', stagedOperationDraft: true }
    ])

    vi.restoreAllMocks()
  })

  it('removes a staged draft node from the target tree and selected ids', () => {
    const snapshot = {
      targetBomTree: [
        createNode({
          id: 'root',
          label: 'Root',
          children: [
            createNode({ id: 'existing', label: 'Existing' }),
            createNode({ id: 'staged-operation:1:0', label: '', stagedOperationDraft: true })
          ]
        })
      ],
      selectedNodesToClone: ['existing', 'staged-operation:1:0']
    }

    const result = removeStagedOperationDraftNode(snapshot, 'staged-operation:1:0')

    expect(result).toEqual({
      draftNodeId: 'staged-operation:1:0',
      nextTargetBomTree: [
        createNode({
          id: 'root',
          label: 'Root',
          children: [createNode({ id: 'existing', label: 'Existing' })]
        })
      ],
      nextSelectedNodeIds: ['existing']
    })
  })

  it('removes staged split drafts nested under manufacturing operations', () => {
    const snapshot = {
      targetBomTree: [
        createNode({
          id: 'root',
          label: 'Root',
          hasExpandableChildren: true,
          children: [
            createNode({
              id: 'operation',
              label: 'Operation',
              hasExpandableChildren: true,
              children: [
                createNode({ id: 'kept', label: 'Kept child' }),
                createNode({ id: 'split-draft', label: 'Draft child', stagedSplitDraft: true })
              ]
            })
          ]
        })
      ]
    }

    expect(removeStagedSplitDraftNode(snapshot, 'split-draft')).toEqual({
      removed: true,
      nextTargetBomTree: [
        createNode({
          id: 'root',
          label: 'Root',
          hasExpandableChildren: true,
          children: [
            createNode({
              id: 'operation',
              label: 'Operation',
              hasExpandableChildren: true,
              children: [createNode({ id: 'kept', label: 'Kept child' })]
            })
          ]
        })
      ]
    })
  })

  it('unstages selected rows before toggling delete markers on persisted rows', () => {
    expect(resolveRemoveTargetNode({
      selectedNodesToClone: ['new-node'],
      targetMarkedForDeleteNodeIds: ['persisted-node']
    }, 'new-node')).toEqual({
      nextSelectedNodeIds: [],
      nextMarkedForDeleteNodeIds: ['persisted-node'],
      unstageNode: true
    })

    expect(resolveRemoveTargetNode({
      selectedNodesToClone: [],
      targetMarkedForDeleteNodeIds: []
    }, 'persisted-node')).toEqual({
      nextSelectedNodeIds: [],
      nextMarkedForDeleteNodeIds: ['persisted-node'],
      unstageNode: false
    })
  })

  it('resolves manufacturing process nodes and default operation selection', () => {
    const sourceBomTree = [
      createNode({
        id: 'root',
        label: 'Root',
        hasExpandableChildren: true,
        children: [createNode({ id: 'component-a', label: 'Component A' })]
      })
    ]
    const targetBomTree = [
      createNode({
        id: 'root',
        label: 'Root',
        hasExpandableChildren: true,
        children: [
          createNode({ id: 'component-a', label: 'Component A' }),
          createNode({ id: 'operation-existing', label: 'Existing Operation', hasExpandableChildren: true }),
          createNode({ id: 'staged-operation:1:0', label: 'Draft Operation', stagedOperationDraft: true })
        ]
      })
    ]

    expect(Array.from(resolveManufacturingProcessNodeIds({ targetBomTree, sourceBomTree }))).toEqual([
      'operation-existing',
      'staged-operation:1:0'
    ])
    expect(isManufacturingProcessNodeId({ targetBomTree, sourceBomTree }, 'operation-existing')).toBe(true)
    expect(isManufacturingProcessNodeId({ targetBomTree, sourceBomTree }, 'component-a')).toBe(false)
    expect(resolveDefaultManufacturingOperationNodeId({ targetBomTree, sourceBomTree })).toBe('operation-existing')
  })

  it('prunes manufacturing assignments and computes quantity/item overrides', () => {
    const targetBomTree = [
      createNode({
        id: 'root',
        label: 'Root',
        hasExpandableChildren: true,
        children: [
          createNode({
            id: 'operation-a',
            label: 'Operation A',
            itemNumber: '1.1',
            hasExpandableChildren: true,
            children: [createNode({ id: 'existing-child', label: 'Existing child', itemNumber: '1.1' })]
          }),
          createNode({ id: 'operation-b', label: 'Operation B', itemNumber: '1.2', hasExpandableChildren: true })
        ]
      })
    ]
    const sourceBomTree = [
      createNode({
        id: 'root',
        label: 'Root',
        hasExpandableChildren: true,
        children: [createNode({ id: 'component-a', label: 'Component A', itemNumber: '1.9', quantity: '2.5' })]
      })
    ]

    expect(pruneManufacturingAssignmentsForOperation({
      'component-a': 'operation-a',
      'component-b': 'operation-b'
    }, 'operation-a')).toEqual({
      'component-b': 'operation-b'
    })

    expect(resolveQuantityFallbackForNode({
      targetBomTree,
      sourceBomTree
    } as any, 'component-a')).toBe('2.5')

    expect(resolveQuantityFieldOverrideForNode({
      targetFieldOverrides: { 'component-a': { qty: '1.0', note: 'keep' } },
      bomViewFields: [{ fieldId: 'qty', title: 'Quantity' }]
    } as any, 'component-a', '3.0')).toEqual({ qty: '3.0', note: 'keep' })

    expect(resolveQuantityEdit({
      targetBomTree,
      sourceBomTree,
      targetFieldOverrides: { 'component-a': { qty: '2.5' } },
      bomViewFields: [{ fieldId: 'qty', title: 'Quantity' }]
    } as any, 'component-a', '2.5000000')).toEqual({
      quantityOverride: null,
      fieldOverrides: {}
    })

    expect(resolveItemNumberOverrideForEdit({ sourceBomTree }, 'component-a', '7')).toBe('1.7')

    expect(buildManufacturingItemNumberOverrides(
      { targetBomTree, sourceBomTree },
      ['operation-b', 'component-a'],
      { 'component-a': 'operation-a' }
    )).toEqual({
      'operation-b': '1.2',
      'component-a': '1.2'
    })
  })

  it('resolves collapse and expand-all helpers for source and target trees', () => {
    const sourceBomTree = [
      createNode({
        id: 'root',
        label: 'Root',
        hasExpandableChildren: true,
        childrenLoaded: true,
        children: [
          createNode({
            id: 'loaded-parent',
            label: 'Loaded Parent',
            hasExpandableChildren: true,
            childrenLoaded: true,
            children: [createNode({ id: 'leaf', label: 'Leaf' })]
          }),
          createNode({
            id: 'pending-parent',
            label: 'Pending Parent',
            hasExpandableChildren: true,
            childrenLoaded: false
          })
        ]
      })
    ]
    const targetBomTree = [
      createNode({
        id: 'target-root',
        label: 'Target Root',
        hasExpandableChildren: true,
        children: [
          createNode({
            id: 'target-child',
            label: 'Target Child',
            hasExpandableChildren: true,
            childrenLoaded: false
          })
        ]
      })
    ]

    expect(resolveCollapseAllNodeIds({ sourceBomTree, targetBomTree }, 'source')).toEqual(['root'])
    expect(resolveCollapseAllNodeIds({ sourceBomTree, targetBomTree }, 'target')).toEqual(['target-root'])
    expect(resolveExpandAllPendingNodeIds({
      sourceBomTree,
      targetBomTree,
      selectedNodesToClone: []
    }, 'source')).toEqual(['pending-parent'])
    expect(resolveExpandAllFetchNodeIds({
      sourceBomTree,
      targetBomTree,
      selectedNodesToClone: []
    }, 'source')).toEqual(['root'])
    expect(resolveExpandAllExpandedNodeIds({
      sourceBomTree,
      targetBomTree,
      selectedNodesToClone: []
    }, 'source')).toEqual(['root', 'loaded-parent', 'pending-parent'])
  })

  it('resolves child-load context and applies loaded children onto expandable nodes', () => {
    const sourceBomTree = [
      createNode({
        id: 'root',
        label: 'Root',
        hasExpandableChildren: true,
        childrenLoaded: true,
        children: [
          createNode({
            id: 'assembly',
            label: 'Assembly',
            itemNumber: '1.1',
            hasExpandableChildren: true,
            childrenLoaded: false
          })
        ]
      })
    ]

    expect(resolveChildrenLoadContext({
      tenant: 'TEST',
      workspaceId: 57,
      currentItemId: 1,
      viewId: 2,
      viewDefId: 100
    }, {
      bomViewDefId: 200,
      cloneLaunchMode: 'engineering'
    })).toMatchObject({ viewDefId: 200 })

    expect(resolveChildrenLoadContext({
      tenant: 'TEST',
      workspaceId: 57,
      currentItemId: 1,
      viewId: 2,
      viewDefId: 100
    }, {
      bomViewDefId: 200,
      cloneLaunchMode: 'manufacturing'
    })).toMatchObject({ viewDefId: null })

    const applied = applyLoadedChildren(sourceBomTree, 'assembly', [
      createNode({
        id: 'assembly',
        label: 'Assembly',
        itemNumber: '1.1',
        hasExpandableChildren: true,
        childrenLoaded: true,
        children: [
          createNode({
            id: 'child',
            label: 'Child',
            itemNumber: '2.1'
          })
        ]
      })
    ])

    expect(applied[0]!.children[0]).toMatchObject({
      id: 'assembly',
      childrenLoaded: true
    })
    expect(applied[0]!.children[0]!.children[0]).toMatchObject({
      id: 'child',
      itemNumber: '2.1'
    })
  })

  it('builds manufacturing split dialog models for target and source rows', () => {
    const sourceBomTree = [
      createNode({
        id: 'root',
        label: 'Root',
        hasExpandableChildren: true,
        children: [
          createNode({
            id: 'component-a',
            label: 'Component A',
            quantity: '5',
            unitOfMeasure: 'EA'
          })
        ]
      })
    ]
    const targetBomTree = [
      createNode({
        id: 'target-root',
        label: 'Target Root',
        hasExpandableChildren: true,
        children: [
          createNode({
            id: 'operation-a',
            label: 'Operation A',
            hasExpandableChildren: true,
            children: [
              createNode({
                id: 'component-a',
                label: 'Component A',
                quantity: '3',
                unitOfMeasure: 'EA'
              })
            ]
          }),
          createNode({
            id: 'operation-b',
            label: 'Operation B',
            hasExpandableChildren: true
          })
        ]
      })
    ]

    expect(resolveManufacturingSplitDialogModel({
      cloneLaunchMode: 'manufacturing',
      targetBomTree,
      sourceBomTree,
      targetQuantityOverrides: {},
      selectedNodesToClone: ['component-a'],
      manufacturingOperationBySourceNodeId: {}
    }, 'component-a')).toEqual({
      sourceNodeId: 'component-a',
      descriptor: 'Component A',
      totalQuantity: '5.0',
      remainingQuantity: '3.0',
      currentQuantity: '3.0',
      maxSplitQuantity: '2.999',
      unitOfMeasure: 'EA',
      processOptions: [{ operationNodeId: 'operation-b', label: 'Operation B' }]
    })

    expect(resolveManufacturingSourceSplitDialogModel({
      cloneLaunchMode: 'manufacturing',
      targetBomTree,
      sourceBomTree,
      targetQuantityOverrides: {},
      selectedNodesToClone: ['component-a'],
      manufacturingOperationBySourceNodeId: {}
    }, 'component-a')).toEqual({
      sourceNodeId: 'component-a',
      descriptor: 'Component A',
      totalQuantity: '5.0',
      remainingQuantity: '2.0',
      currentQuantity: '2.0',
      maxSplitQuantity: '2.0',
      unitOfMeasure: 'EA',
      processOptions: [
        { operationNodeId: 'operation-a', label: 'Operation A' },
        { operationNodeId: 'operation-b', label: 'Operation B' }
      ]
    })
  })

  it('applies manufacturing source splits into a destination process', () => {
    const sourceBomTree = [
      createNode({
        id: 'root',
        label: 'Root',
        hasExpandableChildren: true,
        children: [
          createNode({
            id: 'component-a',
            label: 'Component A',
            quantity: '5',
            unitOfMeasure: 'EA'
          })
        ]
      })
    ]
    const targetBomTree = [
      createNode({
        id: 'target-root',
        label: 'Target Root',
        hasExpandableChildren: true,
        children: [
          createNode({ id: 'operation-a', label: 'Operation A', hasExpandableChildren: true }),
          createNode({ id: 'operation-b', label: 'Operation B', hasExpandableChildren: true })
        ]
      })
    ]

    const result = resolveManufacturingSourceSplit({
      cloneLaunchMode: 'manufacturing',
      targetBomTree,
      sourceBomTree,
      targetQuantityOverrides: {},
      selectedNodesToClone: [],
      manufacturingOperationBySourceNodeId: {}
    }, {
      sourceNodeId: 'component-a',
      destinationOperationNodeId: 'operation-a',
      splitQuantity: '2'
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.nextSelectedNodeIds).toHaveLength(1)
      expect(result.nextManufacturingOperationAssignments[result.nextSelectedNodeIds[0]!]).toBe('operation-a')
      const operationA = result.nextTargetBomTree[0]!.children.find((node) => node.id === 'operation-a')
      expect(operationA?.children[0]).toMatchObject({
        label: 'Component A',
        quantity: '2.0',
        stagedSplitDraft: true,
        splitSourceNodeId: 'component-a'
      })
    }
  })

  it('splits an existing manufacturing allocation into another process', () => {
    const sourceBomTree = [
      createNode({
        id: 'root',
        label: 'Root',
        hasExpandableChildren: true,
        children: [
          createNode({
            id: 'component-a',
            label: 'Component A',
            quantity: '5',
            unitOfMeasure: 'EA'
          })
        ]
      })
    ]
    const targetBomTree = [
      createNode({
        id: 'target-root',
        label: 'Target Root',
        hasExpandableChildren: true,
        children: [
          createNode({
            id: 'operation-a',
            label: 'Operation A',
            hasExpandableChildren: true,
            children: [createNode({ id: 'component-a', label: 'Component A', quantity: '3', unitOfMeasure: 'EA' })]
          }),
          createNode({
            id: 'operation-b',
            label: 'Operation B',
            hasExpandableChildren: true
          })
        ]
      })
    ]

    const result = resolveManufacturingSplit({
      cloneLaunchMode: 'manufacturing',
      targetBomTree,
      sourceBomTree,
      targetQuantityOverrides: {},
      selectedNodesToClone: ['component-a'],
      manufacturingOperationBySourceNodeId: {}
    }, {
      nodeId: 'component-a',
      destinationOperationNodeId: 'operation-b',
      splitQuantity: '1'
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.nextTargetQuantityOverrides['component-a']).toBe('2.0')
      const operationB = result.nextTargetBomTree[0]!.children.find((node) => node.id === 'operation-b')
      expect(operationB?.children[0]).toMatchObject({
        label: 'Component A',
        quantity: '1.0',
        stagedSplitDraft: true
      })
    }
  })
})
