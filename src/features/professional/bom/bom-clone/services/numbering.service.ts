import type { BomCloneNode } from '../clone.types'

function parseOrdinal(itemNumber: string): string {
  const parts = String(itemNumber || '').split('.')
  return parts.length > 1 ? parts.slice(1).join('.') : String(itemNumber || '')
}

function parseTopLevelOrdinal(itemNumber: string): number {
  const parts = String(itemNumber || '').split('.')
  const candidate = Number(parts[1] || parts[0] || 0)
  return Number.isFinite(candidate) ? candidate : 0
}

export function rebaseItemNumber(node: BomCloneNode, depthBase: number): BomCloneNode {
  const ordinal = parseOrdinal(node.itemNumber) || node.itemNumber || node.id
  const depth = depthBase + 1
  return {
    ...node,
    itemNumber: `${depth}.${ordinal}`,
    children: node.children.map((child) => rebaseItemNumber(child, depth))
  }
}

export function withTopLevelItemNumber(node: BomCloneNode, topLevelOrdinal: number): BomCloneNode {
  return {
    ...node,
    itemNumber: `1.${topLevelOrdinal}`,
    children: node.children.map((child) => rebaseItemNumber(child, 1)),
    childrenLoaded: node.children.length > 0 || node.childrenLoaded
  }
}

export function buildAutoTopLevelNumberOverrides(
  sourceTree: BomCloneNode[],
  selectedNodeOrder: string[],
  targetTree: BomCloneNode[] = [],
  markedForDeleteNodeIds: string[] = []
): Record<string, string> {
  const sourceRoot = sourceTree[0]
  if (!sourceRoot) return {}
  const topLevelIds = new Set(sourceRoot.children.map((node) => node.id))
  const deletedIds = new Set(markedForDeleteNodeIds)
  const usedOrdinals = new Set<number>()
  const targetRoot = targetTree[0] || null
  if (targetRoot) {
    for (const node of targetRoot.children) {
      if (deletedIds.has(node.id)) continue
      const ordinal = parseTopLevelOrdinal(node.itemNumber)
      if (ordinal > 0) usedOrdinals.add(ordinal)
    }
  }

  const nextAvailableOrdinal = (): number => {
    let ordinal = 1
    while (usedOrdinals.has(ordinal)) ordinal += 1
    usedOrdinals.add(ordinal)
    return ordinal
  }

  const overrides: Record<string, string> = {}
  for (const nodeId of selectedNodeOrder) {
    if (!topLevelIds.has(nodeId)) continue
    overrides[nodeId] = `1.${nextAvailableOrdinal()}`
  }
  return overrides
}

export function upsertSourceRootChild(
  sourceTree: BomCloneNode[],
  sourceNode: BomCloneNode
): { nodes: BomCloneNode[]; nodeId: string } {
  const sourceRoot = sourceTree[0]
  if (!sourceRoot) return { nodes: sourceTree, nodeId: sourceNode.id }

  const existingIndex = sourceRoot.children.findIndex((entry) => entry.id === sourceNode.id)
  const usedOrdinals = sourceRoot.children
    .map((entry) => parseTopLevelOrdinal(entry.itemNumber))
    .filter((value) => value > 0)
  const nextOrdinal = usedOrdinals.length > 0 ? Math.max(...usedOrdinals) + 1 : 1
  const currentOrdinal = existingIndex >= 0
    ? parseTopLevelOrdinal(sourceRoot.children[existingIndex].itemNumber) || nextOrdinal
    : nextOrdinal
  const normalizedNode = withTopLevelItemNumber(sourceNode, currentOrdinal)

  const nextChildren = [...sourceRoot.children]
  if (existingIndex >= 0) nextChildren[existingIndex] = normalizedNode
  else nextChildren.push(normalizedNode)

  const nextRoot: BomCloneNode = {
    ...sourceRoot,
    children: nextChildren,
    childrenLoaded: true,
    hasExpandableChildren: true
  }
  return { nodes: [nextRoot, ...sourceTree.slice(1)], nodeId: normalizedNode.id }
}


