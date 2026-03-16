import type { BomCloneNode } from '../../clone.types'

export type BomCloneStructureRow = {
  id: string
  node: BomCloneNode
  level: number
  hasChildren: boolean
  expanded: boolean
}

export function findNode(nodes: BomCloneNode[], nodeId: string): BomCloneNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node
    const nested = findNode(node.children, nodeId)
    if (nested) return nested
  }
  return null
}

export function updateNodeById(
  nodes: BomCloneNode[],
  nodeId: string,
  updater: (node: BomCloneNode) => BomCloneNode
): BomCloneNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) return updater(node)
    if (node.children.length === 0) return node
    return { ...node, children: updateNodeById(node.children, nodeId, updater) }
  })
}

export function cloneNode(node: BomCloneNode): BomCloneNode {
  return { ...node, children: node.children.map(cloneNode) }
}

export function resolveNodeItemId(node: Pick<BomCloneNode, 'id' | 'itemLink' | 'splitSourceNodeId'>): number | null {
  const direct = Number.parseInt(String(node.id || '').trim(), 10)
  if (Number.isFinite(direct) && direct > 0) return direct

  const splitSource = Number.parseInt(String(node.splitSourceNodeId || '').trim(), 10)
  if (Number.isFinite(splitSource) && splitSource > 0) return splitSource

  const link = String(node.itemLink || '').trim()
  if (!link) return null
  const match = /\/items\/(\d+)\b/i.exec(link)
  if (!match) return null
  const fromLink = Number.parseInt(match[1], 10)
  return Number.isFinite(fromLink) && fromLink > 0 ? fromLink : null
}

function cloneAsFlatStagedChild(node: BomCloneNode): BomCloneNode {
  const cloned = cloneNode(node)
  return {
    ...cloned,
    hasExpandableChildren: false,
    childrenLoaded: true,
    children: []
  }
}

export function collectNodeIds(nodes: BomCloneNode[], into: Set<string>): void {
  for (const node of nodes) {
    into.add(node.id)
    if (node.children.length > 0) collectNodeIds(node.children, into)
  }
}

export function collectExpandableNodeIds(nodes: BomCloneNode[], into: Set<string>): void {
  for (const node of nodes) {
    if (node.hasExpandableChildren || node.children.length > 0) into.add(node.id)
    if (node.children.length > 0) collectExpandableNodeIds(node.children, into)
  }
}

export function collectUnloadedExpandableNodeIds(nodes: BomCloneNode[], into: Set<string>): void {
  for (const node of nodes) {
    if (node.hasExpandableChildren && !node.childrenLoaded) into.add(node.id)
    if (node.children.length > 0) collectUnloadedExpandableNodeIds(node.children, into)
  }
}

export function mergeTargetTreeWithStaged(
  targetTree: BomCloneNode[],
  stagedSelectedTree: BomCloneNode[]
): BomCloneNode[] {
  const targetRoot = targetTree[0]
  if (!targetRoot) return stagedSelectedTree.map(cloneNode)
  const mergedRoot = cloneNode(targetRoot)
  const existingTopLevelIds = new Set(mergedRoot.children.map((node) => node.id))
  for (const stagedNode of stagedSelectedTree) {
    if (existingTopLevelIds.has(stagedNode.id)) continue
    mergedRoot.children.push(cloneNode(stagedNode))
  }
  return [mergedRoot, ...targetTree.slice(1).map(cloneNode)]
}

export function appendTopLevelNode(targetTree: BomCloneNode[], node: BomCloneNode): BomCloneNode[] {
  const targetRoot = targetTree[0]
  if (!targetRoot) return targetTree.map(cloneNode)
  return [
    {
      ...cloneNode(targetRoot),
      children: [...targetRoot.children.map(cloneNode), cloneNode(node)]
    },
    ...targetTree.slice(1).map(cloneNode)
  ]
}

export function removeTopLevelNodeById(
  targetTree: BomCloneNode[],
  nodeId: string
): { nextTree: BomCloneNode[]; removed: boolean } {
  const targetRoot = targetTree[0]
  if (!targetRoot) return { nextTree: targetTree.map(cloneNode), removed: false }
  const nextChildren = targetRoot.children.filter((entry) => entry.id !== nodeId)
  if (nextChildren.length === targetRoot.children.length) {
    return { nextTree: targetTree.map(cloneNode), removed: false }
  }
  return {
    nextTree: [
      {
        ...cloneNode(targetRoot),
        children: nextChildren.map(cloneNode)
      },
      ...targetTree.slice(1).map(cloneNode)
    ],
    removed: true
  }
}

