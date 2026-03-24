import { describe, expect, it, vi } from 'vitest'
import {
  countExecutableCommitOperations,
  countStagedOperations,
  executeCommitOperations,
  getCommitOperationCounts
} from '../services/commit.service'
import type { BomCloneContext, BomCloneNode, BomCloneStateSnapshot, FormFieldDefinition } from '../clone.types'

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
    stagedSplitDraft: overrides.stagedSplitDraft,
    bomEdgeId: overrides.bomEdgeId,
    isPinned: overrides.isPinned
  }
}

function createField(overrides: Partial<FormFieldDefinition> & Pick<FormFieldDefinition, 'fieldId' | 'title'>): FormFieldDefinition {
  return {
    fieldId: overrides.fieldId,
    title: overrides.title,
    description: overrides.description ?? null,
    kind: overrides.kind ?? 'text',
    typeId: overrides.typeId ?? null,
    picklistPath: overrides.picklistPath ?? null,
    defaultValue: overrides.defaultValue ?? null,
    defaultPayloadValue: overrides.defaultPayloadValue ?? null,
    fieldLength: overrides.fieldLength ?? null,
    fieldPrecision: overrides.fieldPrecision ?? null,
    unitOfMeasure: overrides.unitOfMeasure ?? null,
    required: overrides.required ?? false,
    editable: overrides.editable ?? true,
    visible: overrides.visible ?? true,
    displayOrder: overrides.displayOrder ?? 0,
    fieldSelf: overrides.fieldSelf,
    fieldUrn: overrides.fieldUrn,
    typeLink: overrides.typeLink,
    typeUrn: overrides.typeUrn,
    typeTitle: overrides.typeTitle
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

function createSnapshot(overrides: Partial<BomCloneStateSnapshot> = {}): BomCloneStateSnapshot {
  return {
    sourceBomTree: [],
    targetBomTree: [],
    selectedNodesToClone: [],
    targetMarkedForDeleteNodeIds: [],
    targetItemNumberOverrides: {},
    targetQuantityOverrides: {},
    targetFieldOverrides: {},
    bomViewFields: [],
    bomViewFieldMetaLinks: {},
    bomViewDefId: 10,
    cloneLaunchMode: 'engineering',
    manufacturingOperationBySourceNodeId: {},
    operationFormFields: [],
    ...overrides
  } as unknown as BomCloneStateSnapshot
}

describe('bom/commit.service', () => {
  it('classifies staged rows into create, add, delete, and update counts', () => {
    const sourceRoot = createNode({
      id: 'source-root',
      label: 'Source Root',
      hasExpandableChildren: true,
      children: [createNode({ id: '200', label: 'Selected Add', itemNumber: '1.4', quantity: '2' })]
    })
    const targetRoot = createNode({
      id: 'target-root',
      label: 'Target Root',
      children: [
        createNode({ id: 'staged-operation:1:0', label: 'Draft Process', stagedOperationDraft: true, itemNumber: '1.1', quantity: '1.0' }),
        createNode({ id: '300', label: 'Delete Me', itemNumber: '1.2', bomEdgeId: 'edge-300' }),
        createNode({ id: '400', label: 'Update Me', itemNumber: '1.3', bomEdgeId: 'edge-400' })
      ]
    })

    const snapshot = createSnapshot({
      sourceBomTree: [sourceRoot],
      targetBomTree: [targetRoot],
      selectedNodesToClone: ['200', 'staged-operation:1:0'],
      targetMarkedForDeleteNodeIds: ['300'],
      targetFieldOverrides: {
        '400': { FIELD1: 'Changed' }
      },
      bomViewFields: [createField({ fieldId: 'FIELD1', title: 'Field 1' })],
      bomViewFieldMetaLinks: {
        FIELD1: '/api/v3/workspaces/57/views/5/viewdef/10/fields/FIELD1'
      }
    })

    expect(countStagedOperations(snapshot)).toBe(4)
    expect(countExecutableCommitOperations(snapshot, createContext())).toBe(4)
    expect(getCommitOperationCounts(snapshot)).toEqual({
      deleteCount: 1,
      updateCount: 1,
      newCount: 2,
      totalOperations: 4
    })
  })

  it('executes batches in create, delete, add, then update order', async () => {
    const sourceRoot = createNode({
      id: 'source-root',
      label: 'Source Root',
      hasExpandableChildren: true,
      children: [createNode({ id: '200', label: 'Selected Add', itemNumber: '1.4', quantity: '2' })]
    })
    const targetRoot = createNode({
      id: 'target-root',
      label: 'Target Root',
      children: [
        createNode({ id: 'staged-operation:1:0', label: 'Draft Process', stagedOperationDraft: true, itemNumber: '1.1', quantity: '1.0' }),
        createNode({ id: '300', label: 'Delete Me', itemNumber: '1.2', bomEdgeId: 'edge-300' }),
        createNode({ id: '400', label: 'Update Me', itemNumber: '1.3', bomEdgeId: 'edge-400' })
      ]
    })

    const snapshot = createSnapshot({
      sourceBomTree: [sourceRoot],
      targetBomTree: [targetRoot],
      selectedNodesToClone: ['200', 'staged-operation:1:0'],
      targetMarkedForDeleteNodeIds: ['300'],
      targetFieldOverrides: {
        '400': { FIELD1: 'Changed' }
      },
      bomViewFields: [createField({ fieldId: 'FIELD1', title: 'Field 1' })],
      bomViewFieldMetaLinks: {
        FIELD1: '/api/v3/workspaces/57/views/5/viewdef/10/fields/FIELD1'
      }
    })

    const sequence: string[] = []
    const progress: Array<{ completed: number; total: number }> = []
    const dataService = {
      createBomCloneOperationItem: vi.fn(async () => {
        sequence.push('create')
        return 9001
      }),
      commitBomCloneItem: vi.fn(async (_context, payload) => {
        sequence.push(payload.sourceItemId === 9001 ? 'commit-create' : 'commit-add')
      }),
      updateBomCloneItem: vi.fn(async () => {
        sequence.push('update')
      }),
      deleteBomCloneItem: vi.fn(async () => {
        sequence.push('delete')
      })
    }

    const result = await executeCommitOperations({
      snapshot,
      activeContext: createContext(),
      dataService,
      maxConcurrentOperations: 1,
      onOperationComplete: (completed, total) => {
        progress.push({ completed, total })
      }
    })

    expect(sequence).toEqual(['create', 'commit-create', 'delete', 'commit-add', 'update'])
    expect(progress).toEqual([
      { completed: 1, total: 4 },
      { completed: 2, total: 4 },
      { completed: 3, total: 4 },
      { completed: 4, total: 4 }
    ])
    expect(result.errors).toEqual([])
    expect(result.successes.map((entry) => entry.operation)).toEqual(['create', 'delete', 'add', 'update'])
  })

  it('passes created process item ids into manufacturing add operations', async () => {
    const sourceRoot = createNode({
      id: 'source-root',
      label: 'Source Root',
      hasExpandableChildren: true,
      children: [createNode({ id: '300', label: 'Component', itemNumber: '1.2', quantity: '4' })]
    })
    const targetRoot = createNode({
      id: 'target-root',
      label: 'Target Root',
      children: [
        createNode({ id: 'staged-operation:1:0', label: 'Draft Process', stagedOperationDraft: true, itemNumber: '1.1', quantity: '1.0' })
      ]
    })

    const snapshot = createSnapshot({
      cloneLaunchMode: 'manufacturing',
      sourceBomTree: [sourceRoot],
      targetBomTree: [targetRoot],
      selectedNodesToClone: ['300', 'staged-operation:1:0'],
      manufacturingOperationBySourceNodeId: {
        '300': 'staged-operation:1:0'
      }
    })

    const commitCalls: Array<Record<string, unknown>> = []
    const dataService = {
      createBomCloneOperationItem: vi.fn(async () => 7007),
      commitBomCloneItem: vi.fn(async (_context, payload) => {
        commitCalls.push(payload as unknown as Record<string, unknown>)
      }),
      updateBomCloneItem: vi.fn(),
      deleteBomCloneItem: vi.fn()
    }

    await executeCommitOperations({
      snapshot,
      activeContext: createContext(),
      dataService,
      maxConcurrentOperations: 1
    })

    expect(commitCalls).toHaveLength(2)
    expect(commitCalls[0]).toMatchObject({ sourceItemId: 7007 })
    expect(commitCalls[1]).toMatchObject({
      sourceItemId: 300,
      parentItemId: 7007
    })
  })

  it('returns structured error messages from commit failures', async () => {
    const sourceRoot = createNode({
      id: 'source-root',
      label: 'Source Root',
      hasExpandableChildren: true,
      children: [createNode({ id: '200', label: 'Widget', itemNumber: '1.1', quantity: '1' })]
    })
    const targetRoot = createNode({
      id: 'target-root',
      label: 'Target Root',
      children: []
    })

    const snapshot = createSnapshot({
      sourceBomTree: [sourceRoot],
      targetBomTree: [targetRoot],
      selectedNodesToClone: ['200']
    })

    const result = await executeCommitOperations({
      snapshot,
      activeContext: createContext(),
      dataService: {
        createBomCloneOperationItem: vi.fn(),
        commitBomCloneItem: vi.fn(async () => {
          throw {
            data: {
              errors: [
                {
                  message: 'Cannot add {0}',
                  arguments: ['Widget']
                }
              ]
            }
          }
        }),
        updateBomCloneItem: vi.fn(),
        deleteBomCloneItem: vi.fn()
      },
      maxConcurrentOperations: 1
    })

    expect(result.errors).toEqual([
      {
        operation: 'new',
        nodeId: '200',
        nodeLabel: 'Widget',
        descriptor: 'Widget',
        message: 'Cannot add Widget'
      }
    ])
    expect(result.successes).toEqual([])
  })
})
