import {
  upsertSourceRootChild
} from './numbering.service'
import { resolveNodeItemId } from './structure/tree.service'
import type { BomCloneLinkableItem, BomCloneNode, BomCloneStateSnapshot } from '../clone.types'

type AddSelectedLinkableItemsParams = {
  sourceTree: BomCloneNode[]
  selectedNodeIds: string[]
  selectedLinkableItemIds: number[]
  selectedLinkableItemLabelsById?: Record<number, string>
  fetchSourceBomStructure: (itemId: number) => Promise<BomCloneNode[]>
  onItemError?: (error: unknown) => void
  onProgress?: (current: number, total: number) => void
  maxConcurrentAdds?: number
}

type AddSelectedLinkableItemsResult = {
  sourceTree: BomCloneNode[]
  selectedNodeIds: string[]
  itemErrorsById: Record<number, string>
}

function chunkIntoBatches<T>(items: T[], size: number): T[][] {
  const safeSize = Math.max(1, size)
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += safeSize) chunks.push(items.slice(index, index + safeSize))
  return chunks
}

function hasUnresolvedDescriptor(label: string, itemId: number): boolean {
  const normalized = String(label || '').trim()
  if (!normalized) return true
  return normalized === `Item ${itemId}`
}

function createLinkableRootNode(params: {
  itemId: number
  preferredLabel: string
  loadedRoot?: BomCloneNode | null
}): BomCloneNode | null {
  const { itemId, preferredLabel, loadedRoot } = params
  const resolvedLabel = String(preferredLabel || '').trim()
  if (!resolvedLabel) return null

  if (loadedRoot) {
    return {
      ...loadedRoot,
      label: resolvedLabel,
      quantity: String(loadedRoot.quantity || '').trim() || '1.0',
      hasExpandableChildren: loadedRoot.children.length > 0 || loadedRoot.hasExpandableChildren,
      childrenLoaded: loadedRoot.children.length > 0 || loadedRoot.childrenLoaded
    }
  }

  return {
    id: String(itemId),
    label: resolvedLabel,
    number: String(itemId),
    itemNumber: '',
    iconHtml: '',
    revision: '',
    status: '',
    quantity: '1.0',
    unitOfMeasure: '',
    hasExpandableChildren: false,
    childrenLoaded: true,
    children: []
  }
}

export function resolvePreselectedLinkableItemIds(
  snapshot: Pick<BomCloneStateSnapshot, 'sourceBomTree' | 'selectedNodesToClone'>
): number[] {
  const sourceRootId = snapshot.sourceBomTree[0]?.id || null
  const selectedIds = snapshot.selectedNodesToClone
    .filter((nodeId) => nodeId !== sourceRootId)
    .map((nodeId) => {
      const sourceNode = snapshot.sourceBomTree[0]?.children.find((child) => child.id === nodeId) || null
      return sourceNode ? resolveNodeItemId(sourceNode) : Number(nodeId)
    })
    .filter((nodeId) => Number.isFinite(nodeId) && nodeId > 0)
  return Array.from(new Set(selectedIds))
}

export function resolveOnTargetBomItemIdsForDialog(
  snapshot: Pick<BomCloneStateSnapshot, 'targetBomPreExistingItemIds' | 'selectedNodesToClone' | 'sourceBomTree'>
): number[] {
  const onTargetBomIds = new Set<number>(snapshot.targetBomPreExistingItemIds)
  const stagedNodeIds = new Set(snapshot.selectedNodesToClone)
  const sourceRoot = snapshot.sourceBomTree[0]
  if (!sourceRoot) return Array.from(onTargetBomIds)

  for (const child of sourceRoot.children) {
    if (!child.fromLinkableDialog) continue
    if (!stagedNodeIds.has(child.id)) continue
    const numId = resolveNodeItemId(child)
    if (typeof numId === 'number' && numId > 0) onTargetBomIds.add(numId)
  }
  return Array.from(onTargetBomIds)
}

