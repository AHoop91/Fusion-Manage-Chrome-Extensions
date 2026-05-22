import type { BomCloneStateSnapshot } from '../../clone.types'
import type { CloneOperationCounts, CloneRequiredWarningSummary } from '../../services/viewModel.service'

export type CloneFooterButtonModel = {
  label: string
  disabled: boolean
  title?: string
}

export type CloneFooterViewModel = {
  footerClassName: string
  showSummary: boolean
  cancel: CloneFooterButtonModel
  reset: CloneFooterButtonModel | null
  commit: CloneFooterButtonModel | null
}

export const EMPTY_CLONE_OPERATION_COUNTS: CloneOperationCounts = {
  deleteCount: 0,
  updateCount: 0,
  addCount: 0,
  createCount: 0,
  newCount: 0
}

export const NO_REQUIRED_WARNINGS: CloneRequiredWarningSummary = {
  blockingWarningCount: 0,
  hasBlockingWarnings: false
}

type FooterSnapshot = Pick<
  BomCloneStateSnapshot,
  | 'clonePhase'
  | 'selectedSourceItemId'
  | 'loading'
  | 'editingNodeId'
  | 'commitInProgress'
  | 'commitProgressCurrent'
  | 'commitProgressTotal'
  | 'permissions'
>

export function buildCloneFooterViewModel(args: {
  snapshot: FooterSnapshot
  hasStructureContext: boolean
  operationCounts: CloneOperationCounts
  requiredWarnings: CloneRequiredWarningSummary
}): CloneFooterViewModel {
  const { snapshot, hasStructureContext, operationCounts, requiredWarnings } = args
  const isEditPanelOpen = snapshot.clonePhase === 'structure' && Boolean(snapshot.editingNodeId)
  const showSummary = hasStructureContext && snapshot.clonePhase === 'structure'
  const footerClassName = showSummary
    ? 'plm-extension-bom-clone-footer plm-extension-bom-clone-footer--with-summary'
    : 'plm-extension-bom-clone-footer'

  const cancel: CloneFooterButtonModel = {
    label: 'Cancel',
    disabled: isEditPanelOpen,
    ...(isEditPanelOpen ? { title: 'Close the edit panel before cancelling.' } : {})
  }

  if (snapshot.clonePhase === 'search') {
    return {
      footerClassName,
      showSummary,
      cancel,
      reset: null,
      commit: {
        label: 'Continue',
        disabled: !snapshot.selectedSourceItemId || snapshot.loading
      }
    }
  }

  if (snapshot.clonePhase !== 'structure') {
    return {
      footerClassName,
      showSummary,
      cancel,
      reset: null,
      commit: null
    }
  }

  const resetDisabled = isEditPanelOpen || snapshot.commitInProgress
  let resetTitle = 'Reset target table back to the original loaded BOM.'
  if (isEditPanelOpen) resetTitle = 'Close the edit panel before resetting.'
  else if (snapshot.commitInProgress) resetTitle = 'Reset is unavailable while commit is in progress.'

  const hasCommitOperations = (operationCounts.deleteCount + operationCounts.updateCount + operationCounts.newCount) > 0
  const hasUnauthorizedAdds = !snapshot.permissions.canAdd && operationCounts.newCount > 0
  const hasUnauthorizedUpdates = !snapshot.permissions.canEdit && operationCounts.updateCount > 0
  const hasUnauthorizedDeletes = !snapshot.permissions.canDelete && operationCounts.deleteCount > 0
  const hasUnauthorizedOperations = hasUnauthorizedAdds || hasUnauthorizedUpdates || hasUnauthorizedDeletes
  const commitDisabled =
    !hasCommitOperations
    || snapshot.commitInProgress
    || isEditPanelOpen
    || requiredWarnings.hasBlockingWarnings
    || hasUnauthorizedOperations

  let commitTitle = 'Commit staged changes.'
  if (isEditPanelOpen) {
    commitTitle = 'Close the edit panel before committing.'
  } else if (requiredWarnings.hasBlockingWarnings) {
    const plural = requiredWarnings.blockingWarningCount === 1 ? 'field is' : 'fields are'
    commitTitle = `${requiredWarnings.blockingWarningCount} required ${plural} still required.`
  } else if (hasUnauthorizedAdds) {
    commitTitle = 'Missing permission: Add to BOM'
  } else if (hasUnauthorizedUpdates) {
    commitTitle = 'Missing permission: Edit BOM'
  } else if (hasUnauthorizedDeletes) {
    commitTitle = 'Missing permission: Delete from BOM'
  } else if (!hasCommitOperations) {
    commitTitle = 'No staged processes to commit.'
  }

  return {
    footerClassName,
    showSummary,
    cancel,
    reset: {
      label: 'Reset',
      disabled: resetDisabled,
      title: resetTitle
    },
    commit: {
      label: snapshot.commitInProgress && snapshot.commitProgressTotal > 0
        ? `Committing ${snapshot.commitProgressCurrent}/${snapshot.commitProgressTotal}`
        : 'Commit',
      disabled: commitDisabled,
      title: commitTitle
    }
  }
}
