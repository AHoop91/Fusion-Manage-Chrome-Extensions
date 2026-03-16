import React from 'react'
import type { BomCloneStateSnapshot } from '../../clone.types'
import {
  buildOperationCounts,
  buildRequiredWarningSummary,
  type CloneStructureViewModel
} from '../../services/viewModel.service'
import { CloneOperationSummary } from '../structure/StructureSummary'
import { buildButtonClassName } from './CloneShell'

type CloneFooterHandlers = {
  onClose: () => void
  onResetTarget: () => void
  onValidateSelection: () => void
  onCommitClone: () => void
}

export function CloneFooter(props: {
  snapshot: BomCloneStateSnapshot
  handlers: CloneFooterHandlers
  structureContext: CloneStructureViewModel | null
}): React.JSX.Element {
  const { snapshot, handlers, structureContext } = props
  const isEditPanelOpen = snapshot.clonePhase === 'structure' && Boolean(snapshot.editingNodeId)

  let commitButton: React.JSX.Element | null = null
  let resetButton: React.JSX.Element | null = null
  const footerClassName = structureContext && snapshot.clonePhase === 'structure'
    ? 'plm-extension-bom-clone-footer plm-extension-bom-clone-footer--with-summary'
    : 'plm-extension-bom-clone-footer'

  let cancelTitle: string | undefined
  if (isEditPanelOpen) cancelTitle = 'Close the edit panel before cancelling.'

  if (snapshot.clonePhase === 'search') {
    commitButton = (
      <button
        type="button"
        className={buildButtonClassName('primary')}
        disabled={!snapshot.selectedSourceItemId || snapshot.loading}
        onClick={handlers.onValidateSelection}
      >
        Continue
      </button>
    )
  } else if (snapshot.clonePhase === 'structure') {
    const isResetDisabled = isEditPanelOpen || snapshot.commitInProgress
    let resetTitle = 'Reset target table back to the original loaded BOM.'
    if (isEditPanelOpen) resetTitle = 'Close the edit panel before resetting.'
    else if (snapshot.commitInProgress) resetTitle = 'Reset is unavailable while commit is in progress.'
    resetButton = (
      <button
        type="button"
        className={buildButtonClassName('secondary')}
        disabled={isResetDisabled}
        title={resetTitle}
        onClick={handlers.onResetTarget}
      >
        Reset
      </button>
    )

    const counts = structureContext
      ? buildOperationCounts(snapshot, structureContext)
      : { deleteCount: 0, updateCount: 0, addCount: 0, createCount: 0, newCount: 0 }
    const requiredWarnings = structureContext
      ? buildRequiredWarningSummary(snapshot, structureContext)
      : { hasBlockingWarnings: false, blockingWarningCount: 0 }
    const hasCommitOperations = (counts.deleteCount + counts.updateCount + counts.newCount) > 0
    const hasUnauthorizedAdds = !snapshot.permissions.canAdd && counts.newCount > 0
    const hasUnauthorizedUpdates = !snapshot.permissions.canEdit && counts.updateCount > 0
    const hasUnauthorizedDeletes = !snapshot.permissions.canDelete && counts.deleteCount > 0
    const hasUnauthorizedOperations = hasUnauthorizedAdds || hasUnauthorizedUpdates || hasUnauthorizedDeletes
    const isCommitDisabled =
      !hasCommitOperations
      || snapshot.commitInProgress
      || isEditPanelOpen
      || requiredWarnings.hasBlockingWarnings
      || hasUnauthorizedOperations
    const commitLabel = snapshot.commitInProgress && snapshot.commitProgressTotal > 0
      ? `Committing ${snapshot.commitProgressCurrent}/${snapshot.commitProgressTotal}`
      : 'Commit'
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
    commitButton = (
      <button
        type="button"
        className={buildButtonClassName('primary')}
        disabled={isCommitDisabled}
        title={commitTitle}
        onClick={handlers.onCommitClone}
      >
        {commitLabel}
      </button>
    )
  }

  return (
    <div className={footerClassName}>
      {structureContext && snapshot.clonePhase === 'structure' ? (
        <CloneOperationSummary snapshot={snapshot} structureContext={structureContext} />
      ) : null}
      <div className="plm-extension-bom-clone-footer-actions">
        <button
          type="button"
          className={buildButtonClassName('secondary')}
          disabled={isEditPanelOpen}
          title={cancelTitle}
          onClick={handlers.onClose}
        >
          Cancel
        </button>
        {resetButton}
        {commitButton}
      </div>
    </div>
  )
}
