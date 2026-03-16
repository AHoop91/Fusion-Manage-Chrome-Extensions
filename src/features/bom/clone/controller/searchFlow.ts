import { loadBomViewFields } from '../services/form/fieldDefinitions.service'
import { createEmptyBomClonePermissions, resolveBomClonePermissions } from '../clone.permissions'
import { remapBomFieldValuesByFieldId } from '../services/field.service'
import { resolveDefaultManufacturingOperationNodeId, resolveExpandAllExpandedNodeIds } from '../services/structure/structure.service'
import { collectTopLevelChildItemIdsFromTree } from '../services/structure/tree.service'
import {
  resolveViewDefResolution
} from '../services/form/validation.service'
import type { CloneControllerRefs, CloneRuntime, CloneState, CloneViewHandlers, EmitDiagnostic, ItemSelectorSession, SetHealthState } from './types'
import type { CloneDomAdapter } from '../clone.dom'
import type { CloneService } from '../clone.service'
import type { CloneLaunchMode } from '../clone.types'
import type { ItemSelectorSearchFilterPatch } from '../../../../shared/item-selector/types'

type SearchFlowOptions = {
  state: CloneState
  dom: CloneDomAdapter
  service: CloneService
  runtime: CloneRuntime
  itemSelectorSession: ItemSelectorSession
  refs: CloneControllerRefs
  render: () => void
  emitDiagnostic: EmitDiagnostic
  setHealthState: SetHealthState
  ensureInteractiveFlowsLoaded: () => Promise<void>
  onStructureOpened: () => void
}

type SearchHandlers = Pick<
  CloneViewHandlers,
  | 'onSearchInput'
  | 'onToggleAdvancedMode'
  | 'onGroupLogicExpressionChange'
  | 'onSearchSubmit'
  | 'onSelectResult'
  | 'onLoadItemDetails'
  | 'onCloseDetails'
  | 'onLoadMoreResults'
  | 'onValidateSelection'
  | 'onToggleSearchField'
  | 'onChangeSearchFilter'
  | 'onAddGroup'
  | 'onRemoveGroup'
  | 'onAddFilterRow'
  | 'onRemoveFilterRow'
>

