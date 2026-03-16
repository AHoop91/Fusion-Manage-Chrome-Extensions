import {
  addSelectedLinkableItemsToSourceTree,
  resolveFilteredLinkableItems,
  resolveMergedLinkableItems,
  resolveOnTargetBomItemIdsForDialog
} from '../services/linkable.service'
import {
  isManufacturingProcessNodeId,
  pruneManufacturingAssignmentsForOperation,
  removeStagedOperationDraftNode,
  resolveDefaultManufacturingOperationNodeId,
  resolveEditPanelSave
} from '../services/structure/structure.service'
import { findNode } from '../services/structure/tree.service'
import type { CloneControllerRefs, CloneState, CloneViewHandlers, EmitDiagnostic } from './types'
import type { CloneService } from '../clone.service'

type EditFlowOptions = {
  state: CloneState
  service: CloneService
  refs: CloneControllerRefs
  render: () => void
  emitDiagnostic: EmitDiagnostic
  updateSelectedNodes: (nextSelectedNodeIds: string[]) => void
  clearLinkableSearchDebounceTimer: () => void
  ensureOperationFormMetadataLoaded: () => Promise<void>
  ensureNodeMetadataHydratedForEditing: (nodeId: string, mode: 'item' | 'bom') => Promise<void>
}

type EditPanelHandlers = Pick<
  CloneViewHandlers,
  | 'onEditNode'
  | 'onCloseEditPanel'
  | 'onSaveEditPanel'
  | 'onToggleEditPanelRequiredOnly'
>

type LinkableHandlers = Pick<
  CloneViewHandlers,
  | 'onOpenLinkableDialog'
  | 'onCloseLinkableDialog'
  | 'onLinkableSearchInput'
  | 'onToggleLinkableItem'
  | 'onToggleLinkableDisplayOnlySelected'
  | 'onToggleLinkableShowOnlyErrors'
  | 'onResizeLinkableColumn'
  | 'onClearLinkableSelection'
  | 'onLinkableDialogScrollNearEnd'
  | 'onAddSelectedLinkableItems'
>

