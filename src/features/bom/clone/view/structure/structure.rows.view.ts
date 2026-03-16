import type { BomCloneStateSnapshot } from '../../clone.types'
import { findNode, resolveNodeItemId, type BomCloneStructureRow } from '../../services/structure/tree.service'
import { resolveManufacturingProcessNodeIds } from '../../services/structure/structure.service'
import {
  buildRowRequiredValidationSummary,
  type RequiredFieldCompletion,
  type SourceRowDiscrepancy,
  type SourceRowStatus
} from '../../services/viewModel.service'
import { resolveStructureModeView } from './structure.mode.view'

const ACTIVE_DRAG_NODE_ATTR = 'data-plm-bom-clone-drag-node-id'
const NUMBER_COLUMN_BASE_WIDTH = 72
const NUMBER_COLUMN_STEP_WIDTH = 8
const NUMBER_COLUMN_MAX_WIDTH = 128
const NUMBER_COLUMN_MAX_WIDTH_MANUFACTURING = 220
const SVG_NS = 'http://www.w3.org/2000/svg'
let cubeGlyphTemplate: SVGSVGElement | null = null
let listAddGlyphTemplate: SVGSVGElement | null = null
let splitBalanceGlyphTemplate: SVGSVGElement | null = null

export const MANUFACTURING_NUMBER_LAYOUT = Object.freeze({
  selectorColumnWidth: 34
})

type StructureActionTone = 'add' | 'edit' | 'remove' | 'open'

export function applyRequiredIndicator(indicator: HTMLSpanElement, completion: RequiredFieldCompletion): void {
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

function createCubeGlyphIcon(): SVGSVGElement {
  if (cubeGlyphTemplate) return cubeGlyphTemplate.cloneNode(true) as SVGSVGElement

  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'plm-extension-bom-structure-part-glyph')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', '20')
  svg.setAttribute('height', '20')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')

  const wire = document.createElementNS(SVG_NS, 'path')
  wire.setAttribute(
    'd',
    [
      'M12 3L4 8V16L12 21L20 16V8Z', // outer cube silhouette
      'M4 8L12 13L20 8', // top inside edges
      'M12 13V21' // center vertical edge
    ].join(' ')
  )
  wire.setAttribute('fill', 'none')
  wire.setAttribute('stroke', 'currentColor')
  wire.setAttribute('stroke-width', '2.4')
  wire.setAttribute('stroke-linecap', 'round')
  wire.setAttribute('stroke-linejoin', 'round')

  svg.append(wire)
  cubeGlyphTemplate = svg
  return cubeGlyphTemplate.cloneNode(true) as SVGSVGElement
}

function createListAddGlyphIcon(): SVGSVGElement {
  if (listAddGlyphTemplate) return listAddGlyphTemplate.cloneNode(true) as SVGSVGElement

  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'plm-extension-bom-structure-list-add-glyph')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', '24')
  svg.setAttribute('height', '24')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')

  const listBox = document.createElementNS(SVG_NS, 'rect')
  listBox.setAttribute('x', '2.5')
  listBox.setAttribute('y', '3')
  listBox.setAttribute('width', '14.5')
  listBox.setAttribute('height', '17')
  listBox.setAttribute('rx', '2.2')
  listBox.setAttribute('fill', 'none')
  listBox.setAttribute('stroke', 'currentColor')
  listBox.setAttribute('stroke-width', '2')

  const listLines = document.createElementNS(SVG_NS, 'path')
  listLines.setAttribute('d', 'M5.8 8H13.5 M5.8 11.7H13.5 M5.8 15.4H13.5')
  listLines.setAttribute('fill', 'none')
  listLines.setAttribute('stroke', 'currentColor')
  listLines.setAttribute('stroke-width', '2')
  listLines.setAttribute('stroke-linecap', 'round')

  const badge = document.createElementNS(SVG_NS, 'circle')
  badge.setAttribute('cx', '18.5')
  badge.setAttribute('cy', '18.5')
  badge.setAttribute('r', '4.5')
  badge.setAttribute('fill', 'currentColor')

  const badgeRing = document.createElementNS(SVG_NS, 'circle')
  badgeRing.setAttribute('cx', '18.5')
  badgeRing.setAttribute('cy', '18.5')
  badgeRing.setAttribute('r', '4.5')
  badgeRing.setAttribute('fill', 'none')
  badgeRing.setAttribute('stroke', '#ffffff')
  badgeRing.setAttribute('stroke-width', '1.2')

  const plus = document.createElementNS(SVG_NS, 'path')
  plus.setAttribute('d', 'M18.5 16.1V20.9 M16.1 18.5H20.9')
  plus.setAttribute('fill', 'none')
  plus.setAttribute('stroke', '#ffffff')
  plus.setAttribute('stroke-width', '2')
  plus.setAttribute('stroke-linecap', 'round')

  svg.append(listBox, listLines, badge, badgeRing, plus)
  listAddGlyphTemplate = svg
  return listAddGlyphTemplate.cloneNode(true) as SVGSVGElement
}

function createSplitBalanceGlyphIcon(): SVGSVGElement {
  if (splitBalanceGlyphTemplate) return splitBalanceGlyphTemplate.cloneNode(true) as SVGSVGElement

  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('class', 'plm-extension-bom-structure-split-glyph')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', '22')
  svg.setAttribute('height', '22')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')

  const leftBar = document.createElementNS(SVG_NS, 'rect')
  leftBar.setAttribute('x', '8.4')
  leftBar.setAttribute('y', '2.8')
  leftBar.setAttribute('width', '2.4')
  leftBar.setAttribute('height', '18.4')
  leftBar.setAttribute('rx', '1.2')
  leftBar.setAttribute('fill', 'currentColor')

  const rightBar = document.createElementNS(SVG_NS, 'rect')
  rightBar.setAttribute('x', '13.2')
  rightBar.setAttribute('y', '2.8')
  rightBar.setAttribute('width', '2.4')
  rightBar.setAttribute('height', '18.4')
  rightBar.setAttribute('rx', '1.2')
  rightBar.setAttribute('fill', 'currentColor')

  const leftArrow = document.createElementNS(SVG_NS, 'path')
  leftArrow.setAttribute(
    'd',
    'M8.4 10.9H4.9L6.6 9.2L5.4 8L2.2 11.2L5.4 14.4L6.6 13.2L4.9 11.5H8.4V10.9Z'
  )
  leftArrow.setAttribute('fill', 'currentColor')

  const rightArrow = document.createElementNS(SVG_NS, 'path')
  rightArrow.setAttribute(
    'd',
    'M15.6 10.9H19.1L17.4 9.2L18.6 8L21.8 11.2L18.6 14.4L17.4 13.2L19.1 11.5H15.6V10.9Z'
  )
  rightArrow.setAttribute('fill', 'currentColor')

  svg.append(leftBar, rightBar, leftArrow, rightArrow)
  splitBalanceGlyphTemplate = svg
  return splitBalanceGlyphTemplate.cloneNode(true) as SVGSVGElement
}

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
  onReorderTargetNode: (draggedNodeId: string, targetNodeId: string, placement: 'before' | 'after' | 'inside') => void
  onOpenProcessItemDetails: (nodeId: string) => void
  onOpenProcessBomDetails: (nodeId: string) => void
  onEditNode: (nodeId: string) => void
  onCloseEditPanel: (options?: { discardDraft?: boolean }) => void
  onSaveEditPanel: (nodeId: string, values: Record<string, string>) => void
  onToggleEditPanelRequiredOnly: (value: boolean) => void
}

