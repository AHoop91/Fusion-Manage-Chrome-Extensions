import { describe, expect, it } from 'vitest'
import {
  buildCommitProgressBreakdown,
  buildEditPanelViewModel,
  buildLinkableDialogViewModel,
  buildOperationCounts,
  buildQtyInputViewModel,
  buildRequiredWarningSummary,
  buildRowRequiredValidationSummary,
  buildStructureViewModel,
  computeRequiredFieldCompletion
} from '../services/viewModel.service'
import type { BomCloneNode, BomCloneStateSnapshot, FormFieldDefinition } from '../clone.types'

function createNode(overrides: Partial<BomCloneNode> & Pick<BomCloneNode, 'id' | 'label'>): BomCloneNode {
  return {
    id: overrides.id,
    label: overrides.label,
    number: overrides.number || overrides.id,
    itemNumber: overrides.itemNumber || overrides.id,
    iconHtml: overrides.iconHtml || '',
    revision: overrides.revision || '',
    status: overrides.status || '',
    quantity: overrides.quantity || '',
    unitOfMeasure: overrides.unitOfMeasure || '',
    hasExpandableChildren: overrides.hasExpandableChildren ?? false,
    childrenLoaded: overrides.childrenLoaded ?? true,
    children: overrides.children || [],
    bomFieldValues: overrides.bomFieldValues,
    itemLink: overrides.itemLink,
    splitSourceNodeId: overrides.splitSourceNodeId,
    stagedOperationDraft: overrides.stagedOperationDraft,
    stagedSplitDraft: overrides.stagedSplitDraft,
    fromLinkableDialog: overrides.fromLinkableDialog,
    bomEdgeId: overrides.bomEdgeId
  }
}

function createField(overrides: Partial<FormFieldDefinition> & Pick<FormFieldDefinition, 'fieldId' | 'title'>): FormFieldDefinition {
  return {
    fieldId: overrides.fieldId,
    title: overrides.title,
    description: overrides.description ?? null,
    kind: overrides.kind ?? 'text',
    typeId: overrides.typeId ?? null,
    picklistPath: overrides.picklistPath ?? null,
    defaultValue: overrides.defaultValue ?? null,
    defaultPayloadValue: overrides.defaultPayloadValue ?? null,
    fieldLength: overrides.fieldLength ?? null,
    fieldPrecision: overrides.fieldPrecision ?? null,
    unitOfMeasure: overrides.unitOfMeasure ?? null,
    required: overrides.required ?? false,
    editable: overrides.editable ?? true,
    visible: overrides.visible ?? true,
    displayOrder: overrides.displayOrder ?? 0,
    fieldSelf: overrides.fieldSelf,
    fieldUrn: overrides.fieldUrn,
    typeLink: overrides.typeLink,
    typeUrn: overrides.typeUrn,
    typeTitle: overrides.typeTitle
  }
}

function createStructureRow(node: BomCloneNode, level: number) {
  return {
    id: node.id,
    node,
    level,
    hasChildren: node.children.length > 0 || node.hasExpandableChildren,
    expanded: false
  }
}

