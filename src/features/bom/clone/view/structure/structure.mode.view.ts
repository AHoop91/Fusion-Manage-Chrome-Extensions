import type { BomCloneStateSnapshot } from '../../clone.types'
import type { BomCloneStructureRow } from '../../services/structure/tree.service'
import { isManufacturingProcessNodeId } from '../../services/structure/structure.service'

export type CloneStructureTargetAddExistingState = {
  label: string
  enabled: boolean
  tooltip: string
  ariaLabel: string
}

export type CloneStructureTargetModeAction = {
  label: string
  tooltip: string
  ariaLabel: string
  iconClassName: string
}

export type CloneStructureModeView = {
  resolveSelectedOperationNodeId: (snapshot: BomCloneStateSnapshot) => string | null
  shouldHighlightTargetRow: (snapshot: BomCloneStateSnapshot, row: BomCloneStructureRow, isSource: boolean) => boolean
  shouldRenderOperationSelector: (snapshot: BomCloneStateSnapshot, row: BomCloneStructureRow, isSource: boolean) => boolean
  onExternalDropToTargetRow: (targetRowNodeId: string, onSelectOperation: (nodeId: string) => void) => void
  sourceAddRequiresOperationSelection: (snapshot: BomCloneStateSnapshot) => boolean
  shouldRenderStagedChildRemove: (
    snapshot: BomCloneStateSnapshot,
    row: BomCloneStructureRow,
    selectedNodeIds: Set<string>,
    targetExistingNodeIds: Set<string>,
    isSource: boolean
  ) => boolean
  stagedChildRemoveLabel: (descriptor: string) => string
  resolveTargetAddExistingState: (
    snapshot: BomCloneStateSnapshot,
    topLevelTargetNodeIds: string[]
  ) => CloneStructureTargetAddExistingState
  resolveTargetModeAction: (snapshot: BomCloneStateSnapshot) => CloneStructureTargetModeAction | null
}

function createEngineeringStructureModeView(): CloneStructureModeView {
  return {
    resolveSelectedOperationNodeId() {
      return null
    },
    shouldHighlightTargetRow() {
      return false
    },
    shouldRenderOperationSelector() {
      return false
    },
    onExternalDropToTargetRow() {
      // Engineering mode has no operation-selection side effect.
    },
    sourceAddRequiresOperationSelection(_snapshot) {
      return false
    },
    shouldRenderStagedChildRemove() {
      return false
    },
    stagedChildRemoveLabel(descriptor: string) {
      return `Remove ${descriptor} from target BOM`
    },
    resolveTargetAddExistingState() {
      return {
        label: 'Add',
        enabled: true,
        tooltip: 'Add item',
        ariaLabel: 'Add item'
      }
    },
    resolveTargetModeAction() {
      return null
    }
  }
}

function createManufacturingStructureModeView(): CloneStructureModeView {
  return {
    resolveSelectedOperationNodeId(snapshot) {
      return snapshot.manufacturingSelectedOperationNodeId || null
    },
    shouldHighlightTargetRow(snapshot, row, isSource) {
      if (isSource || row.level !== 0) return false
      const selectedOperationNodeId = snapshot.manufacturingSelectedOperationNodeId || null
      return selectedOperationNodeId === row.id
    },
    shouldRenderOperationSelector(_snapshot, row, isSource) {
      return !isSource
        && row.level === 0
        && isManufacturingProcessNodeId(_snapshot, row.id)
    },
    onExternalDropToTargetRow(targetRowNodeId, onSelectOperation) {
      onSelectOperation(targetRowNodeId)
    },
    sourceAddRequiresOperationSelection() {
      return false
    },
    shouldRenderStagedChildRemove(_snapshot, row, selectedNodeIds, targetExistingNodeIds, isSource) {
      if (isSource || row.level <= 0) return false
      if (row.node.stagedSplitDraft) return true
      if (!selectedNodeIds.has(row.id)) return false
      return !targetExistingNodeIds.has(row.id)
    },
    stagedChildRemoveLabel(descriptor: string) {
      return `Remove ${descriptor} from staged manufacturing process`
    },
    resolveTargetAddExistingState(snapshot, _topLevelTargetNodeIds) {
      const hasSelectedOperation = Boolean(snapshot.manufacturingSelectedOperationNodeId)
      return {
        label: 'Add Existing',
        enabled: true,
        tooltip: hasSelectedOperation ? 'Add existing item to selected process' : 'Add existing item to root MBOM',
        ariaLabel: hasSelectedOperation ? 'Add existing item to selected process' : 'Add existing item to root MBOM'
      }
    },
    resolveTargetModeAction() {
      return {
        label: 'Add Process',
        tooltip: 'Add Process',
        ariaLabel: 'Add Process',
        iconClassName: 'zmdi zmdi-wrench'
      }
    }
  }
}

const engineeringModeView = createEngineeringStructureModeView()
const manufacturingModeView = createManufacturingStructureModeView()

export function resolveStructureModeView(snapshot: BomCloneStateSnapshot): CloneStructureModeView {
  return snapshot.cloneLaunchMode === 'manufacturing'
    ? manufacturingModeView
    : engineeringModeView
}