export function resolveNumberColumnWidth(
  rows: BomCloneStructureRow[],
  options?: { manufacturing?: boolean }
): number {
  const hasRootDescriptorRow = rows.some((row) => row.level < 0)
  const maxLevel = rows.reduce((max, row) => Math.max(max, row.level), 0)
  const effectiveDepth = Math.max(0, maxLevel) + (hasRootDescriptorRow ? 1 : 0)
  const baseWidth = Math.min(NUMBER_COLUMN_BASE_WIDTH + (effectiveDepth * NUMBER_COLUMN_STEP_WIDTH), NUMBER_COLUMN_MAX_WIDTH)

  if (!options?.manufacturing) return baseWidth

  const deepestLevel = Math.max(0, maxLevel)
  const maxNumberDigits = rows.reduce((maxDigits, row) => {
    const digits = Math.max(1, getDisplayItemNumber(row.node.itemNumber || '').length)
    return Math.max(maxDigits, Math.min(digits, 4))
  }, 1)
  const numberValueWidth = maxNumberDigits * 8

  const processRowWidth =
    (MANUFACTURING_NUMBER_LAYOUT.selectorColumnWidth * 3)
    + 16
    + numberValueWidth
  const childRowWidth =
    resolveManufacturingIndentPx(deepestLevel)
    + 20
    + MANUFACTURING_NUMBER_LAYOUT.selectorColumnWidth
    + 24
    + 16
    + numberValueWidth

  const manufacturingWidth = Math.max(processRowWidth, childRowWidth)
  return Math.min(Math.max(baseWidth, manufacturingWidth), NUMBER_COLUMN_MAX_WIDTH_MANUFACTURING)
}

function resolveManufacturingIndentPx(level: number): number {
  return Math.max(0, level) * MANUFACTURING_NUMBER_LAYOUT.selectorColumnWidth
}

/**
 * Normalizes item-number text for UI display.
 */
export function getDisplayItemNumber(raw: string): string {
  const normalized = String(raw || '').trim()
  if (!normalized) return ''
  const parts = normalized.split('.').map((part) => part.trim()).filter(Boolean)
  const tail = parts.length > 0 ? parts[parts.length - 1] : normalized
  const numericTail = /(\d+)(?!.*\d)/.exec(tail)
  if (numericTail?.[1]) return numericTail[1]
  const numericAny = /(\d+)(?!.*\d)/.exec(normalized)
  return numericAny?.[1] || tail
}

/**
 * Builds node expand/collapse control for structure rows.
 */
export function buildNodeControl(
  hasChildren: boolean,
  expanded: boolean,
  loading: boolean,
  onToggle: () => void
): HTMLElement {
  if (!hasChildren) {
    const spacer = document.createElement('span')
    spacer.className = 'plm-extension-bom-structure-chevron-spacer'
    spacer.setAttribute('aria-hidden', 'true')
    return spacer
  }

  const chevron = document.createElement('button')
  chevron.type = 'button'
  chevron.className = `plm-extension-bom-structure-chevron${loading ? ' is-loading' : ''}`

  const icon = document.createElement('span')
  icon.className = loading ? 'zmdi zmdi-refresh zmdi-hc-spin' : (expanded ? 'zmdi zmdi-chevron-down' : 'zmdi zmdi-chevron-right')
  chevron.appendChild(icon)

  if (loading) chevron.disabled = true
  chevron.addEventListener('click', (event) => {
    event.stopPropagation()
    chevron.disabled = true
    chevron.classList.add('is-loading')
    icon.className = 'zmdi zmdi-refresh zmdi-hc-spin'
    onToggle()
  })
  return chevron
}

function setActiveDragNodeId(nodeId: string | null): void {
  if (!document.body) return
  if (!nodeId) {
    document.body.removeAttribute(ACTIVE_DRAG_NODE_ATTR)
    return
  }
  document.body.setAttribute(ACTIVE_DRAG_NODE_ATTR, nodeId)
}

export function getDraggedNodeId(event: DragEvent): string {
  return event.dataTransfer?.getData('text/plain')
    || document.body?.getAttribute(ACTIVE_DRAG_NODE_ATTR)
    || ''
}

function structureActionButton(
  iconClassName: string | HTMLElement | SVGElement,
  tone: StructureActionTone,
  ariaLabel: string,
  onClick: (() => void) | null,
  disabled = false
): HTMLButtonElement {
  const buttonEl = document.createElement('button')
  buttonEl.type = 'button'
  buttonEl.className = `plm-extension-bom-structure-action-btn plm-extension-btn plm-extension-btn--secondary is-${tone}`
  buttonEl.disabled = disabled
  buttonEl.title = ariaLabel
  buttonEl.setAttribute('aria-label', ariaLabel)
  if (typeof iconClassName === 'string') {
    const icon = document.createElement('span')
    icon.className = iconClassName
    icon.setAttribute('aria-hidden', 'true')
    buttonEl.appendChild(icon)
  } else {
    const iconHost = document.createElement('span')
    iconHost.className = 'plm-extension-bom-structure-action-icon-host'
    iconHost.setAttribute('aria-hidden', 'true')
    iconHost.appendChild(iconClassName)
    buttonEl.appendChild(iconHost)
  }
  if (onClick) buttonEl.addEventListener('click', onClick)
  return buttonEl
}

