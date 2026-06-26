import { buildAutoTopLevelNumberOverrides, rebaseItemNumber } from '../numbering.service'
import {
  collectExpandableNodeIds,
  collectUnloadedExpandableNodeIds,
  findNode,
  mergeTargetTreeWithStaged,
  updateNodeById
} from './tree.service'
import { getTargetSelectedTree } from './selection.service'
import {
  areQuantitiesEquivalent,
  DEFAULT_CLONE_QUANTITY,
  normalizeQuantity,
  normalizeTopLevelItemNumber
} from '../normalize.service'
import { TEMP_OPERATION_NAME_FIELD_ID, type BomCloneContext, type BomCloneNode, type BomCloneStateSnapshot } from '../../clone.types'
import { resolveQuantityFieldId } from '../field.service'
import { isComponentNode } from './structure.node'
import {
  buildManufacturingItemNumberOverrides,
  normalizeManufacturingAssignments,
  resolveManufacturingStagedNodeReorder
} from './structure.manufacturing'

import type {
  EditPanelSaveResult,
  QuantityEditResult,
  RemoveTargetNodeResult,
  TargetReorderPlacement,
  TargetReorderResult
} from './structure.types'

export type {
  EditPanelSaveResult,
  ManufacturingSplitApplyResult,
  ManufacturingSplitDialogModel,
  ManufacturingSplitProcessOption,
  QuantityEditResult,
  RemoveTargetNodeResult,
  StagedOperationDraftResult,
  TargetReorderPlacement,
  TargetReorderResult
} from './structure.types'

export function buildAutoOverridesForSelection(
  snapshot: Pick<BomCloneStateSnapshot, 'sourceBomTree' | 'targetBomTree' | 'targetMarkedForDeleteNodeIds'>,
  nextSelectedNodeIds: string[]
): Record<string, string> {
  return buildAutoTopLevelNumberOverrides(
    snapshot.sourceBomTree,
    nextSelectedNodeIds,
    snapshot.targetBomTree,
    snapshot.targetMarkedForDeleteNodeIds
  )
}

export function applySelectionToggle(
  selectedNodeIds: string[],
  nodeId: string,
  selected: boolean
): string[] {
  const selectedSet = new Set(selectedNodeIds)
  if (selected) selectedSet.add(nodeId)
  else selectedSet.delete(nodeId)
  return Array.from(selectedSet)
}

export function isTopLevelSourceNode(
  snapshot: Pick<BomCloneStateSnapshot, 'sourceBomTree'>,
  nodeId: string
): boolean {
  if (snapshot.sourceBomTree.length === 0) return false

  const primaryRoot = snapshot.sourceBomTree[0]
  const candidateIds = (primaryRoot?.children?.length ?? 0) > 0
    // primaryRoot.children.length > 0 is confirmed by the condition above
    ? new Set(primaryRoot!.children.map((child) => child.id))
    : new Set(snapshot.sourceBomTree.map((node) => node.id))

  return candidateIds.has(nodeId)
}

export function canStageSourceNode(
  snapshot: Pick<BomCloneStateSnapshot, 'sourceBomTree' | 'cloneLaunchMode'>,
  nodeId: string
): boolean {
  if (snapshot.cloneLaunchMode !== 'manufacturing') {
    return isTopLevelSourceNode(snapshot, nodeId)
  }
  const node = findNode(snapshot.sourceBomTree, nodeId)
  if (!node) return false
  return isComponentNode(node)
}

export function collectAssemblyComponentNodeIds(
  snapshot: Pick<BomCloneStateSnapshot, 'sourceBomTree'>,
  assemblyNodeId: string
): string[] {
  const assemblyNode = findNode(snapshot.sourceBomTree, assemblyNodeId)
  if (!assemblyNode) return []
  if (isComponentNode(assemblyNode)) return []

  const componentIds: string[] = []
  const seen = new Set<string>()

  const visit = (node: BomCloneNode): void => {
    if (isComponentNode(node)) {
      if (!seen.has(node.id)) {
        componentIds.push(node.id)
        seen.add(node.id)
      }
      return
    }
    for (const child of node.children) visit(child)
  }

  for (const child of assemblyNode.children) visit(child)
  return componentIds
}

