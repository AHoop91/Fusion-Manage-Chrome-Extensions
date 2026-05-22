import type { BomCloneNode } from '../../clone.types'
import { cloneNode } from './tree.service'

export function buildSelectedTree(nodes: BomCloneNode[], selectedNodeIdsOrdered: string[]): BomCloneNode[] {
  const selected: BomCloneNode[] = []
  const selectedSet = new Set(selectedNodeIdsOrdered)
  const nodeById = new Map<string, BomCloneNode>()
  const parentById = new Map<string, string | null>()

  const visit = (node: BomCloneNode, parentId: string | null): void => {
    nodeById.set(node.id, node)
    parentById.set(node.id, parentId)
    for (const child of node.children) visit(child, node.id)
  }
  for (const node of nodes) visit(node, null)

  const hasSelectedAncestor = (nodeId: string): boolean => {
    let current = parentById.get(nodeId) || null
    while (current) {
      if (selectedSet.has(current)) return true
      current = parentById.get(current) || null
    }
    return false
  }

  const included = new Set<string>()
  for (const nodeId of selectedNodeIdsOrdered) {
    const node = nodeById.get(nodeId)
    if (!node || included.has(nodeId) || hasSelectedAncestor(nodeId)) continue
    selected.push(cloneNode(node))
    included.add(nodeId)
  }
  return selected
}

export function getTargetSelectedTree(sourceTree: BomCloneNode[], selectedNodeOrder: string[]): BomCloneNode[] {
  const sourceRoot = sourceTree[0] || null
  return buildSelectedTree(sourceTree, selectedNodeOrder.filter((nodeId) => nodeId !== sourceRoot?.id))
}


