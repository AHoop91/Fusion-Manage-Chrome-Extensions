import {
  appendTopLevelNode,
  cloneNode,
  collectNodeIds,
  findNode,
  removeTopLevelNodeById,
  updateNodeById
} from './tree.service'
import {
  areQuantitiesEquivalent,
  DEFAULT_CLONE_QUANTITY,
  normalizeQuantity
} from '../normalize.service'
import type { BomCloneNode, BomCloneStateSnapshot } from '../../clone.types'
import { isComponentNode } from './structure.node'
import type {
  ManufacturingSplitApplyResult,
  ManufacturingSplitDialogModel,
  ManufacturingSplitProcessOption,
  StagedOperationDraftResult,
  TargetReorderPlacement,
  TargetReorderResult
} from './structure.types'

export function resolveDefaultManufacturingOperationNodeId(
  snapshot: Pick<BomCloneStateSnapshot, 'targetBomTree' | 'sourceBomTree'>
): string | null {
  const targetRoot = snapshot.targetBomTree[0]
  if (!targetRoot) return null
  const processNodeIds = resolveManufacturingProcessNodeIds(snapshot)
  const firstOperation = targetRoot.children.find((child) => processNodeIds.has(child.id)) || null
  return firstOperation ? firstOperation.id : null
}

function resolveNextOperationNumber(children: BomCloneNode[]): number {
  let max = 0
  for (const child of children) {
    const tail = String(child.itemNumber || '').split('.').pop() || ''
    const parsed = Number.parseInt(tail, 10)
    if (Number.isFinite(parsed) && parsed > max) max = parsed
  }
  return Math.max(1, max + 1)
}

function buildStagedOperationNodeId(existingIds: Set<string>): string {
  const base = Date.now()
  let suffix = 0
  while (true) {
    const next = `staged-operation:${base}:${suffix}`
    if (!existingIds.has(next)) return next
    suffix += 1
  }
}

export function createStagedOperationDraft(
  snapshot: Pick<BomCloneStateSnapshot, 'targetBomTree' | 'selectedNodesToClone'>
): StagedOperationDraftResult {
  const targetRoot = snapshot.targetBomTree[0]
  if (!targetRoot) {
    return {
      draftNodeId: null,
      nextTargetBomTree: snapshot.targetBomTree,
      nextSelectedNodeIds: snapshot.selectedNodesToClone
    }
  }

  const existingIds = new Set(targetRoot.children.map((child) => child.id))
  const draftNodeId = buildStagedOperationNodeId(existingIds)
  const nextOperationNumber = resolveNextOperationNumber(targetRoot.children)
  const draftNode: BomCloneNode = {
    id: draftNodeId,
    label: '',
    number: '',
    itemNumber: `1.${nextOperationNumber}`,
    iconHtml: '',
    revision: '',
    status: '',
    quantity: '1.0',
    unitOfMeasure: '',
    stagedOperationDraft: true,
    hasExpandableChildren: false,
    childrenLoaded: true,
    children: []
  }

  const selectedSet = new Set(snapshot.selectedNodesToClone)
  selectedSet.add(draftNodeId)

  return {
    draftNodeId,
    nextTargetBomTree: appendTopLevelNode(snapshot.targetBomTree, draftNode),
    nextSelectedNodeIds: Array.from(selectedSet)
  }
}

export function removeStagedOperationDraftNode(
  snapshot: Pick<BomCloneStateSnapshot, 'targetBomTree' | 'selectedNodesToClone'>,
  nodeId: string
): StagedOperationDraftResult {
  const removeResult = removeTopLevelNodeById(snapshot.targetBomTree, nodeId)
  if (!removeResult.removed) {
    return {
      draftNodeId: null,
      nextTargetBomTree: snapshot.targetBomTree,
      nextSelectedNodeIds: snapshot.selectedNodesToClone
    }
  }
  const nextSelected = snapshot.selectedNodesToClone.filter((entry) => entry !== nodeId)
  return {
    draftNodeId: nodeId,
    nextTargetBomTree: removeResult.nextTree,
    nextSelectedNodeIds: nextSelected
  }
}

export function removeStagedSplitDraftNode(
  snapshot: Pick<BomCloneStateSnapshot, 'targetBomTree'>,
  nodeId: string
): { nextTargetBomTree: BomCloneNode[]; removed: boolean } {
  let removed = false
  const removeFromChildren = (nodes: BomCloneNode[]): BomCloneNode[] => {
    const next: BomCloneNode[] = []
    for (const node of nodes) {
      if (node.id === nodeId) {
        removed = true
        continue
      }
      const nextChildren = removeFromChildren(node.children)
      if (nextChildren !== node.children) {
        next.push({
          ...node,
          children: nextChildren,
          hasExpandableChildren: node.hasExpandableChildren || nextChildren.length > 0,
          childrenLoaded: node.childrenLoaded || nextChildren.length > 0
        })
      } else {
        next.push(node)
      }
    }
    return removed ? next : nodes
  }

  const nextTargetBomTree = removeFromChildren(snapshot.targetBomTree)
  return { nextTargetBomTree, removed }
}

export function pruneManufacturingAssignmentsForOperation(
  assignments: Record<string, string>,
  removedOperationNodeId: string
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(assignments).filter(([, operationId]) => operationId !== removedOperationNodeId)
  )
}