export function resolveQuantityFallbackForNode(snapshot: BomCloneStateSnapshot, nodeId: string): string {
  const baseNode = findNode(snapshot.targetBomTree, nodeId) || findNode(snapshot.sourceBomTree, nodeId)
  if (String(baseNode?.quantity || '').trim()) return String(baseNode?.quantity || '').trim()
  return baseNode?.stagedOperationDraft ? '1.0' : DEFAULT_CLONE_QUANTITY
}

export function resolveQuantityFieldOverrideForNode(
  snapshot: Pick<BomCloneStateSnapshot, 'targetFieldOverrides' | 'bomViewFields'>,
  nodeId: string,
  nextQuantityValue: string | null
): Record<string, string> | null {
  const quantityFieldId = resolveQuantityFieldId(snapshot)
  if (!quantityFieldId) return null
  const nextFieldOverrides = { ...(snapshot.targetFieldOverrides[nodeId] || {}) }
  if (!nextQuantityValue) {
    delete nextFieldOverrides[quantityFieldId]
  } else {
    nextFieldOverrides[quantityFieldId] = nextQuantityValue
  }
  return nextFieldOverrides
}

export function resolveItemNumberOverrideForEdit(
  snapshot: Pick<BomCloneStateSnapshot, 'sourceBomTree'>,
  nodeId: string,
  value: string
): string | null {
  const baseNode = findNode(snapshot.sourceBomTree, nodeId)
  const fallback = (baseNode?.itemNumber || '1').split('.')[1] || baseNode?.itemNumber || '1'
  const normalized = normalizeTopLevelItemNumber(value, fallback)
  return normalized === fallback ? null : normalized
}

export function resolveQuantityEdit(
  snapshot: Pick<BomCloneStateSnapshot, 'targetBomTree' | 'sourceBomTree' | 'targetFieldOverrides' | 'bomViewFields'>,
  nodeId: string,
  value: string
): QuantityEditResult {
  const baseline = resolveQuantityFallbackForNode(snapshot as BomCloneStateSnapshot, nodeId)
  const normalized = normalizeQuantity(value, DEFAULT_CLONE_QUANTITY)
  if (areQuantitiesEquivalent(normalized, baseline, DEFAULT_CLONE_QUANTITY)) {
    return {
      quantityOverride: null,
      fieldOverrides: resolveQuantityFieldOverrideForNode(snapshot, nodeId, null)
    }
  }
  return {
    quantityOverride: normalized,
    fieldOverrides: resolveQuantityFieldOverrideForNode(snapshot, nodeId, normalized)
  }
}

export function resolveRemoveTargetNode(
  snapshot: Pick<BomCloneStateSnapshot, 'selectedNodesToClone' | 'targetMarkedForDeleteNodeIds'>,
  nodeId: string
): RemoveTargetNodeResult {
  const selectedSet = new Set(snapshot.selectedNodesToClone)
  if (selectedSet.has(nodeId)) {
    selectedSet.delete(nodeId)
    return {
      nextSelectedNodeIds: Array.from(selectedSet),
      nextMarkedForDeleteNodeIds: snapshot.targetMarkedForDeleteNodeIds,
      unstageNode: true
    }
  }
  const marked = new Set(snapshot.targetMarkedForDeleteNodeIds)
  if (marked.has(nodeId)) marked.delete(nodeId)
  else marked.add(nodeId)
  return {
    nextSelectedNodeIds: snapshot.selectedNodesToClone,
    nextMarkedForDeleteNodeIds: Array.from(marked),
    unstageNode: false
  }
}