describe('bom/viewModel.service', () => {
  it('computes required field completion from overrides and defaults', () => {
    const completion = computeRequiredFieldCompletion([
      createField({ fieldId: 'TITLE', title: 'Title', required: true }),
      createField({ fieldId: 'DESC', title: 'Description', required: true, defaultValue: 'Default' })
    ], {
      TITLE: 'Filled'
    })

    expect(completion).toEqual({
      isComplete: true,
      missingCount: 0,
      requiredCount: 2
    })
  })

  it('builds operation counts across create, add, delete, and update states', () => {
    const snapshot = {
      targetMarkedForDeleteNodeIds: ['persisted-delete'],
      targetItemNumberOverrides: { 'persisted-item': '1.5' },
      targetQuantityOverrides: { 'persisted-qty': '2.0' },
      targetFieldOverrides: {
        'persisted-field': { FIELD1: 'Changed' }
      },
      bomViewFieldMetaLinks: {
        FIELD1: '/api/v3/workspaces/57/views/5/viewdef/10/fields/FIELD1'
      },
      bomViewFields: [
        createField({ fieldId: '103', title: 'Quantity' }),
        createField({ fieldId: 'FIELD1', title: 'Custom Field' })
      ]
    } as unknown as BomCloneStateSnapshot

    const counts = buildOperationCounts(snapshot, {
      existingTopLevelNodeIds: new Set(['persisted-item', 'persisted-qty', 'persisted-field']),
      stagedTopLevelNodeIds: new Set(['staged-create', 'staged-add']),
      selectedNodeIds: new Set(['staged-create', 'staged-add']),
      selectedRows: [
        createStructureRow(createNode({ id: 'root', label: 'Root' }), -1),
        createStructureRow(createNode({ id: 'staged-create', label: 'Draft', stagedOperationDraft: true }), 0),
        createStructureRow(createNode({ id: 'staged-add', label: 'Selected Add' }), 0),
        createStructureRow(createNode({ id: 'persisted-delete', label: 'Delete Me', bomEdgeId: '10' }), 0),
        createStructureRow(createNode({ id: 'persisted-item', label: 'Renumber Me', bomEdgeId: '11' }), 0),
        createStructureRow(createNode({ id: 'persisted-qty', label: 'Reqty Me', bomEdgeId: '12' }), 0),
        createStructureRow(createNode({ id: 'persisted-field', label: 'Refield Me', bomEdgeId: '13' }), 0)
      ]
    })

    expect(counts).toEqual({
      deleteCount: 1,
      updateCount: 3,
      addCount: 1,
      createCount: 1,
      newCount: 2
    })
  })

  it('builds quantity input state relative to the normalized fallback quantity', () => {
    expect(buildQtyInputViewModel({ '103': '2' }, '103', '1.0')).toEqual({
      nextQuantity: '2',
      isModified: true
    })

    expect(buildQtyInputViewModel({}, '103', '1')).toEqual({
      nextQuantity: '1',
      isModified: false
    })
  })

  it('flags potential duplicate linkable items from staged source labels', () => {
    const sourceTree = [
      createNode({
        id: 'root',
        label: 'Root',
        hasExpandableChildren: true,
        children: [
          createNode({ id: 'staged-a', label: 'Assembly A [REV:A]' }),
          createNode({ id: 'ignore-linkable', label: 'Assembly B', fromLinkableDialog: true })
        ]
      })
    ]

    const result = buildLinkableDialogViewModel({
      linkableLoading: false,
      linkableItems: [
        { id: 1, label: 'Assembly A [REV:B]', workspace: 'Buildings', lifecycle: 'Released' },
        { id: 2, label: 'Assembly C', workspace: 'Buildings', lifecycle: 'Released' }
      ],
      linkableDisplayOnlySelected: false,
      linkableShowOnlyErrors: false,
      linkableSelectedItemIds: [2],
      linkableOnTargetBomItemIds: [],
      linkableItemErrors: { '2': 'Already present' },
      selectedNodesToClone: ['staged-a'],
      sourceBomTree: sourceTree
    })

    expect(result.visibleCount).toBe(2)
    expect(result.rows[0]).toMatchObject({
      isPotentialDuplicate: true,
      isSelected: false,
      errorMessage: null
    })
    expect(result.rows[1]).toMatchObject({
      isPotentialDuplicate: false,
      isSelected: true,
      errorMessage: 'Already present'
    })
  })

  it('builds commit progress and required warning summaries', () => {
    const snapshot = {
      commitProgressCurrent: 3,
      commitProgressTotal: 10,
      bomViewFieldsLoading: false,
      cloneLaunchMode: 'manufacturing',
      bomViewFields: [
        createField({ fieldId: 'REQ', title: 'Required BOM', required: true, editable: true })
      ],
      operationFormFields: [
        createField({ fieldId: 'OP_REQ', title: 'Required Op', required: true, editable: true, visible: true })
      ],
      operationFormFieldsLoading: false,
      targetFieldOverrides: {}
    } as unknown as BomCloneStateSnapshot

    expect(buildCommitProgressBreakdown(snapshot, {
      createCount: 1,
      deleteCount: 1,
      addCount: 2,
      updateCount: 3,
      newCount: 3
    })).toEqual({
      overallTotal: 10,
      overallCurrent: 3,
      createDone: 1,
      deleteDone: 1,
      addDone: 1,
      updateDone: 0,
      newDone: 2
    })

    const warningSummary = buildRequiredWarningSummary(snapshot, {
      selectedNodeIds: new Set(['existing-row', 'draft-op']),
      markedForDeleteIds: new Set<string>(),
      selectedRows: [
        createStructureRow(createNode({ id: 'root', label: 'Root' }), -1),
        createStructureRow(createNode({ id: 'existing-row', label: 'Existing', bomFieldValues: {} }), 0),
        createStructureRow(createNode({ id: 'draft-op', label: 'Draft Op', stagedOperationDraft: true, bomFieldValues: {} }), 0)
      ]
    })

    expect(warningSummary).toEqual({
      blockingWarningCount: 2,
      hasBlockingWarnings: true
    })
  })

  it('builds row validation and edit-panel models for manufacturing operation drafts', () => {
    const snapshot = {
      cloneLaunchMode: 'manufacturing',
      editingPanelMode: 'item',
      bomViewFields: [
        createField({ fieldId: '103', title: 'Quantity', required: true, editable: true }),
        createField({ fieldId: 'IMG', title: 'Image', editable: true, typeId: 15, typeTitle: 'Image' })
      ],
      bomViewFieldsLoading: false,
      operationFormFields: [
        createField({ fieldId: 'OP_REQ', title: 'Operation Name', required: true, editable: true, visible: true }),
        createField({ fieldId: 'IMG_OP', title: 'Image', editable: true, visible: true, typeId: 15, typeTitle: 'Image' }),
        createField({ fieldId: 'HIDDEN', title: 'Hidden', editable: true, visible: false })
      ],
      operationFormSections: [
        {
          title: 'Operation',
          expandedByDefault: true,
          fieldIds: ['OP_REQ']
        }
      ],
      operationFormFieldsLoading: false,
      targetFieldOverrides: {
        'draft-op': {
          OP_REQ: 'Laser Cut'
        }
      },
      targetQuantityOverrides: {
        'draft-op': '2.0'
      },
      sourceBomTree: [],
      targetBomTree: [
        createNode({
          id: 'root',
          label: 'Root',
          children: [
            createNode({
              id: 'draft-op',
              label: 'Draft Op',
              stagedOperationDraft: true,
              quantity: '1.0',
              bomFieldValues: { OP_REQ: 'Existing' }
            })
          ]
        })
      ]
    } as unknown as BomCloneStateSnapshot

    expect(buildRowRequiredValidationSummary(snapshot, createNode({
      id: 'draft-op',
      label: 'Draft Op',
      stagedOperationDraft: true,
      bomFieldValues: {}
    }), true)).toEqual({
      combined: { isComplete: false, missingCount: 1, requiredCount: 2 },
      bom: { isComplete: false, missingCount: 1, requiredCount: 1 },
      itemDetails: { isComplete: true, missingCount: 0, requiredCount: 1 },
      tooltip: 'Item Details: All required fields completed.\nBOM Details: 1 required field missing.'
    })

    const panel = buildEditPanelViewModel(snapshot, 'draft-op')
    expect(panel.fields.map((field) => field.fieldId)).toEqual(['OP_REQ'])
    expect(panel.sections).toEqual([
      {
        title: 'Operation',
        expandedByDefault: true,
        fields: [createField({ fieldId: 'OP_REQ', title: 'Operation Name', required: true, editable: true, visible: true })]
      }
    ])
    expect(panel.requiredEditableFields.map((field) => field.fieldId)).toEqual(['OP_REQ'])
    expect(panel.quantityFieldId).toBe('103')
    expect(panel.fallbackQuantity).toBe('1.0')
    expect(panel.activeInsertDraft.payload.get('OP_REQ')).toBe('Laser Cut')
    expect(panel.activeInsertDraft.payload.get('103')).toBe('2.0')
  })

  it('builds structure status, discrepancy, and quantity summaries from target allocations', () => {
    const sourceBomTree = [
      createNode({
        id: 'root',
        label: 'Root',
        hasExpandableChildren: true,
        children: [
          createNode({ id: 'added-part', label: 'Added Part', quantity: '5' }),
          createNode({ id: 'modified-part', label: 'Modified Part', quantity: '5' }),
          createNode({ id: 'missing-part', label: 'Missing Part', quantity: '5' })
        ]
      })
    ]
    const targetBomTree = [
      createNode({
        id: 'root',
        label: 'Root',
        hasExpandableChildren: true,
        children: [
          createNode({ id: 'added-part', label: 'Added Part', quantity: '5', bomEdgeId: '1' }),
          createNode({ id: 'modified-part', label: 'Modified Part', quantity: '2', bomEdgeId: '2' })
        ]
      })
    ]

    const viewModel = buildStructureViewModel({
      cloneLaunchMode: 'engineering',
      sourceBomTree,
      targetBomTree,
      pendingAddNodeIds: [],
      selectedNodesToClone: [],
      manufacturingOperationBySourceNodeId: {},
      targetMarkedForDeleteNodeIds: [],
      sourceExpandedNodeIds: ['root'],
      targetExpandedNodeIds: ['root'],
      targetQuantityOverrides: {},
      targetItemNumberOverrides: {},
      sourceStatusFilter: 'all'
    } as unknown as BomCloneStateSnapshot)

    expect(viewModel.sourceStatusByNodeId).toMatchObject({
      'added-part': 'added',
      'modified-part': 'modified',
      'missing-part': 'not-added',
      root: 'modified'
    })
    expect(viewModel.sourceDiscrepancyByNodeId['modified-part']).toMatchObject({
      severity: 'under',
      sourceQuantity: '5.0',
      allocatedQuantity: '2.0',
      remainingQuantity: '3.0'
    })
    expect(viewModel.sourceDiscrepancyByNodeId['added-part']).toMatchObject({
      severity: 'none',
      remainingQuantity: '0.0'
    })
    expect(viewModel.sourceAllLeafPartsOnTargetByNodeId).toMatchObject({
      'added-part': true,
      'modified-part': false,
      root: false
    })
    expect(viewModel.sourceStatusCounts).toEqual({
      notAdded: 1,
      modified: 1,
      added: 1,
      total: 3
    })
    expect(viewModel.sourceStatusQuantities).toEqual({
      notAdded: 5,
      modified: 5,
      added: 5,
      total: 15
    })
  })
})
