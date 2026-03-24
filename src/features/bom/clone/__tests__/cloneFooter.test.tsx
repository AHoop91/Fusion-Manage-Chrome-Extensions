// @vitest-environment jsdom

import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CloneFooterView, type CloneFooterHandlers } from '../view/shell/CloneFooter'
import { buildCloneFooterViewModel, NO_REQUIRED_WARNINGS } from '../view/shell/CloneFooter.model'

type FooterSnapshot = Parameters<typeof buildCloneFooterViewModel>[0]['snapshot']

function createHandlers(): CloneFooterHandlers {
  return {
    onClose: vi.fn(),
    onResetTarget: vi.fn(),
    onValidateSelection: vi.fn(),
    onCommitClone: vi.fn()
  }
}

function createSnapshot(overrides: Partial<FooterSnapshot> = {}): FooterSnapshot {
  return {
    clonePhase: 'structure',
    selectedSourceItemId: 101,
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

describe('bom/CloneFooter view', () => {
  it('renders buttons and summary from a prepared footer model', () => {
    const handlers = createHandlers()
    const model = buildCloneFooterViewModel({
      snapshot: createSnapshot(),
      hasStructureContext: true,
      operationCounts: {
        deleteCount: 0,
        updateCount: 1,
        addCount: 0,
        createCount: 0,
        newCount: 0
      },
      requiredWarnings: NO_REQUIRED_WARNINGS
    })

    render(
      <CloneFooterView
        model={model}
        handlers={handlers}
        summary={<div data-testid="clone-operation-summary">Summary</div>}
      />
    )

    expect(screen.getByTestId('clone-operation-summary')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    fireEvent.click(screen.getByRole('button', { name: 'Commit' }))
    expect(handlers.onClose).toHaveBeenCalledTimes(1)
    expect(handlers.onResetTarget).toHaveBeenCalledTimes(1)
    expect(handlers.onCommitClone).toHaveBeenCalledTimes(1)
  })
})
