import type { BomCloneNode } from '../../clone.types'

export type TargetReorderResult = {
  nextTargetBomTree: BomCloneNode[] | null
  nextSelectedNodeIds: string[]
  nextTargetItemNumberOverrides: Record<string, string>
  nextManufacturingOperationAssignments?: Record<string, string>
}

export type TargetReorderPlacement = 'before' | 'after' | 'inside'

export type RemoveTargetNodeResult = {
  nextSelectedNodeIds: string[]
  nextMarkedForDeleteNodeIds: string[]
  unstageNode: boolean
}

export type QuantityEditResult = {
  quantityOverride: string | null
  fieldOverrides: Record<string, string> | null
}

export type EditPanelSaveResult = {
  fieldOverrides: Record<string, string>
  quantityOverride: string | null
  nextTargetBomTree: BomCloneNode[] | null
}

export type StagedOperationDraftResult = {
  draftNodeId: string | null
  nextTargetBomTree: BomCloneNode[]
  nextSelectedNodeIds: string[]
}

export type ManufacturingSplitProcessOption = {
  operationNodeId: string
  label: string
}

export type ManufacturingSplitDialogModel = {
  sourceNodeId: string
  descriptor: string
  totalQuantity: string
  remainingQuantity: string
  currentQuantity: string
  maxSplitQuantity: string
  unitOfMeasure: string
  processOptions: ManufacturingSplitProcessOption[]
}

export type ManufacturingSplitApplyResult =
  | {
    ok: true
    nextTargetBomTree: BomCloneNode[]
    nextSelectedNodeIds: string[]
    nextTargetQuantityOverrides: Record<string, string>
    nextManufacturingOperationAssignments: Record<string, string>
    nextTargetItemNumberOverrides: Record<string, string>
  }
  | {
    ok: false
    errorMessage: string
  }