export function resolveFilteredLinkableItems(
  items: BomCloneLinkableItem[],
  currentItemId: number,
  selectedSourceItemId: number | null
): BomCloneLinkableItem[] {
  const excludedItemIds = new Set<number>([currentItemId])
  if (selectedSourceItemId !== null) excludedItemIds.add(selectedSourceItemId)
  return items.filter((item) => !excludedItemIds.has(item.id))
}

export function resolveMergedLinkableItems(
  existingItems: BomCloneLinkableItem[],
  incomingItems: BomCloneLinkableItem[]
): BomCloneLinkableItem[] {
  const byId = new Map<number, BomCloneLinkableItem>()
  for (const existing of existingItems) byId.set(existing.id, existing)
  for (const entry of incomingItems) byId.set(entry.id, entry)
  return Array.from(byId.values())
}

export function resolveSanitizedSelectedLinkableIds(
  loadedItems: BomCloneLinkableItem[],
  selectedItemIds: number[]
): number[] {
  const availableIds = new Set(loadedItems.map((item) => item.id))
  return selectedItemIds.filter((itemId) => availableIds.has(itemId))
}

export async function addSelectedLinkableItemsToSourceTree(
  params: AddSelectedLinkableItemsParams
): Promise<AddSelectedLinkableItemsResult> {
  const {
    fetchSourceBomStructure,
    onItemError,
    onProgress,
    maxConcurrentAdds = 10
  } = params
  const selectedSet = new Set(params.selectedNodeIds)
  const pendingLinkableIds = [...params.selectedLinkableItemIds]
  const totalToProcess = pendingLinkableIds.length

  if (totalToProcess === 0) {
    return {
      sourceTree: params.sourceTree,
      selectedNodeIds: Array.from(selectedSet),
      itemErrorsById: {}
    }
  }

  let latestSourceTree = params.sourceTree
  let processed = 0
  const itemErrorsById: Record<number, string> = {}

  const markChildren = (node: BomCloneNode): BomCloneNode => ({
    ...node,
    fromLinkableDialog: true,
    children: node.children.map(markChildren)
  })

  for (const batch of chunkIntoBatches(pendingLinkableIds, maxConcurrentAdds)) {
    const results = await Promise.allSettled(batch.map(async (itemId) => ({
      itemId,
      sourceTree: await fetchSourceBomStructure(itemId)
    })))
    for (const result of results) {
      processed += 1
      if (result.status !== 'fulfilled') {
        if (onItemError) onItemError(result.reason)
        continue
      }
      const { itemId, sourceTree } = result.value
      const loadedRoot = sourceTree[0]
      const preferredLabel = String(params.selectedLinkableItemLabelsById?.[itemId] || '').trim()
      const failureLabel = preferredLabel || `item ${itemId}`
      const shouldTreatAsNoBom =
        !loadedRoot
        || (
          hasUnresolvedDescriptor(loadedRoot.label, itemId)
          && loadedRoot.children.length === 0
          && !loadedRoot.hasExpandableChildren
        )
      const effectiveRoot = shouldTreatAsNoBom
        ? createLinkableRootNode({ itemId, preferredLabel, loadedRoot })
        : loadedRoot
      if (!effectiveRoot) {
        itemErrorsById[itemId] = `Unable to add ${failureLabel}. Source BOM could not be loaded.`
        continue
      }
      if (hasUnresolvedDescriptor(effectiveRoot.label, itemId)) {
        itemErrorsById[itemId] = `Unable to add ${failureLabel}. Original descriptor could not be resolved.`
        continue
      }
      const markedRoot = markChildren({
        ...effectiveRoot,
        quantity: String(effectiveRoot.quantity || '').trim() || '1.0',
        fromLinkableDialog: true
      })
      const { nodes: updatedSourceTree, nodeId } = upsertSourceRootChild(latestSourceTree, markedRoot)
      latestSourceTree = updatedSourceTree
      selectedSet.add(nodeId)
    }
    if (onProgress) onProgress(processed, totalToProcess)
  }

  return {
    sourceTree: latestSourceTree,
    selectedNodeIds: Array.from(selectedSet),
    itemErrorsById
  }
}