function parseTrailingItemNumber(value: string): number {
  const normalized = String(value || '').trim()
  if (!normalized) return 0
  const parts = normalized.split('.').map((part) => part.trim()).filter(Boolean)
  // parts.length > 0 is verified by the ternary condition
  const tail = parts.length > 0 ? parts[parts.length - 1]! : normalized
  const parsed = Number.parseInt(tail, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function isStagedOperationNode(node: BomCloneNode | null | undefined): boolean {
  return Boolean(node?.stagedOperationDraft) && String(node?.id || '').startsWith('staged-operation:')
}

export function resolveManufacturingProcessNodeIds(
  snapshot: Pick<BomCloneStateSnapshot, 'targetBomTree' | 'sourceBomTree'>
): Set<string> {
  const targetRoot = snapshot.targetBomTree[0]
  if (!targetRoot) return new Set()
  const sourceNodeIds = new Set<string>()
  collectNodeIds(snapshot.sourceBomTree, sourceNodeIds)
  const processNodeIds = new Set<string>()
  for (const node of targetRoot.children) {
    if (isStagedOperationNode(node) || !sourceNodeIds.has(node.id)) {
      processNodeIds.add(node.id)
    }
  }
  return processNodeIds
}

export function isManufacturingProcessNodeId(
  snapshot: Pick<BomCloneStateSnapshot, 'targetBomTree' | 'sourceBomTree'>,
  nodeId: string | null | undefined
): boolean {
  const normalizedNodeId = String(nodeId || '').trim()
  if (!normalizedNodeId) return false
  return resolveManufacturingProcessNodeIds(snapshot).has(normalizedNodeId)
}

function resolveOperationNodeIds(
  snapshot: Pick<BomCloneStateSnapshot, 'targetBomTree' | 'sourceBomTree'>
): Set<string> {
  return resolveManufacturingProcessNodeIds(snapshot)
}

export function normalizeManufacturingAssignments(
  targetBomTree: BomCloneNode[],
  sourceBomTree: BomCloneNode[],
  selectedNodeIds: string[],
  assignments: Record<string, string>
): Record<string, string> {
  const selectedSet = new Set(selectedNodeIds)
  const operationNodeIds = resolveOperationNodeIds({ targetBomTree, sourceBomTree })
  const next: Record<string, string> = {}
  for (const [nodeId, operationNodeId] of Object.entries(assignments)) {
    if (!selectedSet.has(nodeId)) continue
    if (!operationNodeIds.has(operationNodeId)) continue
    next[nodeId] = operationNodeId
  }
  return next
}

function resolveManufacturingParentId(
  nodeId: string,
  assignments: Record<string, string>,
  operationNodeIds: Set<string>
): string | null {
  const assigned = assignments[nodeId]
  if (!assigned || !operationNodeIds.has(assigned)) return null
  return assigned
}

function findDirectParentIdInTree(nodes: BomCloneNode[], targetNodeId: string): string | null {
  const visit = (current: BomCloneNode, parentId: string | null): string | null => {
    if (current.id === targetNodeId) return parentId
    for (const child of current.children) {
      const found = visit(child, current.id)
      if (found !== null) return found
    }
    return null
  }
  for (const node of nodes) {
    const found = visit(node, null)
    if (found !== null) return found
  }
  return null
}

export function buildManufacturingItemNumberOverrides(
  snapshot: Pick<BomCloneStateSnapshot, 'targetBomTree' | 'sourceBomTree'>,
  selectedNodeIds: string[],
  assignments: Record<string, string>
): Record<string, string> {
  const targetRoot = snapshot.targetBomTree[0]
  if (!targetRoot) return {}

  const selectedSet = new Set(selectedNodeIds)
  const operationNodeIds = resolveOperationNodeIds(snapshot)
  const normalizedAssignments = normalizeManufacturingAssignments(
    snapshot.targetBomTree,
    snapshot.sourceBomTree,
    selectedNodeIds,
    assignments
  )
  const usedByParent = new Map<string, Set<number>>()
  const parentKey = (parentId: string | null): string => parentId || '__root__'
  const ensureUsedOrdinals = (parentId: string | null): Set<number> => {
    const key = parentKey(parentId)
    let entry = usedByParent.get(key)
    if (!entry) {
      entry = new Set<number>()
      usedByParent.set(key, entry)
    }
    return entry
  }
  const seedOrdinals = (parentId: string | null, nodes: BomCloneNode[]): void => {
    const used = ensureUsedOrdinals(parentId)
    for (const node of nodes) {
      if (selectedSet.has(node.id)) continue
      const ordinal = parseTrailingItemNumber(node.itemNumber)
      if (ordinal > 0) used.add(ordinal)
    }
  }

  seedOrdinals(null, targetRoot.children)
  for (const operationId of operationNodeIds) {
    const operationNode = targetRoot.children.find((child) => child.id === operationId)
    if (!operationNode) continue
    seedOrdinals(operationId, operationNode.children)
  }

  const overrides: Record<string, string> = {}
  for (const nodeId of selectedNodeIds) {
    const parentId = operationNodeIds.has(nodeId)
      ? null
      : resolveManufacturingParentId(nodeId, normalizedAssignments, operationNodeIds)
    const used = ensureUsedOrdinals(parentId)
    let nextOrdinal = 1
    while (used.has(nextOrdinal)) nextOrdinal += 1
    used.add(nextOrdinal)
    overrides[nodeId] = `1.${nextOrdinal}`
  }
  return overrides
}

export function resolveManufacturingStagedNodeReorder(
  snapshot: Pick<
    BomCloneStateSnapshot,
    | 'cloneLaunchMode'
    | 'targetBomTree'
    | 'sourceBomTree'
    | 'selectedNodesToClone'
    | 'manufacturingOperationBySourceNodeId'
  >,
  draggedNodeId: string,
  targetNodeId: string,
  placement: TargetReorderPlacement
): TargetReorderResult | null {
  if (snapshot.cloneLaunchMode !== 'manufacturing') return null
  const selectedSet = new Set(snapshot.selectedNodesToClone)
  if (!selectedSet.has(draggedNodeId)) return null

  const operationNodeIds = resolveOperationNodeIds(snapshot)
  if (operationNodeIds.has(draggedNodeId)) return null

  const normalizedAssignments = normalizeManufacturingAssignments(
    snapshot.targetBomTree,
    snapshot.sourceBomTree,
    snapshot.selectedNodesToClone,
    snapshot.manufacturingOperationBySourceNodeId
  )
  const nextAssignments: Record<string, string> = { ...normalizedAssignments }
  const currentOrder = [...snapshot.selectedNodesToClone]
  const nextOrder = currentOrder.filter((nodeId) => nodeId !== draggedNodeId)
  const resolveEffectiveParentId = (nodeId: string): string | null => {
    const parentFromAssignments = resolveManufacturingParentId(nodeId, nextAssignments, operationNodeIds)
    if (parentFromAssignments) return parentFromAssignments
    const parentFromTree = findDirectParentIdInTree(snapshot.targetBomTree, nodeId)
    if (parentFromTree && operationNodeIds.has(parentFromTree)) return parentFromTree
    return null
  }

  const resolveTargetParentId = (): string | null => {
    if (placement === 'inside') return operationNodeIds.has(targetNodeId) ? targetNodeId : null
    if (operationNodeIds.has(targetNodeId)) return null
    return resolveEffectiveParentId(targetNodeId)
  }

  const destinationParentId = resolveTargetParentId()
  if (destinationParentId) nextAssignments[draggedNodeId] = destinationParentId
  else delete nextAssignments[draggedNodeId]

  let insertIndex = nextOrder.length
  if (placement === 'inside') {
    const processIndex = nextOrder.indexOf(targetNodeId)
    let lastSiblingIndex = -1
    for (let index = 0; index < nextOrder.length; index += 1) {
      // index is within bounds of the for-loop condition
      const nodeId = nextOrder[index]!
      if (operationNodeIds.has(nodeId)) continue
      const nodeParentId = resolveManufacturingParentId(nodeId, nextAssignments, operationNodeIds)
      if (nodeParentId === destinationParentId) lastSiblingIndex = index
    }
    if (lastSiblingIndex >= 0) insertIndex = lastSiblingIndex + 1
    else if (processIndex >= 0) insertIndex = processIndex + 1
  } else {
    const targetIndex = nextOrder.indexOf(targetNodeId)
    if (targetIndex >= 0) {
      insertIndex = placement === 'after' ? targetIndex + 1 : targetIndex
    } else {
      const siblingIndexes = nextOrder
        .map((nodeId, index) => ({ nodeId, index }))
        .filter(({ nodeId }) => !operationNodeIds.has(nodeId))
        .filter(({ nodeId }) => resolveEffectiveParentId(nodeId) === destinationParentId)
        .map(({ index }) => index)
      if (siblingIndexes.length > 0) {
        insertIndex = placement === 'before'
          ? Math.min(...siblingIndexes)
          : Math.max(...siblingIndexes) + 1
      }
    }
  }
  nextOrder.splice(Math.max(0, Math.min(insertIndex, nextOrder.length)), 0, draggedNodeId)

  return {
    nextTargetBomTree: null,
    nextSelectedNodeIds: nextOrder,
    nextTargetItemNumberOverrides: buildManufacturingItemNumberOverrides(
      { targetBomTree: snapshot.targetBomTree, sourceBomTree: snapshot.sourceBomTree },
      nextOrder,
      nextAssignments
    ),
    nextManufacturingOperationAssignments: nextAssignments
  }
}

const SPLIT_NODE_ID_PREFIX = 'staged-split'
const QUANTITY_EPSILON = 0.000001

function parseQuantityNumber(value: string, fallback = DEFAULT_CLONE_QUANTITY): number {
  const normalized = normalizeQuantity(value, fallback)
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

function formatQuantityValue(value: number): string {
  const rounded = Math.round(Math.max(0, value) * 1000) / 1000
  if (Math.abs(rounded - Math.round(rounded)) < QUANTITY_EPSILON) return rounded.toFixed(1)
  return String(rounded).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
}

function resolveNodeBaseQuantity(
  snapshot: Pick<BomCloneStateSnapshot, 'targetBomTree' | 'sourceBomTree'>,
  nodeId: string,
  targetTree: BomCloneNode[] = snapshot.targetBomTree
): string {
  const fromTarget = findNode(targetTree, nodeId)
  if (fromTarget) return String(fromTarget.quantity || '').trim() || DEFAULT_CLONE_QUANTITY
  const fromSource = findNode(snapshot.sourceBomTree, nodeId)
  if (fromSource) return String(fromSource.quantity || '').trim() || DEFAULT_CLONE_QUANTITY
  return DEFAULT_CLONE_QUANTITY
}

function resolveNodeEffectiveQuantity(
  snapshot: Pick<BomCloneStateSnapshot, 'targetBomTree' | 'sourceBomTree' | 'targetQuantityOverrides'>,
  nodeId: string,
  quantityOverrides: Record<string, string> = snapshot.targetQuantityOverrides,
  targetTree: BomCloneNode[] = snapshot.targetBomTree
): number {
  const fallback = resolveNodeBaseQuantity(snapshot, nodeId, targetTree)
  const raw = Object.prototype.hasOwnProperty.call(quantityOverrides, nodeId)
    ? quantityOverrides[nodeId]
    : fallback
  return parseQuantityNumber(String(raw || '').trim(), fallback)
}

function resolveSplitSourceNodeId(
  snapshot: Pick<BomCloneStateSnapshot, 'targetBomTree' | 'sourceBomTree'>,
  nodeId: string,
  targetTree: BomCloneNode[] = snapshot.targetBomTree
): string | null {
  const targetNode = findNode(targetTree, nodeId)
  const splitSourceNodeId = String(targetNode?.splitSourceNodeId || '').trim()
  if (splitSourceNodeId) return splitSourceNodeId
  const sourceNode = findNode(snapshot.sourceBomTree, nodeId)
  if (sourceNode) return sourceNode.id
  return null
}

function buildSplitSourceMap(targetTree: BomCloneNode[]): Record<string, string> {
  const map: Record<string, string> = {}
  const visit = (node: BomCloneNode): void => {
    const splitSourceNodeId = String(node.splitSourceNodeId || '').trim()
    if (splitSourceNodeId) map[node.id] = splitSourceNodeId
    for (const child of node.children) visit(child)
  }
  for (const node of targetTree) visit(node)
  return map
}

function collectInstanceNodeIdsForSplitSource(
  snapshot: Pick<BomCloneStateSnapshot, 'selectedNodesToClone' | 'targetBomTree' | 'sourceBomTree'>,
  sourceNodeId: string,
  selectedNodeIds: string[] = snapshot.selectedNodesToClone,
  targetTree: BomCloneNode[] = snapshot.targetBomTree
): string[] {
  const splitSourceByNodeId = buildSplitSourceMap(targetTree)
  const instances = new Set<string>()
  const collectFromTargetTree = (nodes: BomCloneNode[]): void => {
    for (const node of nodes) {
      const splitSourceNodeId = String(node.splitSourceNodeId || '').trim()
      if (node.id === sourceNodeId || splitSourceNodeId === sourceNodeId) instances.add(node.id)
      if (node.children.length > 0) collectFromTargetTree(node.children)
    }
  }
  collectFromTargetTree(targetTree)
  for (const nodeId of selectedNodeIds) {
    if (nodeId === sourceNodeId && findNode(snapshot.sourceBomTree, nodeId)) {
      instances.add(nodeId)
      continue
    }
    if (splitSourceByNodeId[nodeId] === sourceNodeId) instances.add(nodeId)
  }
  return Array.from(instances)
}

function resolveCurrentProcessNodeId(
  assignments: Record<string, string>,
  nodeId: string
): string | null {
  const raw = String(assignments[nodeId] || '').trim()
  return raw || null
}

function resolveProcessNodeIdFromTargetTree(
  snapshot: Pick<BomCloneStateSnapshot, 'targetBomTree' | 'sourceBomTree'>,
  nodeId: string,
  targetTree: BomCloneNode[] = snapshot.targetBomTree
): string | null {
  const targetRoot = targetTree[0]
  if (!targetRoot) return null

  const visit = (node: BomCloneNode, activeProcessNodeId: string | null): string | null => {
    const nextProcessNodeId = activeProcessNodeId || (
      isManufacturingProcessNodeId(snapshot as BomCloneStateSnapshot, node.id) ? node.id : null
    )
    if (node.id === nodeId) return nextProcessNodeId
    for (const child of node.children) {
      const found = visit(child, nextProcessNodeId)
      if (found !== null) return found
    }
    return null
  }

  for (const child of targetRoot.children) {
    const found = visit(child, null)
    if (found !== null) return found
  }
  return null
}

function resolveNodeProcessNodeId(
  snapshot: Pick<BomCloneStateSnapshot, 'targetBomTree' | 'sourceBomTree' | 'manufacturingOperationBySourceNodeId'>,
  nodeId: string,
  targetTree: BomCloneNode[] = snapshot.targetBomTree,
  assignments: Record<string, string> = snapshot.manufacturingOperationBySourceNodeId
): string | null {
  const assignedProcessNodeId = resolveCurrentProcessNodeId(assignments, nodeId)
  if (assignedProcessNodeId) return assignedProcessNodeId
  return resolveProcessNodeIdFromTargetTree(snapshot, nodeId, targetTree)
}

function resolveSplitProcessOptions(
  snapshot: Pick<BomCloneStateSnapshot, 'targetBomTree' | 'sourceBomTree'>,
  excludedOperationNodeId: string | null
): ManufacturingSplitProcessOption[] {
  const targetRoot = snapshot.targetBomTree[0]
  if (!targetRoot) return []
  const processNodeIds = resolveManufacturingProcessNodeIds(snapshot)
  const options: ManufacturingSplitProcessOption[] = []
  for (const node of targetRoot.children) {
    if (!processNodeIds.has(node.id)) continue
    if (excludedOperationNodeId && node.id === excludedOperationNodeId) continue
    const label = String(node.label || '').trim() || `Process ${node.itemNumber || ''}`.trim()
    options.push({ operationNodeId: node.id, label })
  }
  return options
}

function sumAllocatedQuantityForSource(
  snapshot: Pick<BomCloneStateSnapshot, 'targetBomTree' | 'sourceBomTree' | 'targetQuantityOverrides' | 'selectedNodesToClone'>,
  sourceNodeId: string,
  selectedNodeIds: string[] = snapshot.selectedNodesToClone,
  quantityOverrides: Record<string, string> = snapshot.targetQuantityOverrides,
  targetTree: BomCloneNode[] = snapshot.targetBomTree
): number {
  const instanceNodeIds = collectInstanceNodeIdsForSplitSource(snapshot, sourceNodeId, selectedNodeIds, targetTree)
  let total = 0
  for (const instanceNodeId of instanceNodeIds) {
    total += resolveNodeEffectiveQuantity(snapshot, instanceNodeId, quantityOverrides, targetTree)
  }
  return total
}

function buildStagedSplitNodeId(existingIds: Set<string>, sourceNodeId: string): string {
  const stamp = Date.now()
  let suffix = 0
  while (true) {
    const candidate = `${SPLIT_NODE_ID_PREFIX}:${sourceNodeId}:${stamp}:${suffix}`
    if (!existingIds.has(candidate)) return candidate
    suffix += 1
  }
}

function createStagedSplitNode(params: {
  nodeId: string
  sourceNodeId: string
  baseNode: BomCloneNode
  quantity: string
}): BomCloneNode {
  const { nodeId, sourceNodeId, baseNode, quantity } = params
  return {
    ...cloneNode(baseNode),
    id: nodeId,
    itemNumber: '',
    quantity,
    stagedSplitDraft: true,
    splitSourceNodeId: sourceNodeId,
    hasExpandableChildren: false,
    childrenLoaded: true,
    children: []
  }
}

function appendSplitNodeToOperation(
  targetTree: BomCloneNode[],
  operationNodeId: string,
  splitNode: BomCloneNode
): BomCloneNode[] {
  const destinationOperation = findNode(targetTree, operationNodeId)
  if (!destinationOperation) return targetTree
  return updateNodeById(targetTree, operationNodeId, (node) => ({
    ...node,
    children: [...node.children.map(cloneNode), splitNode],
    childrenLoaded: true,
    hasExpandableChildren: true
  }))
}

function setQuantityOverrideForNode(
  snapshot: Pick<BomCloneStateSnapshot, 'targetBomTree' | 'sourceBomTree'>,
  nodeId: string,
  nextQuantityValue: string,
  quantityOverrides: Record<string, string>,
  targetTree: BomCloneNode[] = snapshot.targetBomTree
): void {
  const baseline = resolveNodeBaseQuantity(snapshot, nodeId, targetTree)
  const normalizedBaseline = normalizeQuantity(baseline, DEFAULT_CLONE_QUANTITY)
  const normalizedNext = normalizeQuantity(nextQuantityValue, normalizedBaseline)
  if (areQuantitiesEquivalent(normalizedNext, normalizedBaseline, normalizedBaseline)) {
    delete quantityOverrides[nodeId]
    return
  }
  quantityOverrides[nodeId] = normalizedNext
}

function resolveInsertIndexForOperation(
  selectedNodeIds: string[],
  assignments: Record<string, string>,
  destinationOperationNodeId: string
): number {
  let insertIndex = selectedNodeIds.length
  for (let index = 0; index < selectedNodeIds.length; index += 1) {
    // index is within bounds of the for-loop condition
    const nodeId = selectedNodeIds[index]!
    if (resolveCurrentProcessNodeId(assignments, nodeId) === destinationOperationNodeId) insertIndex = index + 1
  }
  if (insertIndex < selectedNodeIds.length) return insertIndex
  const operationIndex = selectedNodeIds.indexOf(destinationOperationNodeId)
  return operationIndex >= 0 ? operationIndex + 1 : selectedNodeIds.length
}

export function resolveManufacturingSplitDialogModel(
  snapshot: Pick<
    BomCloneStateSnapshot,
    | 'cloneLaunchMode'
    | 'targetBomTree'
    | 'sourceBomTree'
    | 'targetQuantityOverrides'
    | 'selectedNodesToClone'
    | 'manufacturingOperationBySourceNodeId'
  >,
  nodeId: string
): ManufacturingSplitDialogModel | null {
  if (snapshot.cloneLaunchMode !== 'manufacturing') return null
  const targetNodeInTargetTree = findNode(snapshot.targetBomTree, nodeId)
  const targetNode = targetNodeInTargetTree || findNode(snapshot.sourceBomTree, nodeId)
  const canSplitExistingTargetNode = Boolean(targetNodeInTargetTree && !targetNodeInTargetTree.stagedOperationDraft)
  if (!snapshot.selectedNodesToClone.includes(nodeId) && !canSplitExistingTargetNode) return null
  if (!targetNode || isManufacturingProcessNodeId(snapshot, nodeId)) return null

  const sourceNodeId = resolveSplitSourceNodeId(snapshot, nodeId)
  if (!sourceNodeId) return null
  const sourceNode = findNode(snapshot.sourceBomTree, sourceNodeId)
  if (!sourceNode) return null
  const sourceTotalQuantity = parseQuantityNumber(String(sourceNode.quantity || '').trim(), DEFAULT_CLONE_QUANTITY)

  const currentQuantity = resolveNodeEffectiveQuantity(snapshot, nodeId)
  if (currentQuantity <= 0) return null
  const currentProcessNodeId = resolveNodeProcessNodeId(snapshot, nodeId)
  const processOptions = resolveSplitProcessOptions(snapshot, currentProcessNodeId)

  return {
    sourceNodeId,
    descriptor: targetNode.label,
    totalQuantity: formatQuantityValue(sourceTotalQuantity),
    remainingQuantity: formatQuantityValue(currentQuantity),
    currentQuantity: formatQuantityValue(currentQuantity),
    maxSplitQuantity: formatQuantityValue(Math.max(0, currentQuantity - 0.001)),
    unitOfMeasure: String(sourceNode.unitOfMeasure || targetNode.unitOfMeasure || '').trim(),
    processOptions
  }
}

export function resolveManufacturingSourceSplitDialogModel(
  snapshot: Pick<
    BomCloneStateSnapshot,
    | 'cloneLaunchMode'
    | 'targetBomTree'
    | 'sourceBomTree'
    | 'targetQuantityOverrides'
    | 'selectedNodesToClone'
    | 'manufacturingOperationBySourceNodeId'
  >,
  sourceNodeId: string
): ManufacturingSplitDialogModel | null {
  if (snapshot.cloneLaunchMode !== 'manufacturing') return null
  const sourceNode = findNode(snapshot.sourceBomTree, sourceNodeId)
  if (!sourceNode || !isComponentNode(sourceNode)) return null

  const sourceTotalQuantity = parseQuantityNumber(String(sourceNode.quantity || '').trim(), DEFAULT_CLONE_QUANTITY)
  if (sourceTotalQuantity <= 0) return null
  const allocatedQuantity = sumAllocatedQuantityForSource(snapshot, sourceNodeId)
  const remainingQuantity = sourceTotalQuantity - allocatedQuantity
  if (remainingQuantity <= QUANTITY_EPSILON) return null

  return {
    sourceNodeId,
    descriptor: sourceNode.label,
    totalQuantity: formatQuantityValue(sourceTotalQuantity),
    remainingQuantity: formatQuantityValue(remainingQuantity),
    currentQuantity: formatQuantityValue(remainingQuantity),
    maxSplitQuantity: formatQuantityValue(remainingQuantity),
    unitOfMeasure: String(sourceNode.unitOfMeasure || '').trim(),
    processOptions: resolveSplitProcessOptions(snapshot, null)
  }
}

export function resolveManufacturingSourceSplit(
  snapshot: Pick<
    BomCloneStateSnapshot,
    | 'cloneLaunchMode'
    | 'targetBomTree'
    | 'sourceBomTree'
    | 'targetQuantityOverrides'
    | 'selectedNodesToClone'
    | 'manufacturingOperationBySourceNodeId'
  >,
  params: {
    sourceNodeId: string
    destinationOperationNodeId: string
    splitQuantity: string
  }
): ManufacturingSplitApplyResult {
  const { sourceNodeId, splitQuantity } = params
  const destinationOperationNodeId = String(params.destinationOperationNodeId || '').trim()
  if (snapshot.cloneLaunchMode !== 'manufacturing') {
    return { ok: false, errorMessage: 'Split is only available in manufacturing mode.' }
  }

  const sourceNode = findNode(snapshot.sourceBomTree, sourceNodeId)
  if (!sourceNode || !isComponentNode(sourceNode)) {
    return { ok: false, errorMessage: 'Only component rows can be staged from source split.' }
  }

  const processNodeIds = resolveManufacturingProcessNodeIds(snapshot)
  const hasAnyProcess = processNodeIds.size > 0
  const useRootDestination = !destinationOperationNodeId

  if (useRootDestination && hasAnyProcess) {
    return { ok: false, errorMessage: 'Select a destination process.' }
  }

  const destinationOperation = useRootDestination
    ? null
    : findNode(snapshot.targetBomTree, destinationOperationNodeId)
  if (!useRootDestination && (!destinationOperation || !processNodeIds.has(destinationOperationNodeId))) {
    return { ok: false, errorMessage: 'Selected destination process is no longer available.' }
  }

  const sourceTotalQuantity = parseQuantityNumber(String(sourceNode.quantity || '').trim(), DEFAULT_CLONE_QUANTITY)
  if (sourceTotalQuantity <= 0) {
    return { ok: false, errorMessage: 'Source quantity must be greater than zero to split.' }
  }

  const allocatedBefore = sumAllocatedQuantityForSource(snapshot, sourceNodeId)
  const remainingQuantity = sourceTotalQuantity - allocatedBefore
  if (remainingQuantity <= QUANTITY_EPSILON) {
    return { ok: false, errorMessage: 'No source quantity remains to allocate.' }
  }

  const splitQuantityNumber = parseQuantityNumber(splitQuantity, DEFAULT_CLONE_QUANTITY)
  if (splitQuantityNumber <= 0) {
    return { ok: false, errorMessage: 'Split quantity must be greater than zero.' }
  }
  if (splitQuantityNumber > remainingQuantity + QUANTITY_EPSILON) {
    return { ok: false, errorMessage: 'Split quantity exceeds remaining source quantity.' }
  }

  let nextTargetBomTree = snapshot.targetBomTree.map(cloneNode)
  const nextSelectedNodeIds = [...snapshot.selectedNodesToClone]
  const nextTargetQuantityOverrides = { ...snapshot.targetQuantityOverrides }
  const nextAssignments = { ...snapshot.manufacturingOperationBySourceNodeId }

  const sourceInstanceNodeIds = collectInstanceNodeIdsForSplitSource(snapshot, sourceNodeId)
  if (useRootDestination) {
    const existingRootNodeId = sourceInstanceNodeIds.find((instanceNodeId) => !resolveCurrentProcessNodeId(nextAssignments, instanceNodeId)) || null
    if (existingRootNodeId) {
      const mergeCurrentQuantity = resolveNodeEffectiveQuantity(
        snapshot,
        existingRootNodeId,
        nextTargetQuantityOverrides,
        nextTargetBomTree
      )
      const mergeNextQuantity = mergeCurrentQuantity + splitQuantityNumber
      setQuantityOverrideForNode(
        snapshot,
        existingRootNodeId,
        formatQuantityValue(mergeNextQuantity),
        nextTargetQuantityOverrides,
        nextTargetBomTree
      )
      if (!nextSelectedNodeIds.includes(existingRootNodeId)) nextSelectedNodeIds.push(existingRootNodeId)
    } else {
      if (!nextSelectedNodeIds.includes(sourceNodeId)) nextSelectedNodeIds.push(sourceNodeId)
      delete nextAssignments[sourceNodeId]
      setQuantityOverrideForNode(
        snapshot,
        sourceNodeId,
        formatQuantityValue(splitQuantityNumber),
        nextTargetQuantityOverrides,
        nextTargetBomTree
      )
    }
  } else {
    const mergeTargetNodeId = sourceInstanceNodeIds.find((instanceNodeId) => (
      resolveCurrentProcessNodeId(nextAssignments, instanceNodeId) === destinationOperationNodeId
    )) || null

    if (mergeTargetNodeId) {
      const mergeCurrentQuantity = resolveNodeEffectiveQuantity(
        snapshot,
        mergeTargetNodeId,
        nextTargetQuantityOverrides,
        nextTargetBomTree
      )
      const mergeNextQuantity = mergeCurrentQuantity + splitQuantityNumber
      setQuantityOverrideForNode(
        snapshot,
        mergeTargetNodeId,
        formatQuantityValue(mergeNextQuantity),
        nextTargetQuantityOverrides,
        nextTargetBomTree
      )
    } else {
      const existingNodeIds = new Set<string>()
      collectNodeIds(nextTargetBomTree, existingNodeIds)
      for (const selectedNodeId of nextSelectedNodeIds) existingNodeIds.add(selectedNodeId)
      const splitNodeId = buildStagedSplitNodeId(existingNodeIds, sourceNodeId)
      const splitNode = createStagedSplitNode({
        nodeId: splitNodeId,
        sourceNodeId,
        baseNode: cloneNode(sourceNode),
        quantity: formatQuantityValue(splitQuantityNumber)
      })
      nextTargetBomTree = appendSplitNodeToOperation(nextTargetBomTree, destinationOperationNodeId, splitNode)
      const insertIndex = resolveInsertIndexForOperation(nextSelectedNodeIds, nextAssignments, destinationOperationNodeId)
      nextSelectedNodeIds.splice(insertIndex, 0, splitNodeId)
      nextAssignments[splitNodeId] = destinationOperationNodeId
    }
  }

  const allocatedAfter = sumAllocatedQuantityForSource(
    snapshot,
    sourceNodeId,
    nextSelectedNodeIds,
    nextTargetQuantityOverrides,
    nextTargetBomTree
  )
  if (allocatedAfter > sourceTotalQuantity + QUANTITY_EPSILON) {
    return { ok: false, errorMessage: 'Split exceeds source quantity across process allocations.' }
  }

  return {
    ok: true,
    nextTargetBomTree,
    nextSelectedNodeIds,
    nextTargetQuantityOverrides,
    nextManufacturingOperationAssignments: nextAssignments,
    nextTargetItemNumberOverrides: buildManufacturingItemNumberOverrides(
      { targetBomTree: nextTargetBomTree, sourceBomTree: snapshot.sourceBomTree },
      nextSelectedNodeIds,
      nextAssignments
    )
  }
}

export function resolveManufacturingSplit(
  snapshot: Pick<
    BomCloneStateSnapshot,
    | 'cloneLaunchMode'
    | 'targetBomTree'
    | 'sourceBomTree'
    | 'targetQuantityOverrides'
    | 'selectedNodesToClone'
    | 'manufacturingOperationBySourceNodeId'
  >,
  params: {
    nodeId: string
    destinationOperationNodeId: string
    splitQuantity: string
  }
): ManufacturingSplitApplyResult {
  const { nodeId, destinationOperationNodeId, splitQuantity } = params
  if (snapshot.cloneLaunchMode !== 'manufacturing') {
    return { ok: false, errorMessage: 'Split is only available in manufacturing mode.' }
  }
  const targetNodeInTargetTree = findNode(snapshot.targetBomTree, nodeId)
  const canSplitExistingTargetNode = Boolean(targetNodeInTargetTree && !targetNodeInTargetTree.stagedOperationDraft)
  if (!snapshot.selectedNodesToClone.includes(nodeId) && !canSplitExistingTargetNode) {
    return { ok: false, errorMessage: 'Selected row is no longer available for split.' }
  }

  const targetNode = targetNodeInTargetTree || findNode(snapshot.sourceBomTree, nodeId)
  if (!targetNode || isManufacturingProcessNodeId(snapshot, nodeId)) {
    return { ok: false, errorMessage: 'Only component rows can be split.' }
  }

  const sourceNodeId = resolveSplitSourceNodeId(snapshot, nodeId)
  if (!sourceNodeId) {
    return { ok: false, errorMessage: 'Unable to resolve source component for split.' }
  }
  const sourceNode = findNode(snapshot.sourceBomTree, sourceNodeId)
  if (!sourceNode) {
    return { ok: false, errorMessage: 'Source component is unavailable for split validation.' }
  }
  const sourceTotalQuantity = parseQuantityNumber(String(sourceNode.quantity || '').trim(), DEFAULT_CLONE_QUANTITY)
  if (sourceTotalQuantity <= 0) {
    return { ok: false, errorMessage: 'Source quantity must be greater than zero to split.' }
  }

  const currentProcessNodeId = resolveNodeProcessNodeId(snapshot, nodeId)
  if (currentProcessNodeId && destinationOperationNodeId === currentProcessNodeId) {
    return { ok: false, errorMessage: 'Select a different process to split into.' }
  }
  const processNodeIds = resolveManufacturingProcessNodeIds(snapshot)
  const destinationOperation = findNode(snapshot.targetBomTree, destinationOperationNodeId)
  if (!destinationOperation || !processNodeIds.has(destinationOperationNodeId)) {
    return { ok: false, errorMessage: 'Selected destination process is no longer available.' }
  }

  const currentQuantity = resolveNodeEffectiveQuantity(snapshot, nodeId)
  const splitQuantityNumber = parseQuantityNumber(splitQuantity, DEFAULT_CLONE_QUANTITY)
  if (splitQuantityNumber <= 0) {
    return { ok: false, errorMessage: 'Split quantity must be greater than zero.' }
  }
  if (splitQuantityNumber >= currentQuantity) {
    return { ok: false, errorMessage: 'Split quantity must be less than the current quantity.' }
  }

  const allocatedBefore = sumAllocatedQuantityForSource(snapshot, sourceNodeId)
  if (allocatedBefore > sourceTotalQuantity + QUANTITY_EPSILON) {
    return { ok: false, errorMessage: 'Cannot split while allocated quantity exceeds source quantity.' }
  }

  let nextTargetBomTree = snapshot.targetBomTree.map(cloneNode)
  const nextSelectedNodeIds = [...snapshot.selectedNodesToClone]
  const nextTargetQuantityOverrides = { ...snapshot.targetQuantityOverrides }
  const nextAssignments = { ...snapshot.manufacturingOperationBySourceNodeId }

  const nextSourceQuantity = currentQuantity - splitQuantityNumber
  setQuantityOverrideForNode(
    snapshot,
    nodeId,
    formatQuantityValue(nextSourceQuantity),
    nextTargetQuantityOverrides,
    nextTargetBomTree
  )

  const sourceInstanceNodeIds = collectInstanceNodeIdsForSplitSource(snapshot, sourceNodeId)
  const mergeTargetNodeId = sourceInstanceNodeIds.find((instanceNodeId) => (
    instanceNodeId !== nodeId
    && resolveCurrentProcessNodeId(nextAssignments, instanceNodeId) === destinationOperationNodeId
  )) || null

  if (mergeTargetNodeId) {
    const mergeCurrentQuantity = resolveNodeEffectiveQuantity(
      snapshot,
      mergeTargetNodeId,
      nextTargetQuantityOverrides,
      nextTargetBomTree
    )
    const mergeNextQuantity = mergeCurrentQuantity + splitQuantityNumber
    setQuantityOverrideForNode(
      snapshot,
      mergeTargetNodeId,
      formatQuantityValue(mergeNextQuantity),
      nextTargetQuantityOverrides,
      nextTargetBomTree
    )
  } else {
    const existingNodeIds = new Set<string>()
    collectNodeIds(nextTargetBomTree, existingNodeIds)
    for (const selectedNodeId of nextSelectedNodeIds) existingNodeIds.add(selectedNodeId)
    const splitNodeId = buildStagedSplitNodeId(existingNodeIds, sourceNodeId)
    const splitNode = createStagedSplitNode({
      nodeId: splitNodeId,
      sourceNodeId,
      baseNode: cloneNode(sourceNode),
      quantity: formatQuantityValue(splitQuantityNumber)
    })
    nextTargetBomTree = appendSplitNodeToOperation(nextTargetBomTree, destinationOperationNodeId, splitNode)
    const insertIndex = resolveInsertIndexForOperation(nextSelectedNodeIds, nextAssignments, destinationOperationNodeId)
    nextSelectedNodeIds.splice(insertIndex, 0, splitNodeId)
    nextAssignments[splitNodeId] = destinationOperationNodeId
  }

  const allocatedAfter = sumAllocatedQuantityForSource(
    snapshot,
    sourceNodeId,
    nextSelectedNodeIds,
    nextTargetQuantityOverrides,
    nextTargetBomTree
  )
  if (allocatedAfter > sourceTotalQuantity + QUANTITY_EPSILON) {
    return { ok: false, errorMessage: 'Split exceeds source quantity across process allocations.' }
  }

  return {
    ok: true,
    nextTargetBomTree,
    nextSelectedNodeIds,
    nextTargetQuantityOverrides,
    nextManufacturingOperationAssignments: nextAssignments,
    nextTargetItemNumberOverrides: buildManufacturingItemNumberOverrides(
      { targetBomTree: nextTargetBomTree, sourceBomTree: snapshot.sourceBomTree },
      nextSelectedNodeIds,
      nextAssignments
    )
  }
}