export function mergeTargetTreeWithStagedByOperation(
  targetTree: BomCloneNode[],
  sourceTree: BomCloneNode[],
  selectedSourceNodeIds: string[],
  sourceNodeToOperationId: Record<string, string>,
  defaultOperationId: string | null,
  targetItemNumberOverrides: Record<string, string> = {}
): BomCloneNode[] {
  const targetRoot = targetTree[0]
  if (!targetRoot) return targetTree.map(cloneNode)

  const mergedRoot = cloneNode(targetRoot)
  const operationById = new Map(mergedRoot.children.map((node) => [node.id, node]))
  const existingIds = new Set<string>()
  collectNodeIds([mergedRoot], existingIds)
  for (const sourceNodeId of selectedSourceNodeIds) {
    const sourceNode = findNode(sourceTree, sourceNodeId)
    if (!sourceNode) continue
    const operationNodeId = sourceNodeToOperationId[sourceNodeId] || defaultOperationId
    if (operationNodeId) {
      const operation = operationById.get(operationNodeId)
      if (!operation) continue
      if (operation.children.some((entry) => entry.id === sourceNode.id)) continue
      operation.children.push(cloneAsFlatStagedChild(sourceNode))
      operation.childrenLoaded = true
      operation.hasExpandableChildren = true
      existingIds.add(sourceNode.id)
      continue
    }

    if (existingIds.has(sourceNode.id)) continue
    mergedRoot.children.push(cloneAsFlatStagedChild(sourceNode))
    existingIds.add(sourceNode.id)
  }

  const parseTopLevelOrdinal = (node: BomCloneNode): number => {
    const effectiveItemNumber = String(targetItemNumberOverrides[node.id] ?? node.itemNumber ?? '').trim()
    const parts = effectiveItemNumber.split('.').map((part) => part.trim()).filter(Boolean)
    const tail = parts.length > 1 ? parts[1] : parts[0]
    const parsed = Number.parseInt(tail || '0', 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : Number.MAX_SAFE_INTEGER
  }

  mergedRoot.children = mergedRoot.children
    .map((node, index) => ({ node, index }))
    .sort((left, right) => parseTopLevelOrdinal(left.node) - parseTopLevelOrdinal(right.node) || left.index - right.index)
    .map(({ node }) => node)

  return [mergedRoot, ...targetTree.slice(1).map(cloneNode)]
}

export function flattenNodes(nodes: BomCloneNode[], expandedNodeIds: Set<string>, level = 0): BomCloneStructureRow[] {
  const rows: BomCloneStructureRow[] = []
  for (const node of nodes) {
    const expanded = expandedNodeIds.has(node.id)
    rows.push({
      id: node.id,
      node,
      level,
      hasChildren: node.hasExpandableChildren || node.children.length > 0,
      expanded
    })
    if (expanded && node.children.length > 0) rows.push(...flattenNodes(node.children, expandedNodeIds, level + 1))
  }
  return rows
}

export function flattenNodesForDisplay(
  nodes: BomCloneNode[],
  expandedNodeIds: Set<string>,
  rootIdToOmit: string | null
): BomCloneStructureRow[] {
  const rows = flattenNodes(nodes, expandedNodeIds)
  if (!rootIdToOmit || !rows.some((row) => row.id === rootIdToOmit)) return rows
  return rows.filter((row) => row.id !== rootIdToOmit).map((row) => ({ ...row, level: Math.max(0, row.level - 1) }))
}

function mergeBomNodes(primary: BomCloneNode, incoming: BomCloneNode): BomCloneNode {
  const mergedFieldValues = {
    ...(incoming.bomFieldValues || {}),
    ...(primary.bomFieldValues || {})
  }
  return {
    ...primary,
    bomEdgeId: primary.bomEdgeId || incoming.bomEdgeId,
    bomEdgeLink: primary.bomEdgeLink || incoming.bomEdgeLink,
    ...(Object.keys(mergedFieldValues).length > 0 ? { bomFieldValues: mergedFieldValues } : {}),
    itemLink: primary.itemLink || incoming.itemLink,
    label: primary.label || incoming.label,
    number: primary.number || incoming.number,
    itemNumber: primary.itemNumber || incoming.itemNumber,
    iconHtml: primary.iconHtml || incoming.iconHtml,
    revision: primary.revision || incoming.revision,
    status: primary.status || incoming.status,
    quantity: primary.quantity || incoming.quantity,
    unitOfMeasure: primary.unitOfMeasure || incoming.unitOfMeasure,
    isPinned: typeof primary.isPinned === 'boolean' ? primary.isPinned : incoming.isPinned,
    fromLinkableDialog: primary.fromLinkableDialog || incoming.fromLinkableDialog,
    hasExpandableChildren: primary.hasExpandableChildren || incoming.hasExpandableChildren,
    childrenLoaded: primary.childrenLoaded || incoming.childrenLoaded,
    children: mergeBomNodeCollections(primary.children, incoming.children)
  }
}

export function mergeNodeIntoTreeById(
  nodes: BomCloneNode[],
  nodeId: string,
  incoming: BomCloneNode
): BomCloneNode[] {
  return updateNodeById(nodes, nodeId, (node) => mergeBomNodes(node, incoming))
}

export function mergeBomNodeCollections(primary: BomCloneNode[], incoming: BomCloneNode[]): BomCloneNode[] {
  const byId = new Map<string, BomCloneNode>()
  for (const node of primary) byId.set(node.id, cloneNode(node))
  for (const node of incoming) {
    const current = byId.get(node.id)
    if (!current) {
      byId.set(node.id, cloneNode(node))
      continue
    }
    byId.set(node.id, mergeBomNodes(current, node))
  }
  return Array.from(byId.values())
}

export function collectTopLevelChildItemIdsFromTree(nodes: BomCloneNode[], rootItemId: number): number[] {
  const preferredRootId = String(rootItemId)
  const roots = nodes.filter((node) => node.id === preferredRootId)
  const candidates = roots.length > 0 ? roots : nodes
  const ids = new Set<number>()

  const parsePositiveInt = (value: unknown): number | null => {
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) return null
    return Math.floor(parsed)
  }

  for (const root of candidates) {
    for (const child of root.children) {
      let id = parsePositiveInt(child.id)
      if (id === null) id = resolveNodeItemId(child)
      if (id !== null && id !== rootItemId) ids.add(id)
    }
  }

  return Array.from(ids)
}


