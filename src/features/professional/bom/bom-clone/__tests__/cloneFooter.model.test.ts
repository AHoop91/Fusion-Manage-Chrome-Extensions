// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  buildCloneFooterViewModel,
  EMPTY_CLONE_OPERATION_COUNTS,
  NO_REQUIRED_WARNINGS
} from '../view/shell/CloneFooter.model'

type FooterSnapshot = Parameters<typeof buildCloneFooterViewModel>[0]['snapshot']

function createSnapshot(overrides: Partial<FooterSnapshot> = {}): FooterSnapshot {
  return {
    clonePhase: 'search',
    selectedSourceItemId: null,
    loading: false,
    editingNodeId: null,
    commitInProgress: false,
    commitProgressCurrent: 0,
    commitProgressTotal: 0,
    permissions: {
      canAdd: true,
      canDelete: true,
      canEdit: true,
      canOpen: true,
      canView: true
    },
    ...overrides
  }
}

describe('bom/CloneFooter.model', () => {
  it('disables continue in search phase until a source item is selected', () => {
    const model = buildCloneFooterViewModel({
      snapshot: createSnapshot({ clonePhase: 'search', selectedSourceItemId: null }),
      hasStructureContext: false,
      operationCounts: EMPTY_CLONE_OPERATION_COUNTS,
      requiredWarnings: NO_REQUIRED_WARNINGS
    })

    expect(model.cancel.disabled).toBe(false)
    expect(model.reset).toBeNull()
    expect(model.commit).toEqual({
      label: 'Continue',
      disabled: true
    })
  })

  it('blocks commit when there are no staged operations', () => {
    const model = buildCloneFooterViewModel({
      snapshot: createSnapshot({ clonePhase: 'structure' }),
      hasStructureContext: true,
      operationCounts: EMPTY_CLONE_OPERATION_COUNTS,
      requiredWarnings: NO_REQUIRED_WARNINGS
    })

    expect(model.showSummary).toBe(true)
    expect(model.commit).toEqual({
      label: 'Commit',
      disabled: true,
      title: 'No staged processes to commit.'
    })
    expect(model.reset).toEqual({
      label: 'Reset',
      disabled: false,
      title: 'Reset target table back to the original loaded BOM.'
    })
  })

  it('blocks commit when required warnings are still unresolved', () => {
    const model = buildCloneFooterViewModel({
      snapshot: createSnapshot({ clonePhase: 'structure' }),
      hasStructureContext: true,
      operationCounts: {
        ...EMPTY_CLONE_OPERATION_COUNTS,
        updateCount: 1
      },
      requiredWarnings: {
        hasBlockingWarnings: true,
        blockingWarningCount: 2
      }
    })

    expect(model.commit).toEqual({
      label: 'Commit',
      disabled: true,
      title: '2 required fields are still required.'
    })
  })

  it('surfaces permission-specific blocking reasons for add, edit, and delete', () => {
    const addBlocked = buildCloneFooterViewModel({
      snapshot: createSnapshot({
        clonePhase: 'structure',
        permissions: {
          canAdd: false,
          canDelete: true,
          canEdit: true,
          canOpen: true,
          canView: true
        }
      }),
      hasStructureContext: true,
      operationCounts: {
        ...EMPTY_CLONE_OPERATION_COUNTS,
        newCount: 1,
        addCount: 1
      },
      requiredWarnings: NO_REQUIRED_WARNINGS
    })
    const editBlocked = buildCloneFooterViewModel({
      snapshot: createSnapshot({
        clonePhase: 'structure',
        permissions: {
          canAdd: true,
          canDelete: true,
          canEdit: false,
          canOpen: true,
          canView: true
        }
      }),
      hasStructureContext: true,
      operationCounts: {
        ...EMPTY_CLONE_OPERATION_COUNTS,
        updateCount: 1
      },
      requiredWarnings: NO_REQUIRED_WARNINGS
    })
    const deleteBlocked = buildCloneFooterViewModel({
      snapshot: createSnapshot({
        clonePhase: 'structure',
        permissions: {
          canAdd: true,
          canDelete: false,
          canEdit: true,
          canOpen: true,
          canView: true
        }
      }),
      hasStructureContext: true,
      operationCounts: {
        ...EMPTY_CLONE_OPERATION_COUNTS,
        deleteCount: 1
      },
      requiredWarnings: NO_REQUIRED_WARNINGS
    })

    expect(addBlocked.commit?.title).toBe('Missing permission: Add to BOM')
    expect(editBlocked.commit?.title).toBe('Missing permission: Edit BOM')
    expect(deleteBlocked.commit?.title).toBe('Missing permission: Delete from BOM')
  })

  it('blocks cancel, reset, and commit while the edit panel is open', () => {
    const model = buildCloneFooterViewModel({
      snapshot: createSnapshot({
        clonePhase: 'structure',
        editingNodeId: 'node-1'
      }),
      hasStructureContext: true,
      operationCounts: {
        ...EMPTY_CLONE_OPERATION_COUNTS,
        updateCount: 1
      },
      requiredWarnings: NO_REQUIRED_WARNINGS
    })

    expect(model.cancel).toEqual({
      label: 'Cancel',
      disabled: true,
      title: 'Close the edit panel before cancelling.'
    })
    expect(model.reset).toEqual({
      label: 'Reset',
      disabled: true,
      title: 'Close the edit panel before resetting.'
    })
    expect(model.commit).toEqual({
      label: 'Commit',
      disabled: true,
      title: 'Close the edit panel before committing.'
    })
  })

  it('shows commit progress labels and disables reset during commit', () => {
    const model = buildCloneFooterViewModel({
      snapshot: createSnapshot({
        clonePhase: 'structure',
        commitInProgress: true,
        commitProgressCurrent: 2,
        commitProgressTotal: 5
      }),
      hasStructureContext: true,
      operationCounts: {
        ...EMPTY_CLONE_OPERATION_COUNTS,
        updateCount: 1
      },
      requiredWarnings: NO_REQUIRED_WARNINGS
    })

    expect(model.reset).toEqual({
      label: 'Reset',
      disabled: true,
      title: 'Reset is unavailable while commit is in progress.'
    })
    expect(model.commit).toEqual({
      label: 'Committing 2/5',
      disabled: true,
      title: 'Commit staged changes.'
    })
  })
})