export function resolveTargetReorder(
  snapshot: Pick<
  BomCloneStateSnapshot,
  | 'cloneLaunchMode'
  | 'targetBomTree'
  | 'sourceBomTree'
  | 'selectedNodesToClone'
  | 'targetItemNumberOverrides'
  | 'manufacturingOperationBySourceNodeId'
  >,
  draggedNodeId: string,
  targetNodeId: string,
  placement: TargetReorderPlacement
): TargetReorderResult | null {
  const manufacturingReorder = resolveManufacturingStagedNodeReorder(snapshot, draggedNodeId, targetNodeId, placement)
  if (manufacturingReorder) return manufacturingReorder

  const current = snapshot.selectedNodesToClone
  const mergedTargetTree = mergeTargetTreeWithStaged(
    snapshot.targetBomTree,
    getTargetSelectedTree(snapshot.sourceBomTree, current)
  )
  const mergedRoot = mergedTargetTree[0] || null
  if (!mergedRoot) return null
  const topLevelIds = mergedRoot.children.map((node) => node.id)
  if (!topLevelIds.includes(draggedNodeId) || !topLevelIds.includes(targetNodeId)) return null
  if (placement === 'inside') return null

  let resolvedTargetNodeId = targetNodeId
  if (draggedNodeId === targetNodeId) {
    const selfIndex = topLevelIds.indexOf(draggedNodeId)
    if (selfIndex < 0) return null
    const adjacentIndex = placement === 'before' ? selfIndex - 1 : selfIndex + 1
    if (adjacentIndex < 0 || adjacentIndex >= topLevelIds.length) return null
    // bounds are validated by the check above
    resolvedTargetNodeId = topLevelIds[adjacentIndex]!
  }

  const topLevelWithoutDragged = topLevelIds.filter((nodeId) => nodeId !== draggedNodeId)
  const targetIndex = topLevelWithoutDragged.indexOf(resolvedTargetNodeId)
  if (targetIndex < 0) return null
  const insertIndex = placement === 'after' ? targetIndex + 1 : targetIndex
  topLevelWithoutDragged.splice(Math.min(insertIndex, topLevelWithoutDragged.length), 0, draggedNodeId)

  let nextTargetBomTree: BomCloneNode[] | null = null
  const targetRoot = snapshot.targetBomTree[0] || null
  if (targetRoot) {
    const orderIndex = new Map(topLevelWithoutDragged.map((nodeId, index) => [nodeId, index]))
    const maxIndex = topLevelWithoutDragged.length + 1
    const reorderedExistingChildren = [...targetRoot.children]
      .sort((left, right) => (orderIndex.get(left.id) ?? maxIndex) - (orderIndex.get(right.id) ?? maxIndex))
      .map((node, index) => ({ ...node, itemNumber: `1.${index + 1}` }))
    nextTargetBomTree = [
      { ...targetRoot, children: reorderedExistingChildren },
      ...snapshot.targetBomTree.slice(1)
    ]
  }

  const selectedSet = new Set(current)
  const reorderedTopLevelSelected = topLevelWithoutDragged.filter((nodeId) => selectedSet.has(nodeId))
  const remainingSelected = current.filter((nodeId) => !reorderedTopLevelSelected.includes(nodeId))
  const nextSelected = [...reorderedTopLevelSelected, ...remainingSelected]

  const topLevelNumberOverrides: Record<string, string> = {}
  for (let index = 0; index < topLevelWithoutDragged.length; index += 1) {
    // index is within bounds of the for-loop condition
    topLevelNumberOverrides[topLevelWithoutDragged[index]!] = `1.${index + 1}`
  }

  if (snapshot.cloneLaunchMode === 'manufacturing') {
    const nextAssignments = normalizeManufacturingAssignments(
      snapshot.targetBomTree,
      snapshot.sourceBomTree,
      nextSelected,
      snapshot.manufacturingOperationBySourceNodeId
    )
    return {
      nextTargetBomTree,
      nextSelectedNodeIds: nextSelected,
      nextTargetItemNumberOverrides: buildManufacturingItemNumberOverrides(
        { targetBomTree: snapshot.targetBomTree, sourceBomTree: snapshot.sourceBomTree },
        nextSelected,
        nextAssignments
      ),
      nextManufacturingOperationAssignments: nextAssignments
    }
  }

  return {
    nextTargetBomTree,
    nextSelectedNodeIds: nextSelected,
    nextTargetItemNumberOverrides: {
      ...snapshot.targetItemNumberOverrides,
      ...topLevelNumberOverrides
    }
  }
}

