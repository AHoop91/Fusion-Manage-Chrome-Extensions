// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  buildAutoTopLevelNumberOverrides,
  rebaseItemNumber,
  upsertSourceRootChild,
  withTopLevelItemNumber
} from '../services/numbering.service'
import type { BomCloneNode } from '../clone.types'

function createNode(overrides: Partial<BomCloneNode> = {}): BomCloneNode {
  return {
    id: overrides.id || 'node-1',
    label: overrides.label || 'Node',
    number: overrides.number || '001',
    itemNumber: overrides.itemNumber || '1',
    iconHtml: overrides.iconHtml || '',
    revision: overrides.revision || 'A',
    status: overrides.status || 'Released',
    quantity: overrides.quantity || '1',
    unitOfMeasure: overrides.unitOfMeasure || 'EA',
    hasExpandableChildren: overrides.hasExpandableChildren || false,
    childrenLoaded: overrides.childrenLoaded || false,
    children: overrides.children || [],
    ...overrides
  }
}

describe('clone numbering.service', () => {
  it('rebases nested item numbers under a new depth base', () => {
    const node = createNode({
      id: 'parent',
      itemNumber: '1.7',
      childrenLoaded: true,
      children: [
        createNode({
          id: 'child',
          itemNumber: '1.7.3',
          children: [createNode({ id: 'leaf', itemNumber: '1.7.3.9' })]
        })
      ]
    })

    expect(rebaseItemNumber(node, 4)).toMatchObject({
      itemNumber: '5.7',
      children: [
        {
          itemNumber: '6.7.3',
          children: [{ itemNumber: '7.7.3.9' }]
        }
      ]
    })
  })

  it('normalizes a source node onto a top-level ordinal and marks children as loaded', () => {
    const node = createNode({
      id: 'source-child',
      itemNumber: '9.4',
      children: [createNode({ id: 'nested', itemNumber: '9.4.2' })]
    })

    expect(withTopLevelItemNumber(node, 8)).toMatchObject({
      itemNumber: '1.8',
      childrenLoaded: true,
      children: [{ itemNumber: '2.4.2' }]
    })
  })

  it('builds auto top-level overrides using the next available target ordinals', () => {
    const sourceTree = [
      createNode({
        id: 'root',
        childrenLoaded: true,
        children: [
          createNode({ id: 'source-a', itemNumber: '1.1' }),
          createNode({ id: 'source-b', itemNumber: '1.2' })
        ]
      })
    ]
    const targetTree = [
      createNode({
        id: 'target-root',
        childrenLoaded: true,
        children: [
          createNode({ id: 'existing-1', itemNumber: '1.1' }),
          createNode({ id: 'existing-2', itemNumber: '1.2' }),
          createNode({ id: 'deleted-slot', itemNumber: '1.3' })
        ]
      })
    ]

    expect(
      buildAutoTopLevelNumberOverrides(sourceTree, ['ignored-child', 'source-b', 'source-a'], targetTree, ['deleted-slot'])
    ).toEqual({
      'source-b': '1.3',
      'source-a': '1.4'
    })
  })

  it('upserts a source child by appending or replacing it under the source root', () => {
    const existing = createNode({ id: 'existing', itemNumber: '1.2' })
    const root = createNode({
      id: 'root',
      childrenLoaded: true,
      children: [createNode({ id: 'first', itemNumber: '1.1' }), existing]
    })
    const replacement = createNode({ id: 'existing', itemNumber: '9.9', children: [createNode({ id: 'child', itemNumber: '9.9.1' })] })
    const appended = createNode({ id: 'new-node', itemNumber: '2.5' })

    const replaced = upsertSourceRootChild([root], replacement)
    expect(replaced.nodeId).toBe('existing')
    expect(replaced.nodes[0]!.children[1]).toMatchObject({
      id: 'existing',
      itemNumber: '1.2',
      children: [{ itemNumber: '2.9.1' }]
    })

    const appendedResult = upsertSourceRootChild(replaced.nodes, appended)
    expect(appendedResult.nodes[0]).toMatchObject({
      childrenLoaded: true,
      hasExpandableChildren: true
    })
    expect(appendedResult.nodes[0]!.children[2]).toMatchObject({
      id: 'new-node',
      itemNumber: '1.3'
    })
  })

  it('returns the input unchanged when no source root exists', () => {
    const node = createNode({ id: 'standalone' })
    expect(upsertSourceRootChild([], node)).toEqual({
      nodes: [],
      nodeId: 'standalone'
    })
  })
})
