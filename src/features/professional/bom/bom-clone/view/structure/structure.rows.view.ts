import type { BomCloneStateSnapshot } from '../../clone.types'
import type { RequiredFieldCompletion } from '../../services/viewModel.service'
import type { BomCloneStructureRow } from '../../services/structure/tree.service'

const ACTIVE_DRAG_NODE_ATTR = 'data-plm-bom-clone-drag-node-id'
const NUMBER_COLUMN_BASE_WIDTH = 72
const NUMBER_COLUMN_STEP_WIDTH = 8
const NUMBER_COLUMN_MAX_WIDTH = 128
const NUMBER_COLUMN_MAX_WIDTH_MANUFACTURING = 220

export const MANUFACTURING_NUMBER_LAYOUT = Object.freeze({
  selectorColumnWidth: 34
})

export type CloneStructureHandlers = {
  onToggleNode: (nodeId: string, selected: boolean) => void
  onToggleSourceNodeExpanded: (nodeId: string) => void
  onSetSourceStatusFilter: (value: BomCloneStateSnapshot['sourceStatusFilter']) => void
  onToggleTargetNodeExpanded: (nodeId: string) => void
  onExpandAllSource: () => void
  onCollapseAllSource: () => void
  onExpandAllTarget: () => void
  onCollapseAllTarget: () => void
  onSelectManufacturingOperation: (nodeId: string) => void
  onSelectManufacturingRoot: () => void
  onAddOperation: () => void
  onToggleShowCommitErrorsOnly: () => void
  onOpenLinkableDialog: () => void
  onDropNodeToTarget: (nodeId: string, targetOperationNodeId?: string | null) => void
  onDropSourceAssemblySubcomponentsToTarget: (nodeId: string) => void
  onSplitSourceNode: (nodeId: string) => void
  onAddRemainingSourceNode: (nodeId: string) => void
  onRemoveTargetNode: (nodeId: string) => void
  onSplitTargetNode: (nodeId: string) => void
  onEditTargetItemNumber: (nodeId: string, value: string) => void
  onEditTargetQuantity: (nodeId: string, value: string) => void
  onReorderTargetNode: (
    draggedNodeId: string,
    targetNodeId: string,
    placement: 'before' | 'after' | 'inside'
  ) => void
  onOpenProcessItemDetails: (nodeId: string) => void
  onOpenProcessBomDetails: (nodeId: string) => void
  onEditNode: (nodeId: string) => void
  onCloseEditPanel: (options?: { discardDraft?: boolean }) => void
  onSaveEditPanel: (nodeId: string, values: Record<string, string>) => void
  onToggleEditPanelRequiredOnly: (value: boolean) => void
}

export function applyRequiredIndicator(
  indicator: HTMLSpanElement,
  completion: RequiredFieldCompletion
): void {
  indicator.classList.remove('is-complete', 'is-missing')
  if (completion.requiredCount === 0 || completion.isComplete) {
    indicator.classList.add('is-complete')
    indicator.innerHTML = '&#10004;'
    indicator.title = 'All required fields completed.'
    return
  }

  indicator.classList.add('is-missing')
  indicator.innerHTML = '&#9888;'
  const plural = completion.missingCount === 1 ? 'field' : 'fields'
  indicator.title = `${completion.missingCount} required ${plural} missing.`
}

export function resolveNumberColumnWidth(
  rows: BomCloneStructureRow[],
  options?: { manufacturing?: boolean }
): number {
  const hasRootDescriptorRow = rows.some((row) => row.level < 0)
  const maxLevel = rows.reduce((max, row) => Math.max(max, row.level), 0)
  const effectiveDepth = Math.max(0, maxLevel) + (hasRootDescriptorRow ? 1 : 0)
  const baseWidth = Math.min(
    NUMBER_COLUMN_BASE_WIDTH + (effectiveDepth * NUMBER_COLUMN_STEP_WIDTH),
    NUMBER_COLUMN_MAX_WIDTH
  )

  if (!options?.manufacturing) return baseWidth

  const deepestLevel = Math.max(0, maxLevel)
  const maxNumberDigits = rows.reduce((maxDigits, row) => {
    const digits = Math.max(1, getDisplayItemNumber(row.node.itemNumber || '').length)
    return Math.max(maxDigits, Math.min(digits, 4))
  }, 1)
  const numberValueWidth = maxNumberDigits * 8

  const processRowWidth =
    (MANUFACTURING_NUMBER_LAYOUT.selectorColumnWidth * 3) +
    16 +
    numberValueWidth
  const childRowWidth =
    (deepestLevel * MANUFACTURING_NUMBER_LAYOUT.selectorColumnWidth) +
    20 +
    MANUFACTURING_NUMBER_LAYOUT.selectorColumnWidth +
    24 +
    16 +
    numberValueWidth

  const manufacturingWidth = Math.max(processRowWidth, childRowWidth)
  return Math.min(
    Math.max(baseWidth, manufacturingWidth),
    NUMBER_COLUMN_MAX_WIDTH_MANUFACTURING
  )
}

export function getDisplayItemNumber(raw: string): string {
  const normalized = String(raw || '').trim()
  if (!normalized) return ''

  const parts = normalized
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean)
  const tail = parts.length > 0 ? parts[parts.length - 1] : normalized
  const numericTail = /(\d+)(?!.*\d)/.exec(tail)
  if (numericTail?.[1]) return numericTail[1]

  const numericAny = /(\d+)(?!.*\d)/.exec(normalized)
  return numericAny?.[1] || tail
}

export function getDraggedNodeId(event: DragEvent): string {
  return (
    event.dataTransfer?.getData('text/plain') ||
    document.body?.getAttribute(ACTIVE_DRAG_NODE_ATTR) ||
    ''
  )
}