export function createCloneEditFlow(options: EditFlowOptions): {
  buildEditPanelHandlers: () => EditPanelHandlers
  buildLinkableHandlers: () => LinkableHandlers
} {
  const {
    state,
    service,
    refs,
    render,
    emitDiagnostic,
    updateSelectedNodes,
    clearLinkableSearchDebounceTimer,
    ensureOperationFormMetadataLoaded,
    ensureNodeMetadataHydratedForEditing
  } = options

  function canEditTargetNode(nodeId: string): boolean {
    const snapshot = state.getSnapshot()
    const targetNode = findNode(snapshot.targetBomTree, nodeId)
    if (targetNode?.stagedOperationDraft || targetNode?.stagedSplitDraft) return snapshot.permissions.canAdd
    if (snapshot.selectedNodesToClone.includes(nodeId) && !targetNode) return snapshot.permissions.canAdd
    return false
  }

  async function loadLinkableItems(offset: number, append: boolean): Promise<void> {
    const activeContext = refs.getContext()
    if (!activeContext) return
    const snapshot = state.getSnapshot()
    state.setLinkableLoading(true)
    if (!append) state.setLinkableError(null)
    render()

    try {
      const result = await service.fetchLinkableItems(activeContext, {
        search: snapshot.linkableSearch,
        offset,
        limit: snapshot.linkableLimit || 100
      })
      const filteredItems = resolveFilteredLinkableItems(
        result.items,
        activeContext.currentItemId,
        snapshot.selectedSourceItemId
      )

      let nextItems: typeof filteredItems
      if (append) {
        nextItems = resolveMergedLinkableItems(snapshot.linkableItems, filteredItems)
        state.appendLinkableItems(filteredItems, result.totalCount, result.offset, result.limit)
      } else {
        const retainedSelectedItems = snapshot.linkableItems.filter((item) =>
          snapshot.linkableSelectedItemIds.includes(item.id)
        )
        nextItems = resolveMergedLinkableItems(retainedSelectedItems, filteredItems)
        state.setLinkableItems(nextItems, result.totalCount, result.offset, result.limit)
      }
    } catch (error) {
      state.setLinkableError(`Failed to load linkable items. ${error instanceof Error ? error.message : String(error)}`)
      emitDiagnostic('SEARCH_API_FAILURE', String(error))
    } finally {
      state.setLinkableLoading(false)
      render()
    }
  }

  async function addSelectedLinkableItems(): Promise<void> {
    const activeContext = refs.getContext()
    if (!activeContext) return
    const snapshot = state.getSnapshot()
    const selectedLinkableIds = [...snapshot.linkableSelectedItemIds]
    if (selectedLinkableIds.length === 0) return
    const selectedLinkableItemLabelsById = Object.fromEntries(
      snapshot.linkableItems
        .filter((item) => selectedLinkableIds.includes(item.id))
        .map((item) => [item.id, item.label])
    )

    try {
      const totalToProcess = selectedLinkableIds.length
      state.setLinkableAdding(true)
      state.setLinkableError(null)
      state.setLinkableAddProgress(0, totalToProcess)
      render()

      if (totalToProcess === 0) {
        state.setLinkableDialogOpen(false)
        state.setLinkableSelectedItemIds([])
        state.setLinkableDisplayOnlySelected(false)
        state.setLinkableAddProgress(0, 0)
        return
      }

      const mergeResult = await addSelectedLinkableItemsToSourceTree({
        sourceTree: state.getSnapshot().sourceBomTree,
        selectedNodeIds: state.getSnapshot().selectedNodesToClone,
        selectedLinkableItemIds: selectedLinkableIds,
        selectedLinkableItemLabelsById,
        fetchSourceBomStructure: (itemId) => service.fetchSourceBomStructure(activeContext, itemId),
        onItemError: (error) => emitDiagnostic('BOM_STRUCTURE_PARSING_FAILURE', String(error)),
        onProgress: (current, total) => {
          state.setLinkableAddProgress(current, total)
          render()
        },
        maxConcurrentAdds: 10
      })

      state.setSourceBomTree(mergeResult.sourceTree)
      state.setSourceExpandedNodeIds(mergeResult.sourceTree.map((node) => node.id))
      const latestSnapshot = state.getSnapshot()
      if (latestSnapshot.cloneLaunchMode === 'manufacturing') {
        const beforeSelected = new Set(latestSnapshot.selectedNodesToClone)
        const selectedOperationId = latestSnapshot.manufacturingSelectedOperationNodeId || null
        const operationId = isManufacturingProcessNodeId(latestSnapshot, selectedOperationId)
          ? selectedOperationId
          : null
        for (const nodeId of mergeResult.selectedNodeIds) {
          if (beforeSelected.has(nodeId)) continue
          state.setManufacturingSourceOperation(nodeId, operationId)
        }
        updateSelectedNodes(mergeResult.selectedNodeIds)
        const postStageSnapshot = state.getSnapshot()
        const expanded = new Set(postStageSnapshot.targetExpandedNodeIds)
        const targetRootId = postStageSnapshot.targetBomTree[0]?.id || null
        if (targetRootId) expanded.add(targetRootId)
        for (const nodeId of mergeResult.selectedNodeIds) {
          if (beforeSelected.has(nodeId)) continue
          const parentOperationId = postStageSnapshot.manufacturingOperationBySourceNodeId[nodeId] || null
          if (parentOperationId) expanded.add(parentOperationId)
        }
        state.setTargetExpandedNodeIds(Array.from(expanded))
      } else {
        updateSelectedNodes(mergeResult.selectedNodeIds)
      }

      const failedItemIdSet = new Set(Object.keys(mergeResult.itemErrorsById).map((itemId) => Number(itemId)))
      state.setLinkableItemErrors(
        Object.fromEntries(
          Object.entries(mergeResult.itemErrorsById).map(([itemId, message]) => [String(itemId), message])
        )
      )
      state.setLinkableSelectedItemIds(selectedLinkableIds.filter((itemId) => failedItemIdSet.has(itemId)))
      if (failedItemIdSet.size > 0) {
        state.setLinkableError(null)
        state.setLinkableDisplayOnlySelected(false)
        state.setLinkableAddProgress(0, 0)
        return
      }

      state.setLinkableDialogOpen(false)
      state.setLinkableSelectedItemIds([])
      state.setLinkableDisplayOnlySelected(false)
      state.setLinkableItemErrors({})
      state.setLinkableShowOnlyErrors(false)
      state.setLinkableAddProgress(0, 0)
    } catch (error) {
      state.setLinkableError(`Failed to add selected item. ${error instanceof Error ? error.message : String(error)}`)
      emitDiagnostic('BOM_STRUCTURE_PARSING_FAILURE', String(error))
    } finally {
      state.setLinkableAdding(false)
      if (state.getSnapshot().linkableDialogOpen) state.setLinkableAddProgress(0, 0)
      render()
    }
  }

  function buildEditPanelHandlers(): EditPanelHandlers {
    return {
      onEditNode(nodeId: string) {
        void (async () => {
          if (!canEditTargetNode(nodeId)) return
          state.setEditingPanelMode('item')
          state.setEditingNodeId(nodeId)
          render()
          await ensureNodeMetadataHydratedForEditing(nodeId, 'item')
          const targetNode = findNode(state.getSnapshot().targetBomTree, nodeId)
          if (targetNode?.stagedOperationDraft) {
            await ensureOperationFormMetadataLoaded()
          }
          render()
        })()
      },
      onCloseEditPanel(options) {
        const nodeId = state.getSnapshot().editingNodeId
        const shouldDiscardDraft = Boolean(options?.discardDraft && nodeId)
        if (shouldDiscardDraft && nodeId) {
          const snapshot = state.getSnapshot()
          const targetNode = findNode(snapshot.targetBomTree, nodeId)
          if (targetNode?.stagedOperationDraft) {
            const removeDraftResult = removeStagedOperationDraftNode(snapshot, nodeId)
            state.setTargetBomTree(removeDraftResult.nextTargetBomTree)
            updateSelectedNodes(removeDraftResult.nextSelectedNodeIds)
            const latestSnapshot = state.getSnapshot()
            state.setManufacturingOperationAssignments(
              pruneManufacturingAssignmentsForOperation(
                latestSnapshot.manufacturingOperationBySourceNodeId,
                nodeId
              )
            )
            if (latestSnapshot.manufacturingSelectedOperationNodeId === nodeId) {
              state.setManufacturingSelectedOperationNodeId(
                resolveDefaultManufacturingOperationNodeId({
                  targetBomTree: removeDraftResult.nextTargetBomTree,
                  sourceBomTree: latestSnapshot.sourceBomTree
                })
              )
            }
            state.setTargetItemNumberOverride(nodeId, null)
            state.setTargetQuantityOverride(nodeId, null)
            state.setTargetFieldOverride(nodeId, {})
          }
        }
        state.setEditingNodeId(null)
        render()
      },
      onSaveEditPanel(nodeId: string, values: Record<string, string>) {
        const saveResult = resolveEditPanelSave(state.getSnapshot(), nodeId, values)
        state.setTargetFieldOverride(nodeId, saveResult.fieldOverrides)
        state.setTargetQuantityOverride(nodeId, saveResult.quantityOverride)
        if (saveResult.nextTargetBomTree) state.setTargetBomTree(saveResult.nextTargetBomTree)
        state.setEditingNodeId(null)
        render()
      },
      onToggleEditPanelRequiredOnly(value: boolean) {
        state.setEditPanelRequiredOnly(value)
        render()
      }
    }
  }

  function buildLinkableHandlers(): LinkableHandlers {
    return {
      onOpenLinkableDialog() {
        const openSnapshot = state.getSnapshot()
        if (!openSnapshot.permissions.canAdd) return
        state.setLinkableDialogOpen(true)
        state.setLinkableError(null)
        state.setLinkableItemErrors({})
        state.setLinkableShowOnlyErrors(false)
        state.setLinkableSelectedItemIds([])
        state.setLinkableDisplayOnlySelected(false)
        state.setLinkableAddProgress(0, 0)
        state.setLinkableOnTargetBomItemIds(resolveOnTargetBomItemIdsForDialog(openSnapshot))
        render()
        void loadLinkableItems(0, false)
      },
      onCloseLinkableDialog() {
        clearLinkableSearchDebounceTimer()
        state.setLinkableDialogOpen(false)
        state.setLinkableError(null)
        state.setLinkableItemErrors({})
        state.setLinkableShowOnlyErrors(false)
        state.setLinkableAddProgress(0, 0)
        render()
      },
      onLinkableSearchInput(value: string) {
        state.setLinkableSearch(value)
        clearLinkableSearchDebounceTimer()
        const timer = window.setTimeout(() => {
          refs.setLinkableSearchDebounceTimer(null)
          void loadLinkableItems(0, false)
        }, 280)
        refs.setLinkableSearchDebounceTimer(timer)
      },
      onToggleLinkableItem(itemId: number, selected: boolean) {
        const next = new Set(state.getSnapshot().linkableSelectedItemIds)
        if (selected) next.add(itemId)
        else next.delete(itemId)
        const nextIds = Array.from(next)
        state.setLinkableSelectedItemIds(nextIds)
        if (nextIds.length === 0) state.setLinkableDisplayOnlySelected(false)
        render()
      },
      onToggleLinkableDisplayOnlySelected() {
        const snapshot = state.getSnapshot()
        if (snapshot.linkableSelectedItemIds.length === 0) return
        const nextEnabled = !snapshot.linkableDisplayOnlySelected
        if (nextEnabled && snapshot.linkableSearch.trim()) {
          clearLinkableSearchDebounceTimer()
          state.setLinkableSearch('')
          state.setLinkableDisplayOnlySelected(true)
          render()
          void loadLinkableItems(0, false)
          return
        }
        state.setLinkableDisplayOnlySelected(nextEnabled)
        render()
      },
      onToggleLinkableShowOnlyErrors() {
        const snapshot = state.getSnapshot()
        if (Object.keys(snapshot.linkableItemErrors).length === 0) return
        state.setLinkableShowOnlyErrors(!snapshot.linkableShowOnlyErrors)
        render()
      },
      onResizeLinkableColumn(column: 'item' | 'workspace' | 'lifecycle', width: number) {
        state.setLinkableColumnWidth(column, width)
        render()
      },
      onClearLinkableSelection() {
        state.setLinkableSelectedItemIds([])
        state.setLinkableDisplayOnlySelected(false)
        render()
      },
      onLinkableDialogScrollNearEnd() {
        const snapshot = state.getSnapshot()
        if (snapshot.linkableDisplayOnlySelected) return
        if (snapshot.linkableLoading) return
        if (snapshot.linkableItems.length >= snapshot.linkableTotal) return
        void loadLinkableItems(snapshot.linkableItems.length, true)
      },
      onAddSelectedLinkableItems() {
        void addSelectedLinkableItems()
      }
    }
  }

  return {
    buildEditPanelHandlers,
    buildLinkableHandlers
  }
}