export function resolveEditPanelSave(
  snapshot: Pick<
    BomCloneStateSnapshot,
    | 'targetBomTree'
    | 'sourceBomTree'
    | 'targetFieldOverrides'
    | 'targetQuantityOverrides'
    | 'bomViewFields'
  >,
  nodeId: string,
  values: Record<string, string>
): EditPanelSaveResult {
  const baseNode = findNode(snapshot.targetBomTree, nodeId) || findNode(snapshot.sourceBomTree, nodeId)
  const existingFieldValues = (baseNode?.bomFieldValues || {}) as Record<string, string>
  const existingOverrides = snapshot.targetFieldOverrides[nodeId] || {}
  const nextOverrides: Record<string, string> = { ...existingOverrides }
  const quantityFieldId = resolveQuantityFieldId(snapshot)
  for (const [fieldId, rawValue] of Object.entries(values)) {
    if (fieldId === TEMP_OPERATION_NAME_FIELD_ID) continue
    if (quantityFieldId && String(fieldId) === String(quantityFieldId)) continue
    const value = String(rawValue ?? '')
    const baseline = String(existingFieldValues[fieldId] ?? '')
    if (!value.trim()) {
      if (baseline) nextOverrides[fieldId] = ''
      else delete nextOverrides[fieldId]
      continue
    }
    if (value === baseline) {
      delete nextOverrides[fieldId]
      continue
    }
    nextOverrides[fieldId] = value
  }

  let nextTargetBomTree: BomCloneNode[] | null = null
  if (baseNode?.stagedOperationDraft && String(baseNode.id || '').startsWith('staged-operation:')) {
    if (Object.prototype.hasOwnProperty.call(values, TEMP_OPERATION_NAME_FIELD_ID)) {
      const nextDescriptor = String(values[TEMP_OPERATION_NAME_FIELD_ID] || '').trim()
      const currentDescriptor = String(baseNode.label || '').trim()
      if (nextDescriptor !== currentDescriptor) {
        nextTargetBomTree = updateNodeById(snapshot.targetBomTree, nodeId, (target) => ({
          ...target,
          label: nextDescriptor
        }))
      }
    }
  }

  if (!quantityFieldId) {
    return { fieldOverrides: nextOverrides, quantityOverride: null, nextTargetBomTree }
  }

  // Only update quantity semantics when the current edit surface actually submits it.
  if (!Object.prototype.hasOwnProperty.call(values, quantityFieldId)) {
    const existingQuantityOverride = Object.prototype.hasOwnProperty.call(
      snapshot.targetQuantityOverrides,
      nodeId
    )
      ? (snapshot.targetQuantityOverrides[nodeId] ?? null)
      : null
    return {
      fieldOverrides: nextOverrides,
      quantityOverride: existingQuantityOverride,
      nextTargetBomTree
    }
  }

  const quantityFallback = baseNode?.stagedOperationDraft ? '1.0' : DEFAULT_CLONE_QUANTITY
  const fallback = String(baseNode?.quantity || '').trim() || quantityFallback
  const rawQuantity = String(values[quantityFieldId] || '').trim()
  const normalized = normalizeQuantity(rawQuantity, quantityFallback)
  const matchesFallback = areQuantitiesEquivalent(normalized, fallback, quantityFallback)
  if (matchesFallback) delete nextOverrides[quantityFieldId]
  else nextOverrides[quantityFieldId] = normalized
  return {
    fieldOverrides: nextOverrides,
    quantityOverride: matchesFallback ? null : normalized,
    nextTargetBomTree
  }
}

export function resolveCollapseAllNodeIds(
  snapshot: Pick<BomCloneStateSnapshot, 'sourceBomTree' | 'targetBomTree'>,
  tree: 'source' | 'target'
): string[] {
  if (tree === 'source') return snapshot.sourceBomTree.map((node) => node.id)
  return snapshot.targetBomTree.map((node) => node.id)
}

export function resolveExpandAllPendingNodeIds(
  snapshot: Pick<BomCloneStateSnapshot, 'sourceBomTree' | 'selectedNodesToClone' | 'targetBomTree'>,
  tree: 'source' | 'target'
): string[] {
  const scopeNodes = tree === 'source'
    ? snapshot.sourceBomTree
    : mergeTargetTreeWithStaged(
      snapshot.targetBomTree,
      getTargetSelectedTree(snapshot.sourceBomTree, snapshot.selectedNodesToClone)
    )
  const pendingIds = new Set<string>()
  collectUnloadedExpandableNodeIds(scopeNodes, pendingIds)
  return Array.from(pendingIds)
}

