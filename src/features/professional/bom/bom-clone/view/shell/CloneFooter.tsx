import React from 'react'
import type { BomCloneStateSnapshot } from '../../clone.types'
import {
  buildOperationCounts,
  buildRequiredWarningSummary,
  type CloneStructureViewModel
} from '../../services/viewModel.service'
import { CloneOperationSummary } from '../structure/StructureSummary'
import { buildButtonClassName } from './CloneShell'
import {
  buildCloneFooterViewModel,
  EMPTY_CLONE_OPERATION_COUNTS,
  NO_REQUIRED_WARNINGS,
  type CloneFooterViewModel
} from './CloneFooter.model'

export type CloneFooterHandlers = {
  onClose: () => void
  onResetTarget: () => void
  onValidateSelection: () => void
  onCommitClone: () => void
}

export function CloneFooterView(props: {
  model: CloneFooterViewModel
  handlers: CloneFooterHandlers
  summary?: React.ReactNode
}): React.JSX.Element {
  const { model, handlers, summary } = props
  return (
    <div className={model.footerClassName}>
      {model.showSummary ? summary || null : null}
      <div className="plm-extension-bom-clone-footer-actions">
        <button
          type="button"
          className={buildButtonClassName('secondary')}
          disabled={model.cancel.disabled}
          title={model.cancel.title}
          onClick={handlers.onClose}
        >
          {model.cancel.label}
        </button>
        {model.reset ? (
          <button
            type="button"
            className={buildButtonClassName('secondary')}
            disabled={model.reset.disabled}
            title={model.reset.title}
            onClick={handlers.onResetTarget}
          >
            {model.reset.label}
          </button>
        ) : null}
        {model.commit ? (
          <button
            type="button"
            className={buildButtonClassName('primary')}
            disabled={model.commit.disabled}
            title={model.commit.title}
            onClick={handlers.onCommitClone}
          >
            {model.commit.label}
          </button>
        ) : null}
      </div>
    </div>
  )
}

export function CloneFooter(props: {
  snapshot: BomCloneStateSnapshot
  handlers: CloneFooterHandlers
  structureContext: CloneStructureViewModel | null
}): React.JSX.Element {
  const { snapshot, handlers, structureContext } = props
  const hasStructureContext = Boolean(structureContext) && snapshot.clonePhase === 'structure'
  const operationCounts = hasStructureContext && structureContext != null
    ? buildOperationCounts(snapshot, structureContext)
    : EMPTY_CLONE_OPERATION_COUNTS
  const requiredWarnings = hasStructureContext && structureContext != null
    ? buildRequiredWarningSummary(snapshot, structureContext)
    : NO_REQUIRED_WARNINGS
  const model = buildCloneFooterViewModel({
    snapshot,
    hasStructureContext,
    operationCounts,
    requiredWarnings
  })

  const routedHandlers: CloneFooterHandlers = snapshot.clonePhase === 'search'
    ? { ...handlers, onCommitClone: handlers.onValidateSelection }
    : handlers

  return (
    <CloneFooterView
      model={model}
      handlers={routedHandlers}
      summary={
        hasStructureContext && structureContext
          ? <CloneOperationSummary snapshot={snapshot} structureContext={structureContext} />
          : null
      }
    />
  )
}