function canAddToBom(snapshot: Pick<BomCloneStateSnapshot, 'permissions'>): boolean {
  return snapshot.permissions.canAdd
}

function canEditTargetRow(
  snapshot: Pick<BomCloneStateSnapshot, 'permissions'>,
  isNewlyStagedTargetRow: boolean
): boolean {
  return snapshot.permissions.canAdd && isNewlyStagedTargetRow
}

function canRemoveTargetRow(
  snapshot: Pick<BomCloneStateSnapshot, 'permissions'>,
  isPersistedTargetRow: boolean,
  isNewlyStagedTargetRow: boolean
): boolean {
  if (isPersistedTargetRow) return snapshot.permissions.canDelete
  return isNewlyStagedTargetRow
}

function canSplitTargetRowForPermissions(
  snapshot: Pick<BomCloneStateSnapshot, 'permissions'>,
  isPersistedTargetRow: boolean,
  isNewlyStagedTargetRow: boolean
): boolean {
  if (isPersistedTargetRow) return snapshot.permissions.canDelete
  return snapshot.permissions.canAdd && isNewlyStagedTargetRow
}

export function renderStructureRows(
  body: HTMLElement,
  rows: BomCloneStructureRow[],
  sourceStatusByNodeId: Record<string, SourceRowStatus>,
  sourceDiscrepancyByNodeId: Record<string, SourceRowDiscrepancy>,
  sourceAllLeafPartsOnTargetByNodeId: Record<string, boolean>,
  snapshot: BomCloneStateSnapshot,
  selectedNodeIds: Set<string>,
  markedForDeleteIds: Set<string>,
  targetExistingNodeIds: Set<string>,
  targetTableNodeIds: Set<string>,
  pendingAddNodeIds: Set<string>,
  handlers: CloneStructureHandlers,
  isSource: boolean
): void {
  const modeView = resolveStructureModeView(snapshot)
  const hasRootDescriptorRow = rows.some((entry) => entry.level < 0)
  const expandingNodeIds = new Set(snapshot.expandingNodeIds)
  const failedCommitNodeIds = new Set(
    snapshot.commitErrors
      .map((entry) => String(entry.nodeId || '').trim())
      .filter(Boolean)
  )
  const canEvaluateRequiredFields = !snapshot.bomViewFieldsLoading
  const selectedOperationNodeId = modeView.resolveSelectedOperationNodeId(snapshot)
  const manufacturingProcessNodeIds = snapshot.cloneLaunchMode === 'manufacturing'
    ? resolveManufacturingProcessNodeIds(snapshot)
    : new Set<string>()
  const targetPreExistingItemIds = new Set(snapshot.targetBomPreExistingItemIds.map((id) => Number(id)).filter(Number.isFinite))
  const targetRowIds = new Set(rows.map((row) => row.id))
  const rowById = new Map(rows.map((row) => [row.id, row]))
  const rowParentById = new Map<string, string | null>()
  const rowAncestors: Array<{ id: string; level: number }> = []
  for (const row of rows) {
    if (row.level < 0) {
      rowParentById.set(row.id, null)
      rowAncestors.length = 0
      continue
    }
    while (rowAncestors.length > 0 && rowAncestors[rowAncestors.length - 1].level >= row.level) rowAncestors.pop()
    rowParentById.set(row.id, rowAncestors.length > 0 ? rowAncestors[rowAncestors.length - 1].id : null)
    rowAncestors.push({ id: row.id, level: row.level })
  }
  const sourceTopLevelNodeIds = new Set(
    isSource
      ? (
        snapshot.sourceBomTree[0]?.children?.length
          ? snapshot.sourceBomTree[0].children
          : snapshot.sourceBomTree
      ).map((node) => node.id)
      : []
  )
  const hasEditableBomFields = snapshot.bomViewFields.some((field) => field.editable)
  const activeDropRows = new Set<HTMLTableRowElement>()
  const clearDropIndicators = (): void => {
    if (activeDropRows.size === 0) return
    for (const activeRow of Array.from(activeDropRows)) {
      activeRow.classList.remove('is-over-before', 'is-over-after', 'is-over-inside', 'is-drop-gap-before', 'is-drop-gap-after')
    }
    activeDropRows.clear()
  }
  for (const row of rows) {
    const isRootDescriptorRow = row.level < 0
    const tr = document.createElement('tr')
    if (isRootDescriptorRow) {
      tr.className = 'plm-extension-bom-structure-root-row'

      const mergedCell = document.createElement('td')
      mergedCell.colSpan = 4
      mergedCell.className = 'plm-extension-bom-structure-root-merged-cell'
      const rootWrap = document.createElement('div')
      rootWrap.className = 'plm-extension-bom-structure-root-wrap'
      const useStructuredTreeLayout = snapshot.cloneLaunchMode === 'engineering'
      const rootPrefixBox = document.createElement('span')
      rootPrefixBox.className = (isSource && snapshot.cloneLaunchMode === 'manufacturing') || useStructuredTreeLayout
        ? 'plm-extension-bom-structure-root-prefix-host'
        : 'plm-extension-bom-structure-root-prefix-box'
      let rootPrefix: HTMLElement
      if (!isSource && snapshot.cloneLaunchMode === 'manufacturing') {
        const rootRadio = document.createElement('input')
        rootRadio.type = 'radio'
        rootRadio.name = 'plm-bom-clone-manufacturing-operation'
        rootRadio.className = 'plm-extension-bom-structure-operation-radio plm-extension-bom-structure-root-radio'
        rootRadio.checked = !selectedOperationNodeId
        rootRadio.title = 'Select root to add process'
        rootRadio.setAttribute('aria-label', 'Select root to add process')
        rootRadio.addEventListener('change', () => {
          if (!rootRadio.checked) return
          handlers.onSelectManufacturingRoot()
        })
        rootPrefix = rootRadio
      } else if ((isSource && snapshot.cloneLaunchMode === 'manufacturing') || useStructuredTreeLayout) {
        const iconWrap = document.createElement('span')
        iconWrap.className = 'plm-extension-bom-structure-root-icon-box'
        const rootIcon = document.createElement('span')
        rootIcon.className = 'zmdi zmdi-layers plm-extension-bom-structure-root-assembly-icon'
        rootIcon.setAttribute('aria-hidden', 'true')
        iconWrap.appendChild(rootIcon)
        rootPrefix = iconWrap
      } else {
        const iconWrap = document.createElement('span')
        iconWrap.className = 'plm-extension-bom-structure-root-prefix'
        const rootIcon = document.createElement('span')
        rootIcon.className = 'zmdi zmdi-layers'
        rootIcon.setAttribute('aria-hidden', 'true')
        iconWrap.appendChild(rootIcon)
        rootPrefix = iconWrap
      }
      rootPrefixBox.appendChild(rootPrefix)
      const descriptorScroll = document.createElement('div')
      descriptorScroll.className = 'plm-extension-bom-structure-descriptor-scroll'
      descriptorScroll.textContent = row.node.label
      descriptorScroll.title = row.node.label
      rootWrap.appendChild(rootPrefixBox)
      rootWrap.appendChild(descriptorScroll)
      mergedCell.appendChild(rootWrap)
      tr.appendChild(mergedCell)
      body.appendChild(tr)
      continue
    }

    const isSourceTopLevel = isSource && sourceTopLevelNodeIds.has(row.id)
    const isManufacturingSource = isSource && snapshot.cloneLaunchMode === 'manufacturing'
    const isSourceComponent = !row.hasChildren
    const canAddFromSourceRow = (isManufacturingSource ? isSourceComponent : isSourceTopLevel) && canAddToBom(snapshot)
    const showOperationSelector = modeView.shouldRenderOperationSelector(snapshot, row, isSource)
    if (isSource) {
      tr.className = 'plm-extension-bom-structure-source-tr'
      tr.draggable = canAddFromSourceRow
      tr.dataset.nodeId = row.id
      tr.addEventListener('dragstart', (event) => {
        if (!canAddFromSourceRow) {
          event.preventDefault()
          return
        }
        setActiveDragNodeId(row.id)
        event.dataTransfer?.setData('text/plain', row.id)
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
      })
      tr.addEventListener('dragend', () => {
        setActiveDragNodeId(null)
      })
    }

    const isManufacturingMode = snapshot.cloneLaunchMode === 'manufacturing'
    const useStructuredTreeLayout = isManufacturingMode || snapshot.cloneLaunchMode === 'engineering'
    const isTargetTopLevel = !isSource && row.level === 0
    const isManufacturingTargetTopLevel = isManufacturingMode && isTargetTopLevel
    const isAddProcessRow = isManufacturingTargetTopLevel
      && manufacturingProcessNodeIds.has(row.id)
    const originalTargetNode = !isSource ? findNode(snapshot.targetBomTree, row.id) : null
    const targetItemId = !isSource ? resolveNodeItemId(row.node) : null
    const isPersistedTargetRow = !isSource
      && Boolean(originalTargetNode)
      && !originalTargetNode?.stagedOperationDraft
      && !originalTargetNode?.stagedSplitDraft
      && (
        targetExistingNodeIds.has(row.id)
        || (targetItemId !== null && targetPreExistingItemIds.has(targetItemId))
        || Boolean(String(originalTargetNode?.bomEdgeId || row.node.bomEdgeId || '').trim())
      )
    const isNewlyStagedTargetRow = !isSource
      && !isPersistedTargetRow
      && (
        selectedNodeIds.has(row.id)
        || Boolean(row.node.stagedOperationDraft)
        || Boolean(row.node.stagedSplitDraft)
      )
    let hasMarkedDeleteAncestor = false
    if (!isSource) {
      let ancestorId = rowParentById.get(row.id) || null
      while (ancestorId) {
        if (markedForDeleteIds.has(ancestorId)) {
          hasMarkedDeleteAncestor = true
          break
        }
        ancestorId = rowParentById.get(ancestorId) || null
      }
    }
    const isMarkedForDelete = isPersistedTargetRow && markedForDeleteIds.has(row.id)
    const isEffectivelyMarkedForDelete = isMarkedForDelete || hasMarkedDeleteAncestor
    const isStagedSplitDraftRow = Boolean(row.node.stagedSplitDraft)
    const operationNodeIds = manufacturingProcessNodeIds
    const currentOperationNodeId = String(snapshot.manufacturingOperationBySourceNodeId[row.id] || '').trim()
    const hasSplitDestination = snapshot.cloneLaunchMode === 'manufacturing'
      ? (
          currentOperationNodeId
            ? Array.from(operationNodeIds).some((operationId) => operationId !== currentOperationNodeId)
            : operationNodeIds.size > 0
        )
      : false
    const splitSourceNodeId = String(row.node.splitSourceNodeId || row.id || '').trim()
    const splitSourceNode = !isSource && splitSourceNodeId
      ? findNode(snapshot.sourceBomTree, splitSourceNodeId)
      : null
    const isSplitComponentCandidate = Boolean(
      splitSourceNode
      && !splitSourceNode.hasExpandableChildren
      && splitSourceNode.children.length === 0
    )
    const canSplitTargetRow = !isSource
      && snapshot.cloneLaunchMode === 'manufacturing'
      && !row.node.stagedOperationDraft
      && isSplitComponentCandidate
      && hasSplitDestination
      && (selectedNodeIds.has(row.id) || isPersistedTargetRow || isStagedSplitDraftRow)
      && !isEffectivelyMarkedForDelete
      && canSplitTargetRowForPermissions(snapshot, isPersistedTargetRow, isNewlyStagedTargetRow)
    const canEditCurrentTargetRow = canEditTargetRow(snapshot, isNewlyStagedTargetRow)
    const canRemoveCurrentTargetRow = canRemoveTargetRow(snapshot, isPersistedTargetRow, isNewlyStagedTargetRow)
    const hasQtyOverride = Object.prototype.hasOwnProperty.call(snapshot.targetQuantityOverrides, row.id)
    const discrepancyNodeId = !isSource
      ? String(row.node.splitSourceNodeId || row.id || '').trim()
      : row.id
    const targetSourceDiscrepancy: SourceRowDiscrepancy = sourceDiscrepancyByNodeId[discrepancyNodeId] || {
      severity: 'none',
      sourceQuantity: '0.0',
      allocatedQuantity: '0.0',
      remainingQuantity: '0.0',
      tooltip: null
    }
    const showTargetQtyMismatch = !isSource && !isEffectivelyMarkedForDelete && targetSourceDiscrepancy.severity !== 'none'
    if (useStructuredTreeLayout) tr.classList.add('plm-extension-bom-structure-row-manufacturing')
    if (!isSource && isEffectivelyMarkedForDelete) tr.classList.add('plm-extension-bom-structure-row-marked-delete')

    if (!isSource) {
      const isManufacturingSelectedRow = isManufacturingMode && selectedNodeIds.has(row.id)
      const canDragTargetRow = !isEffectivelyMarkedForDelete && (isTargetTopLevel || isManufacturingSelectedRow)
      if (canDragTargetRow) {
        tr.draggable = true
        tr.classList.add('plm-extension-bom-structure-target-draggable')
      }
      tr.addEventListener('dragstart', (event) => {
        const eventTarget = event.target
        if (eventTarget instanceof HTMLElement && eventTarget.closest('input, textarea, [contenteditable="true"]')) {
          event.preventDefault()
          event.stopPropagation()
          return
        }
        if (!canDragTargetRow) {
          event.preventDefault()
          return
        }
        tr.classList.add('is-dragging')
        setActiveDragNodeId(row.id)
        event.dataTransfer?.setData('text/plain', row.id)
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
      })
      tr.addEventListener('dragend', () => {
        tr.classList.remove('is-dragging')
        clearDropIndicators()
        setActiveDragNodeId(null)
      })
      tr.addEventListener('dragover', (event) => {
        event.preventDefault()
        event.stopPropagation()
        const draggedNodeId = getDraggedNodeId(event)
        if (!draggedNodeId || draggedNodeId === row.id) return
        clearDropIndicators()

        const isDraggingTargetRow = targetRowIds.has(draggedNodeId)
        const draggedRow = rowById.get(draggedNodeId)
        if (isDraggingTargetRow && isManufacturingMode && draggedRow && draggedRow.level > 0 && isAddProcessRow) {
          tr.classList.add('is-over-inside')
          activeDropRows.add(tr)
          return
        }

        const rect = tr.getBoundingClientRect()
        const placement: 'before' | 'after' = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
        tr.classList.add(placement === 'before' ? 'is-over-before' : 'is-over-after')
        activeDropRows.add(tr)
        const sibling = placement === 'before' ? tr.previousElementSibling : tr.nextElementSibling
        if (sibling instanceof HTMLTableRowElement) {
          sibling.classList.add(placement === 'before' ? 'is-drop-gap-after' : 'is-drop-gap-before')
          activeDropRows.add(sibling)
        }
      })
      tr.addEventListener('dragleave', (event) => {
        const nextTarget = event.relatedTarget
        if (nextTarget instanceof Node && tr.contains(nextTarget)) return
        clearDropIndicators()
      })
      tr.addEventListener('drop', (event) => {
        event.preventDefault()
        event.stopPropagation()
        clearDropIndicators()
        const draggedNodeId = getDraggedNodeId(event)
        if (!draggedNodeId || draggedNodeId === row.id) return

        if (!targetRowIds.has(draggedNodeId)) {
          if (!snapshot.permissions.canAdd) return
          if (isManufacturingTargetTopLevel && !isAddProcessRow) {
            handlers.onSelectManufacturingRoot()
          } else if (isManufacturingMode && row.level > 0) {
            const parentId = rowParentById.get(row.id) || null
            if (parentId) handlers.onSelectManufacturingOperation(parentId)
            else handlers.onSelectManufacturingRoot()
          } else {
            modeView.onExternalDropToTargetRow(row.id, handlers.onSelectManufacturingOperation)
          }
          handlers.onDropNodeToTarget(draggedNodeId)
          return
        }

        const draggedRow = rowById.get(draggedNodeId)
        if (isManufacturingMode && draggedRow && draggedRow.level > 0 && isAddProcessRow) {
          handlers.onReorderTargetNode(draggedNodeId, row.id, 'inside')
          tr.classList.add('is-dropped')
          window.setTimeout(() => tr.classList.remove('is-dropped'), 180)
          return
        }

        const rect = tr.getBoundingClientRect()
        const placement: 'before' | 'after' = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
        handlers.onReorderTargetNode(draggedNodeId, row.id, placement)
        tr.classList.add('is-dropped')
        window.setTimeout(() => tr.classList.remove('is-dropped'), 180)
      })
    }

    const numberWrap = document.createElement('div')
    numberWrap.className = 'plm-extension-bom-structure-number'
    const showProcessSelectorRow = isAddProcessRow
    if (showProcessSelectorRow) tr.classList.add('plm-extension-bom-structure-process-selector-row')
    const visualLevel = row.level + (hasRootDescriptorRow ? 1 : 0)
    const indentPx = showProcessSelectorRow
      ? 0
      : useStructuredTreeLayout
        ? resolveManufacturingIndentPx(row.level)
        : Math.min(visualLevel * 12, 40)
    numberWrap.style.paddingLeft = `${indentPx}px`
    if (showProcessSelectorRow) numberWrap.classList.add('is-process-selector-row')
    const showTreeIconBox = useStructuredTreeLayout && !showProcessSelectorRow
    const showAssemblyIconBox = showTreeIconBox && row.hasChildren
    const showPartIconBox = showTreeIconBox && !row.hasChildren
    const allowChevronToggle = row.hasChildren
    const nodeControl = allowChevronToggle
      ? buildNodeControl(row.hasChildren, row.expanded, expandingNodeIds.has(row.id), () =>
        isSource ? handlers.onToggleSourceNodeExpanded(row.id) : handlers.onToggleTargetNodeExpanded(row.id)
      )
      : buildNodeControl(false, false, false, () => {})

    let operationRadio: HTMLInputElement | null = null
    if (showOperationSelector) {
      operationRadio = document.createElement('input')
      operationRadio.type = 'radio'
      operationRadio.name = 'plm-bom-clone-manufacturing-operation'
      operationRadio.className = 'plm-extension-bom-structure-operation-radio'
      operationRadio.checked = selectedOperationNodeId === row.id
      operationRadio.title = `Use ${row.node.label} as active process`
      operationRadio.setAttribute('aria-label', `Use ${row.node.label} as active process`)
      const radioInput = operationRadio
      operationRadio.addEventListener('change', () => {
        if (!radioInput.checked) return
        handlers.onSelectManufacturingOperation(row.id)
      })
    }
    if (showProcessSelectorRow) {
      numberWrap.appendChild(nodeControl)
      if (operationRadio) {
        const radioBox = document.createElement('span')
        radioBox.className = 'plm-extension-bom-structure-operation-radio-box'
        radioBox.appendChild(operationRadio)
        numberWrap.appendChild(radioBox)
      }
    } else {
      numberWrap.appendChild(nodeControl)
      if (showAssemblyIconBox) {
        const assemblyBox = document.createElement('span')
        assemblyBox.className = 'plm-extension-bom-structure-assembly-icon-box'
        const assemblyIcon = createCubeGlyphIcon()
        assemblyIcon.classList.add('is-assembly-badge')
        assemblyBox.appendChild(assemblyIcon)
        numberWrap.appendChild(assemblyBox)
      } else if (showPartIconBox) {
        const partBox = document.createElement('span')
        partBox.className = 'plm-extension-bom-structure-part-icon-box'
        const partIcon = createCubeGlyphIcon()
        partBox.appendChild(partIcon)
        numberWrap.appendChild(partBox)
      }
      if (operationRadio) numberWrap.appendChild(operationRadio)
    }
    const numberValue = document.createElement('span')
    numberValue.className = 'plm-extension-bom-structure-number-value'
    const effectiveNumber = isSource
      ? row.node.itemNumber
      : snapshot.targetItemNumberOverrides[row.id] ?? row.node.itemNumber ?? ''
    numberValue.textContent = getDisplayItemNumber(effectiveNumber)
    if (!isSource && failedCommitNodeIds.has(row.id)) numberValue.classList.add('is-commit-failed')
    numberWrap.appendChild(numberValue)
    const descriptorScroll = document.createElement('div')
    descriptorScroll.className = 'plm-extension-bom-structure-descriptor-scroll'
    descriptorScroll.textContent = row.node.label
    descriptorScroll.title = row.node.label

    const tdQty = document.createElement('td')
    tdQty.className = 'plm-extension-bom-structure-qty-cell'
    const defaultQty = row.node.stagedOperationDraft ? '1.0' : '0.0'
    const effectiveQty = String(snapshot.targetQuantityOverrides[row.id] ?? row.node.quantity ?? '').trim() || defaultQty
    if (!isSource && !isEffectivelyMarkedForDelete && canEditCurrentTargetRow) {
      const qtyInput = document.createElement('input')
      qtyInput.type = 'text'
      qtyInput.inputMode = 'decimal'
      qtyInput.setAttribute('pattern', '^\\d*(\\.\\d*)?$')
      qtyInput.className = 'plm-extension-bom-structure-edit-input plm-extension-bom-structure-qty-input'
      qtyInput.value = effectiveQty
      qtyInput.setAttribute('data-plm-focus-key', `target-qty-${row.id}`)
      qtyInput.addEventListener('mousedown', (event) => event.stopPropagation())
      qtyInput.addEventListener('dragstart', (event) => {
        event.preventDefault()
        event.stopPropagation()
      })
      qtyInput.addEventListener('blur', () => {
        if (!String(qtyInput.value || '').trim()) {
          qtyInput.value = defaultQty
          handlers.onEditTargetQuantity(row.id, qtyInput.value)
        }
      })
      qtyInput.addEventListener('input', () => {
        const current = qtyInput.value
        const sanitized = current
          .replace(/[^\d.]/g, '')
          .replace(/(\..*)\./g, '$1')
        if (sanitized !== current) qtyInput.value = sanitized
      })
      if (showTargetQtyMismatch) qtyInput.classList.add('is-qty-modified')
      qtyInput.addEventListener('change', () => handlers.onEditTargetQuantity(row.id, qtyInput.value))
      tdQty.appendChild(qtyInput)
    } else {
      if (showTargetQtyMismatch) tdQty.classList.add('is-qty-modified')
      tdQty.textContent = isSource ? (String(row.node.quantity || '').trim() || '0.0') : effectiveQty
    }

    const shouldShowRequiredWarning = !isSource
      && !isEffectivelyMarkedForDelete
      && canEvaluateRequiredFields
      && (
        isTargetTopLevel
        || (
          snapshot.cloneLaunchMode === 'manufacturing'
          && row.level > 0
          && (selectedNodeIds.has(row.id) || isStagedSplitDraftRow)
        )
      )

    let requiredIndicator: HTMLSpanElement | null = null
    if (shouldShowRequiredWarning) {
      const requiredSummary = buildRowRequiredValidationSummary(
        snapshot,
        row.node,
        snapshot.cloneLaunchMode === 'manufacturing' && isAddProcessRow
      )
      const indicator = document.createElement('span')
      indicator.className = 'plm-extension-bom-structure-required-indicator'
      indicator.setAttribute('data-plm-required-indicator-node-id', row.id)
      applyRequiredIndicator(indicator, requiredSummary.combined)
      indicator.title = requiredSummary.tooltip
      requiredIndicator = indicator
    }

    const tdAction = document.createElement('td')
    tdAction.className = 'plm-extension-bom-structure-action-cell'
    const actionWrap = document.createElement('div')
    actionWrap.className = 'plm-extension-bom-structure-action-wrap'
    let requiredIndicatorAppended = false

    if (isSource) {
      const sourceStatus: SourceRowStatus = sourceStatusByNodeId[row.id]
        || (targetTableNodeIds.has(row.id) && hasQtyOverride
          ? 'modified'
          : targetTableNodeIds.has(row.id)
            ? 'added'
            : 'not-added')
      const sourceDiscrepancy: SourceRowDiscrepancy = sourceDiscrepancyByNodeId[row.id] || {
        severity: 'none',
        sourceQuantity: '0.0',
        allocatedQuantity: '0.0',
        remainingQuantity: '0.0',
        tooltip: null
      }

      if (!row.hasChildren) {
        const sourceStatusRail = document.createElement('span')
        sourceStatusRail.className = 'plm-extension-bom-structure-status-rail'
        sourceStatusRail.classList.add(
          sourceStatus === 'added'
            ? 'is-added'
            : sourceStatus === 'modified'
              ? 'is-modified'
              : 'is-not-added'
        )
        actionWrap.appendChild(sourceStatusRail)

        if (sourceDiscrepancy.severity !== 'none' && sourceDiscrepancy.tooltip) {
          const discrepancy = document.createElement('span')
          discrepancy.className = `plm-extension-bom-structure-source-discrepancy is-${sourceDiscrepancy.severity}`
          discrepancy.title = sourceDiscrepancy.tooltip
          discrepancy.setAttribute('aria-label', sourceDiscrepancy.tooltip)
          const icon = document.createElement('span')
          icon.className = 'zmdi zmdi-alert-triangle'
          icon.setAttribute('aria-hidden', 'true')
          discrepancy.appendChild(icon)
          actionWrap.appendChild(discrepancy)
        }
      }

      if (canAddFromSourceRow && canAddToBom(snapshot)) {
        const isPending = pendingAddNodeIds.has(row.id)
        const needsOperationSelection = modeView.sourceAddRequiresOperationSelection(snapshot)
        const canShowSourceSplit = isManufacturingSource
          && !row.hasChildren
          && sourceDiscrepancy.severity !== 'over'
        const canShowAddRemaining = sourceDiscrepancy.severity === 'under'

        if (canShowSourceSplit) {
          const splitLabel = `Split remaining ${sourceDiscrepancy.remainingQuantity} of ${row.node.label} to another process`
          const splitButton = structureActionButton(
            createSplitBalanceGlyphIcon(),
            'open',
            splitLabel,
            needsOperationSelection ? null : () => handlers.onSplitSourceNode(row.id),
            needsOperationSelection
          )
          if (needsOperationSelection) {
            const tooltipHost = document.createElement('span')
            tooltipHost.className = 'plm-extension-bom-structure-action-tooltip-host'
            tooltipHost.title = 'Select process first'
            tooltipHost.appendChild(splitButton)
            actionWrap.appendChild(tooltipHost)
          } else {
            actionWrap.appendChild(splitButton)
          }
        }

        if (canShowAddRemaining) {
          const addRemainingLabel = `Add remaining ${sourceDiscrepancy.remainingQuantity} of ${row.node.label}`
          const addRemainingButton = structureActionButton(
            isPending ? 'zmdi zmdi-refresh zmdi-hc-spin' : 'zmdi zmdi-plus',
            'add',
            addRemainingLabel,
            isPending || needsOperationSelection ? null : () => handlers.onAddRemainingSourceNode(row.id),
            isPending || needsOperationSelection
          )
          if (needsOperationSelection) {
            const tooltipHost = document.createElement('span')
            tooltipHost.className = 'plm-extension-bom-structure-action-tooltip-host'
            tooltipHost.title = 'Select process first'
            tooltipHost.appendChild(addRemainingButton)
            actionWrap.appendChild(tooltipHost)
          } else {
            actionWrap.appendChild(addRemainingButton)
          }
        } else if (sourceStatus === 'not-added') {
          const addLabel = isPending
            ? `Adding ${row.node.label} to target BOM`
            : needsOperationSelection
              ? 'Select process first'
              : isManufacturingSource
                ? `Add ${row.node.label} to target MBOM`
                : `Add ${row.node.label} to target BOM`
          const add = structureActionButton(
            isPending
              ? 'zmdi zmdi-refresh zmdi-hc-spin'
              : 'zmdi zmdi-plus',
            'add',
            addLabel,
            isPending || needsOperationSelection ? null : () => handlers.onDropNodeToTarget(row.id),
            isPending || needsOperationSelection
          )
          if (needsOperationSelection) {
            const tooltipHost = document.createElement('span')
            tooltipHost.className = 'plm-extension-bom-structure-action-tooltip-host'
            tooltipHost.title = 'Select process first'
            tooltipHost.appendChild(add)
            actionWrap.appendChild(tooltipHost)
          } else {
            actionWrap.appendChild(add)
          }
        } else {
          const spacer = document.createElement('span')
          spacer.className = 'plm-extension-bom-structure-action-spacer'
          spacer.setAttribute('aria-hidden', 'true')
          actionWrap.appendChild(spacer)
        }
      } else {
        const needsOperationSelection = modeView.sourceAddRequiresOperationSelection(snapshot)
        const canAddAssemblySubcomponents = isManufacturingSource && row.hasChildren
        if (canAddAssemblySubcomponents && canAddToBom(snapshot)) {
          const allLeafPartsAlreadyOnTarget = sourceAllLeafPartsOnTargetByNodeId[row.id] === true
          if (allLeafPartsAlreadyOnTarget) {
            const spacer = document.createElement('span')
            spacer.className = 'plm-extension-bom-structure-action-spacer'
            spacer.setAttribute('aria-hidden', 'true')
            actionWrap.appendChild(spacer)
          } else {
            const addSubcomponents = structureActionButton(
              createListAddGlyphIcon(),
              'add',
              needsOperationSelection
                ? 'Select process first'
                : `Add all subcomponents of ${row.node.label} to target MBOM`,
              needsOperationSelection ? null : () => handlers.onDropSourceAssemblySubcomponentsToTarget(row.id),
              needsOperationSelection
            )
            if (needsOperationSelection) {
              const tooltipHost = document.createElement('span')
              tooltipHost.className = 'plm-extension-bom-structure-action-tooltip-host'
              tooltipHost.title = 'Select process first'
              tooltipHost.appendChild(addSubcomponents)
              actionWrap.appendChild(tooltipHost)
            } else {
              actionWrap.appendChild(addSubcomponents)
            }
          }
        } else {
          const spacer = document.createElement('span')
          spacer.className = 'plm-extension-bom-structure-action-spacer'
          spacer.setAttribute('aria-hidden', 'true')
          actionWrap.appendChild(spacer)
        }
      }
    } else if (row.level === 0) {
      if (!row.hasChildren && row.node.fromLinkableDialog) {
        const targetStatusRail = document.createElement('span')
        targetStatusRail.className = 'plm-extension-bom-structure-status-rail'
        targetStatusRail.classList.add(hasQtyOverride ? 'is-modified' : 'is-added')
        actionWrap.appendChild(targetStatusRail)
      } else if (!row.hasChildren && hasQtyOverride && selectedNodeIds.has(row.id)) {
        const targetStatusRail = document.createElement('span')
        targetStatusRail.className = 'plm-extension-bom-structure-status-rail is-modified'
        actionWrap.appendChild(targetStatusRail)
      }
      if (requiredIndicator) {
        actionWrap.appendChild(requiredIndicator)
        requiredIndicatorAppended = true
      }

      const isEditing = snapshot.editingNodeId === row.id
      const isEditingItem = isEditing && snapshot.editingPanelMode !== 'bom'
      const isEditingBom = isEditing && snapshot.editingPanelMode === 'bom'
      const isAnyEditOpen = Boolean(snapshot.editingNodeId)
      if (snapshot.cloneLaunchMode === 'manufacturing') {
        const bomDetailsDisabled = isAnyEditOpen || !hasEditableBomFields
        const bomDetailsReason = !hasEditableBomFields
          ? 'No editable BOM fields'
          : bomDetailsDisabled
            ? 'Unavailable while editing'
            : `Edit BOM Details for ${row.node.label}`

        if (isAddProcessRow && canEditCurrentTargetRow) {
          const itemDetailsDisabled = isAnyEditOpen
          const itemDetailsButton = structureActionButton(
            'zmdi zmdi-assignment',
            'open',
            itemDetailsDisabled ? 'Unavailable while editing' : `Edit Item Details for ${row.node.label}`,
            itemDetailsDisabled ? null : () => handlers.onOpenProcessItemDetails(row.id),
            itemDetailsDisabled
          )
          if (isEditingItem) {
            itemDetailsButton.classList.add('is-active')
            itemDetailsButton.classList.remove('plm-extension-btn--secondary')
            itemDetailsButton.classList.add('plm-extension-btn--primary')
          }
          actionWrap.appendChild(itemDetailsButton)
        }

        if (canEditCurrentTargetRow) {
          const bomDetailsButton = structureActionButton(
            'zmdi zmdi-view-list-alt',
            'open',
            bomDetailsReason,
            bomDetailsDisabled ? null : () => handlers.onOpenProcessBomDetails(row.id),
            bomDetailsDisabled
          )
          if (isEditingBom) {
            bomDetailsButton.classList.add('is-active')
            bomDetailsButton.classList.remove('plm-extension-btn--secondary')
            bomDetailsButton.classList.add('plm-extension-btn--primary')
          }
          actionWrap.appendChild(bomDetailsButton)
        }
      } else {
        if (canEditCurrentTargetRow) {
          const editBtn = structureActionButton(
            'zmdi zmdi-edit',
            'edit',
            isEditing ? `Editing ${row.node.label}` : `Edit ${row.node.label}`,
            () => handlers.onEditNode(row.id)
          )
          if (isEditing) {
            editBtn.classList.add('is-active')
            editBtn.classList.remove('plm-extension-btn--secondary')
            editBtn.classList.add('plm-extension-btn--primary')
          }
          actionWrap.appendChild(editBtn)
        }
      }

      if (canSplitTargetRow) {
        const splitButton = structureActionButton(
          createSplitBalanceGlyphIcon(),
          'open',
          `Split ${row.node.label} to another process`,
          () => handlers.onSplitTargetNode(row.id)
        )
        actionWrap.appendChild(splitButton)
      }
      if (canRemoveCurrentTargetRow) {
        const removeIconClass = isMarkedForDelete ? 'zmdi zmdi-undo' : 'zmdi zmdi-delete'
        const removeLabel = isMarkedForDelete
          ? `Undo remove ${row.node.label} from target BOM`
          : `Remove ${row.node.label} from target BOM`
        const remove = structureActionButton(removeIconClass, 'remove', removeLabel, () => handlers.onRemoveTargetNode(row.id))
        actionWrap.appendChild(remove)
      }
    } else if (!isSource && snapshot.cloneLaunchMode === 'manufacturing' && row.level > 0 && !row.node.stagedOperationDraft) {
      if (requiredIndicator) {
        actionWrap.appendChild(requiredIndicator)
        requiredIndicatorAppended = true
      }

      const isEditing = snapshot.editingNodeId === row.id
      const isEditingBom = isEditing && snapshot.editingPanelMode === 'bom'
      const bomDetailsDisabled = Boolean(snapshot.editingNodeId) || !hasEditableBomFields
      const bomDetailsReason = !hasEditableBomFields
        ? 'No editable BOM fields'
        : bomDetailsDisabled
          ? 'Unavailable while editing'
          : `Edit BOM Details for ${row.node.label}`
      if (canEditCurrentTargetRow) {
        const bomDetailsButton = structureActionButton(
          'zmdi zmdi-view-list-alt',
          'open',
          bomDetailsReason,
          bomDetailsDisabled ? null : () => handlers.onOpenProcessBomDetails(row.id),
          bomDetailsDisabled
        )
        if (isEditingBom) {
          bomDetailsButton.classList.add('is-active')
          bomDetailsButton.classList.remove('plm-extension-btn--secondary')
          bomDetailsButton.classList.add('plm-extension-btn--primary')
        }
        actionWrap.appendChild(bomDetailsButton)
      }

      const useStagedChildRemove = modeView.shouldRenderStagedChildRemove(
        snapshot,
        row,
        selectedNodeIds,
        targetExistingNodeIds,
        isSource
      )
      if (canSplitTargetRow) {
        const splitButton = structureActionButton(
          createSplitBalanceGlyphIcon(),
          'open',
          `Split ${row.node.label} to another process`,
          () => handlers.onSplitTargetNode(row.id)
        )
        actionWrap.appendChild(splitButton)
      }
      if (canRemoveCurrentTargetRow) {
        const removeIconClass = isMarkedForDelete ? 'zmdi zmdi-undo' : 'zmdi zmdi-delete'
        const removeLabel = useStagedChildRemove
          ? modeView.stagedChildRemoveLabel(row.node.label)
          : isMarkedForDelete
            ? `Undo remove ${row.node.label} from target BOM`
            : `Remove ${row.node.label} from target BOM`
        const remove = structureActionButton(
          removeIconClass,
          'remove',
          removeLabel,
          () => handlers.onRemoveTargetNode(row.id)
        )
        actionWrap.appendChild(remove)
      }
    }
    if (!isSource && requiredIndicator && !requiredIndicatorAppended) actionWrap.appendChild(requiredIndicator)

    tdAction.appendChild(actionWrap)

    const mergedNumberDescriptorCell = document.createElement('td')
    mergedNumberDescriptorCell.colSpan = 2
    mergedNumberDescriptorCell.className = 'plm-extension-bom-structure-number-descriptor-merged-cell'

    const mergedWrap = document.createElement('div')
    mergedWrap.className = 'plm-extension-bom-structure-number-descriptor-merged-wrap'
    mergedWrap.appendChild(numberWrap)
    mergedWrap.appendChild(descriptorScroll)
    mergedNumberDescriptorCell.appendChild(mergedWrap)
    tr.appendChild(mergedNumberDescriptorCell)
    tr.appendChild(tdQty)
    tr.appendChild(tdAction)
    body.appendChild(tr)
  }
}