function hasUnloadedExpandableSubtree(node: BomCloneNode): boolean {
  if (!node.hasExpandableChildren) return false
  if (!node.childrenLoaded) return true
  for (const child of node.children) {
    if (hasUnloadedExpandableSubtree(child)) return true
  }
  return false
}

export function resolveExpandAllFetchNodeIds(
  snapshot: Pick<BomCloneStateSnapshot, 'sourceBomTree' | 'selectedNodesToClone' | 'targetBomTree'>,
  tree: 'source' | 'target'
): string[] {
  if (tree === 'source') {
    return snapshot.sourceBomTree
      .filter((node) => hasUnloadedExpandableSubtree(node))
      .map((node) => node.id)
  }

  const mergedTarget = mergeTargetTreeWithStaged(
    snapshot.targetBomTree,
    getTargetSelectedTree(snapshot.sourceBomTree, snapshot.selectedNodesToClone)
  )
  // mergedTarget[0] is safe: mergedTarget.length === 1 is checked in the condition
  const topLevelNodes = (mergedTarget.length === 1 && mergedTarget[0]!.children.length > 0)
    ? mergedTarget[0]!.children
    : mergedTarget

  return topLevelNodes
    .filter((node) => hasUnloadedExpandableSubtree(node))
    .map((node) => node.id)
}

export function resolveExpandAllExpandedNodeIds(
  snapshot: Pick<BomCloneStateSnapshot, 'sourceBomTree' | 'selectedNodesToClone' | 'targetBomTree'>,
  tree: 'source' | 'target'
): string[] {
  const scopeNodes = tree === 'source'
    ? snapshot.sourceBomTree
    : mergeTargetTreeWithStaged(
      snapshot.targetBomTree,
      getTargetSelectedTree(snapshot.sourceBomTree, snapshot.selectedNodesToClone)
    )
  const expandedIds = new Set<string>()
  collectExpandableNodeIds(scopeNodes, expandedIds)
  return Array.from(expandedIds)
}

export function resolveChildrenLoadContext(
  context: BomCloneContext,
  snapshot: Pick<BomCloneStateSnapshot, 'bomViewDefId' | 'cloneLaunchMode'>
): BomCloneContext {
  if (snapshot.cloneLaunchMode === 'manufacturing') {
    return { ...context, viewDefId: null }
  }
  const storedViewDefId = snapshot.bomViewDefId
  return storedViewDefId !== null && storedViewDefId !== context.viewDefId
    ? { ...context, viewDefId: storedViewDefId }
    : context
}

export function applyLoadedChildren(
  sourceTree: BomCloneNode[],
  nodeId: string,
  subtree: BomCloneNode[],
  options?: { force?: boolean }
): BomCloneNode[] {
  const latestNode = findNode(sourceTree, nodeId)
  if (!latestNode || !latestNode.hasExpandableChildren) return sourceTree
  if (latestNode.childrenLoaded && !options?.force) return sourceTree

  const subtreeRoot = subtree.find((entry) => entry.id === nodeId) || subtree[0] || null
  const parentDepth = Number(String(latestNode.itemNumber || '').split('.')[0]) || 0
  const children = (subtreeRoot?.children || []).map((child) => rebaseItemNumber(child, parentDepth))

  return updateNodeById(sourceTree, nodeId, (target) => ({
    ...target,
    children,
    childrenLoaded: true,
    hasExpandableChildren: target.hasExpandableChildren || children.length > 0
  }))
}

export {
  buildManufacturingItemNumberOverrides,
  createStagedOperationDraft,
  isManufacturingProcessNodeId,
  pruneManufacturingAssignmentsForOperation,
  removeStagedOperationDraftNode,
  removeStagedSplitDraftNode,
  resolveDefaultManufacturingOperationNodeId,
  resolveManufacturingProcessNodeIds,
  resolveManufacturingSourceSplit,
  resolveManufacturingSourceSplitDialogModel,
  resolveManufacturingSplit,
  resolveManufacturingSplitDialogModel
} from './structure.manufacturing'