export function createCloneSearchFlow(options: SearchFlowOptions): {
  buildSearchHandlers: () => SearchHandlers
  openCloneModal: (mode: CloneLaunchMode) => Promise<void>
  validateAndLoadStructure: () => Promise<void>
} {
  const {
    state,
    dom,
    service,
    runtime,
    itemSelectorSession,
    refs,
    render,
    emitDiagnostic,
    setHealthState,
    ensureInteractiveFlowsLoaded,
    onStructureOpened
  } = options

  async function validateAndLoadStructure(): Promise<void> {
    const activeContext = refs.getContext()
    if (!activeContext) return
    const refreshedPermissions = await resolveBomClonePermissions(
      runtime,
      activeContext.tenant,
      activeContext.workspaceId,
      true
    ).catch(() => createEmptyBomClonePermissions())
    state.setPermissions(refreshedPermissions)
    state.setPermissionsLoading(false)
    state.setPermissionsResolved(true)

    const snapshot = state.getSnapshot()
    if (!snapshot.permissions.canOpen) {
      state.setErrorMessage('BOM clone is unavailable for current permissions.')
      render()
      return
    }
    const sourceItemId = snapshot.selectedSourceItemId
    if (!sourceItemId) {
      state.setErrorMessage('Select an item to continue.')
      render()
      return
    }

    state.setClonePhase('validation')
    state.setLoading(true)
    state.setErrorMessage(null)
    state.setValidationStatus(['Loading Bill of Materials'])
    render()

    try {
      // Intentional spec drift: validation remains non-blocking so BOM loading
      // can continue even when linkable-items is strict/empty for current view.
      try {
        const valid = await service.validateLinkableItem(activeContext, sourceItemId)
        if (!valid) emitDiagnostic('VALIDATION_FAILURE', `sourceItemId:${sourceItemId}`)
      } catch (validationError) {
        emitDiagnostic('VALIDATION_FAILURE', String(validationError))
      }

      state.setBomViewFieldsLoading(true)
      const viewFieldsResult = await loadBomViewFields(
        activeContext.workspaceId,
        activeContext.tenant,
        (action, payload) => runtime.requestPlmAction(action, payload)
      ).catch(() => null)

      if (viewFieldsResult) {
        state.setBomViewFields(
          viewFieldsResult.fields,
          viewFieldsResult.metaLinks,
          viewFieldsResult.viewDefFieldIdToFieldId,
          viewFieldsResult.viewDefIds
        )
      } else {
        state.setBomViewFieldsLoading(false)
      }

      let sourceBomTree: typeof snapshot.sourceBomTree = []
      let targetBomTree: typeof snapshot.targetBomTree = []
      let targetChildIds: number[] = []
      const fieldViewDefIds = viewFieldsResult?.viewDefIds || []
      if (snapshot.cloneLaunchMode === 'manufacturing') {
        const bomContext = { ...activeContext, viewDefId: null }
        const [loadedSourceBomTree, loadedTargetBomTree] = await Promise.all([
          service.fetchSourceBomStructure(bomContext, sourceItemId, { depth: 100 }),
          service.fetchSourceBomStructure(bomContext, bomContext.currentItemId, { depth: 100 })
        ])
        sourceBomTree = loadedSourceBomTree
        targetBomTree = loadedTargetBomTree
        targetChildIds = await service.fetchTargetBomChildItemIds(bomContext).catch(() =>
          collectTopLevelChildItemIdsFromTree(loadedTargetBomTree, bomContext.currentItemId)
        )
        state.setBomViewDefId(null)
      } else {
        const viewDefResolution = resolveViewDefResolution(activeContext, fieldViewDefIds, [])

        const persistedViewDefId =
          viewFieldsResult?.firstViewDefId
          ?? activeContext.viewDefId
          ?? null
        if (persistedViewDefId !== null) state.setBomViewDefId(persistedViewDefId)

        const [loadedSourceBomTree, loadedTargetBomTree, loadedTargetChildIds] = await Promise.all([
          service.fetchSourceBomStructure(viewDefResolution.sourceContext, sourceItemId, { depth: 100 }),
          service.fetchSourceBomStructure(viewDefResolution.targetContext, viewDefResolution.targetContext.currentItemId, { depth: 100 }),
          service.fetchTargetBomChildItemIds(viewDefResolution.targetContext).catch(() => [] as number[])
        ])
        sourceBomTree = loadedSourceBomTree
        targetBomTree = loadedTargetBomTree
        targetChildIds = loadedTargetChildIds
      }
      const viewDefFieldIdToFieldId = viewFieldsResult?.viewDefFieldIdToFieldId || {}
      const normalizedSourceBomTree = remapBomFieldValuesByFieldId(sourceBomTree, viewDefFieldIdToFieldId)
      const normalizedTargetBomTree = remapBomFieldValuesByFieldId(targetBomTree, viewDefFieldIdToFieldId)
      if (normalizedSourceBomTree[0] && snapshot.detailsItemLabel.trim()) {
        normalizedSourceBomTree[0] = {
          ...normalizedSourceBomTree[0],
          label: snapshot.detailsItemLabel.trim()
        }
      }
      if (
        normalizedTargetBomTree[0]
        && /^Item\s+\d+$/i.test(String(normalizedTargetBomTree[0].label || '').trim())
      ) {
        const currentItemDescriptor = await runtime.requestPlmAction('getItemDescriptor', {
          tenant: activeContext.tenant,
          workspaceId: activeContext.workspaceId,
          dmsId: activeContext.currentItemId
        }).catch(() => null)
        if (typeof currentItemDescriptor === 'string' && currentItemDescriptor.trim()) {
          normalizedTargetBomTree[0] = {
            ...normalizedTargetBomTree[0],
            label: currentItemDescriptor.trim()
          }
        }
      }
      state.setSourceBomTree(normalizedSourceBomTree)
      state.setTargetBomTree(normalizedTargetBomTree)
      const manufacturingSelectedOperationNodeId = snapshot.cloneLaunchMode === 'manufacturing'
        ? resolveDefaultManufacturingOperationNodeId({
          targetBomTree: normalizedTargetBomTree,
          sourceBomTree: normalizedSourceBomTree
        })
        : null
      if (snapshot.cloneLaunchMode === 'manufacturing') {
        state.setManufacturingSelectedOperationNodeId(manufacturingSelectedOperationNodeId)
      }
      state.setTargetBomPreExistingItemIds(targetChildIds)
      state.setLinkableOnTargetBomItemIds(targetChildIds)
      const shouldExpandOnOpen = snapshot.cloneLaunchMode === 'manufacturing'
      const engineeringSourceRootId = normalizedSourceBomTree[0]?.id || null
      const engineeringTargetRootId = normalizedTargetBomTree[0]?.id || null
      const sourceExpandedNodeIds = shouldExpandOnOpen
        ? resolveExpandAllExpandedNodeIds(
          {
            sourceBomTree: normalizedSourceBomTree,
            targetBomTree: normalizedTargetBomTree,
            selectedNodesToClone: snapshot.selectedNodesToClone
          },
          'source'
        )
        : (engineeringSourceRootId ? [engineeringSourceRootId] : [])
      const targetExpandedNodeIds = shouldExpandOnOpen
        ? resolveExpandAllExpandedNodeIds(
          {
            sourceBomTree: normalizedSourceBomTree,
            targetBomTree: normalizedTargetBomTree,
            selectedNodesToClone: snapshot.selectedNodesToClone
          },
          'target'
        )
        : (engineeringTargetRootId ? [engineeringTargetRootId] : [])
      state.setSourceExpandedNodeIds(sourceExpandedNodeIds)
      state.setTargetExpandedNodeIds(targetExpandedNodeIds)
      state.setInitialTargetState(
        normalizedTargetBomTree,
        targetExpandedNodeIds,
        targetChildIds,
        targetChildIds,
        manufacturingSelectedOperationNodeId
      )
      await ensureInteractiveFlowsLoaded()
      state.setClonePhase('structure')
      dom.closeSearchModalShell()
      refs.setSearchModalRoot(null)
      const nextStructureRoot = dom.openStructureModalShell()
      refs.setStructureModalRoot(nextStructureRoot)
      if (!nextStructureRoot) {
        state.setClonePhase('search')
        state.setErrorMessage('Failed to open structure modal.')
      }
      else onStructureOpened()
      setHealthState('enabled')
    } catch (error) {
      state.setClonePhase('search')
      state.setErrorMessage(`Failed to load BOM structure. ${error instanceof Error ? error.message : String(error)}`)
      emitDiagnostic('BOM_STRUCTURE_PARSING_FAILURE', String(error))
    } finally {
      state.setValidationStatus([])
      state.setLoading(false)
      render()
    }
  }

  async function openCloneModal(mode: CloneLaunchMode): Promise<void> {
    const activeContext = refs.getContext()
    if (!activeContext) return
    const existingPermissions = await resolveBomClonePermissions(
      runtime,
      activeContext.tenant,
      activeContext.workspaceId,
      true
    ).catch(() => createEmptyBomClonePermissions())
    state.setPermissions(existingPermissions)
    state.setPermissionsLoading(false)
    state.setPermissionsResolved(true)
    if (!existingPermissions.canOpen) return
    const nextSearchRoot = dom.openSearchModalShell()
    refs.setSearchModalRoot(nextSearchRoot)
    if (!nextSearchRoot) {
      setHealthState('disabled')
      return
    }
    dom.closeStructureModalShell()
    refs.setStructureModalRoot(null)

    state.reset()
    state.setPermissions(existingPermissions)
    state.setPermissionsLoading(false)
    state.setPermissionsResolved(true)
    state.setCloneLaunchMode(mode)
    refs.setHasCommittedOperations(false)
    state.setClonePhase('search')
    itemSelectorSession.onToggleAdvancedMode(false)
    render()

    await itemSelectorSession.initialize()
  }

  function buildSearchHandlers(): SearchHandlers {
    return {
      onSearchInput(value: string) {
        itemSelectorSession.onSearchInput(value)
      },
      onToggleAdvancedMode(nextAdvancedMode: boolean) {
        itemSelectorSession.onToggleAdvancedMode(nextAdvancedMode)
      },
      onGroupLogicExpressionChange(value: string) {
        itemSelectorSession.onGroupLogicExpressionChange(value)
      },
      onSearchSubmit() {
        void itemSelectorSession.runSearch(0, false)
      },
      onSelectResult(itemId: number) {
        state.setSelectedSourceItemId(itemId)
        void itemSelectorSession.loadItemDetails(itemId)
        render()
      },
      onLoadItemDetails(itemId: number) {
        void itemSelectorSession.loadItemDetails(itemId)
      },
      onCloseDetails() {
        itemSelectorSession.closeDetails()
      },
      onLoadMoreResults() {
        if (!itemSelectorSession.canLoadMore()) return
        void itemSelectorSession.runSearch(state.getSnapshot().searchResults.length, true)
      },
      onValidateSelection() {
        void validateAndLoadStructure()
      },
      onToggleSearchField() {
        // legacy no-op; replaced by dropdown-based filter builder
      },
      onChangeSearchFilter(groupId: string, filterId: string, patch: ItemSelectorSearchFilterPatch) {
        itemSelectorSession.onChangeSearchFilter(groupId, filterId, patch)
      },
      onAddGroup() {
        itemSelectorSession.onAddGroup()
      },
      onRemoveGroup(groupId: string) {
        itemSelectorSession.onRemoveGroup(groupId)
      },
      onAddFilterRow(groupId: string) {
        itemSelectorSession.onAddFilterRow(groupId)
      },
      onRemoveFilterRow(groupId: string, filterId: string) {
        itemSelectorSession.onRemoveFilterRow(groupId, filterId)
      }
    }
  }

  return {
    buildSearchHandlers,
    openCloneModal,
    validateAndLoadStructure
  }
}


