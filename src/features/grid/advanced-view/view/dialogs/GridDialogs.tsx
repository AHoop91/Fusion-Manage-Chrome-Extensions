import React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { formatRowCount, type StagedSummary } from '../summaryView'

export interface SelectedRevertSummary {
  editedRows: number
  deletedRows: number
  total: number
}

export type CommitProgressCategory = 'new' | 'update' | 'delete'

export interface CommitProgressDialog {
  setCategoryProgress: (category: CommitProgressCategory, current: number, total: number) => void
  setMessage: (message: string) => void
  close: () => void
}

function SummaryChips(props: { summary: StagedSummary; className: string }): React.JSX.Element {
  const { summary, className } = props

  const chips = [
    { label: 'New', count: summary.newRows, tone: 'new' },
    { label: 'Edited', count: summary.editedRows, tone: 'edit' },
    { label: 'Deleted', count: summary.deletedRows, tone: 'delete' }
  ] as const

  return (
    <div className={className}>
      {chips.map((chip) => (
        <span
          key={chip.label}
          className={`plm-extension-grid-form-status-chip is-${chip.tone}`}
          title={formatRowCount(chip.count, `${chip.label.toLowerCase()} row`, `${chip.label.toLowerCase()} rows`)}
        >
          {`${chip.label}: ${chip.count}`}
        </span>
      ))}
    </div>
  )
}

function GridDialogBackdrop(props: {
  children: React.ReactNode
  onClose?: () => void
}): React.JSX.Element {
  const { children, onClose } = props

  return (
    <div
      className="plm-extension-grid-form-confirm-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      {children}
    </div>
  )
}

function ConfirmDialog(props: {
  title: string
  message: string
  summary?: React.ReactNode
  details?: React.ReactNode
  cancelLabel: string
  confirmLabel: string
  confirmVariant?: 'primary' | 'secondary'
  onResolve: (confirmed: boolean) => void
}): React.JSX.Element {
  const {
    title,
    message,
    summary,
    details,
    cancelLabel,
    confirmLabel,
    confirmVariant = 'primary',
    onResolve
  } = props

  return (
    <GridDialogBackdrop onClose={() => onResolve(false)}>
      <div className="plm-extension-grid-form-confirm-panel">
        <div className="plm-extension-grid-form-confirm-title">{title}</div>
        <div className="plm-extension-grid-form-confirm-text">{message}</div>
        {summary}
        {details}
        <div className="plm-extension-grid-form-confirm-actions">
          <button
            type="button"
            className="plm-extension-grid-form-action plm-extension-btn plm-extension-btn--secondary"
            onClick={() => onResolve(false)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={[
              'plm-extension-grid-form-action',
              'plm-extension-btn',
              confirmVariant === 'primary' ? 'plm-extension-grid-form-action--primary plm-extension-btn--primary' : 'plm-extension-btn--secondary'
            ].join(' ')}
            onClick={() => onResolve(true)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </GridDialogBackdrop>
  )
}

function renderDialogPromise<T>(
  overlay: HTMLElement,
  renderDialog: (resolve: (result: T) => void) => React.JSX.Element
): Promise<T> {
  return new Promise((resolve) => {
    const host = document.createElement('div')
    overlay.appendChild(host)
    const root = createRoot(host)

    const close = (result: T): void => {
      root.unmount()
      host.remove()
      resolve(result)
    }

    root.render(renderDialog(close))
  })
}

export function showCommitConfirm(overlay: HTMLElement, summary: StagedSummary): Promise<boolean> {
  return renderDialogPromise(overlay, (resolve) => (
    <ConfirmDialog
      title="Confirm Commit"
      message={`You are about to commit ${summary.total} staged action(s).`}
      summary={<SummaryChips summary={summary} className="plm-extension-grid-form-confirm-summary" />}
      details={
        <ul className="plm-extension-grid-form-confirm-list">
          <li>{formatRowCount(summary.newRows, 'new row will be added', 'new rows will be added')}</li>
          <li>{formatRowCount(summary.editedRows, 'row will be updated', 'rows will be updated')}</li>
          <li>{formatRowCount(summary.deletedRows, 'row will be removed', 'rows will be removed')}</li>
        </ul>
      }
      cancelLabel="Cancel"
      confirmLabel="Commit"
      onResolve={resolve}
    />
  ))
}

export function showRevertConfirm(overlay: HTMLElement, summary: SelectedRevertSummary): Promise<boolean> {
  return renderDialogPromise(overlay, (resolve) => (
    <ConfirmDialog
      title="Confirm Revert"
      message={`Revert ${summary.total} selected staged change(s)?`}
      summary={
        <SummaryChips
          summary={{ newRows: 0, editedRows: summary.editedRows, deletedRows: summary.deletedRows, total: summary.total }}
          className="plm-extension-grid-form-confirm-summary"
        />
      }
      details={
        <ul className="plm-extension-grid-form-confirm-list">
          <li>{formatRowCount(summary.editedRows, 'edited row will be reverted', 'edited rows will be reverted')}</li>
          <li>{formatRowCount(summary.deletedRows, 'deleted row will be restored', 'deleted rows will be restored')}</li>
        </ul>
      }
      cancelLabel="Cancel"
      confirmLabel="Revert"
      onResolve={resolve}
    />
  ))
}

export function showCancelConfirm(overlay: HTMLElement, stagedCount: number): Promise<boolean> {
  const noun = stagedCount === 1 ? 'staged change' : 'staged changes'
  return renderDialogPromise(overlay, (resolve) => (
    <ConfirmDialog
      title="Discard Staged Changes?"
      message={`Are you sure you want to cancel and discard ${stagedCount} ${noun}?`}
      cancelLabel="Keep Editing"
      confirmLabel="Discard and Close"
      onResolve={resolve}
    />
  ))
}

type ProgressState = {
  message: string
  categories: Record<CommitProgressCategory, { current: number; total: number; visible: boolean; label: string }>
}

function CommitProgressDialogView(props: { state: ProgressState }): React.JSX.Element {
  const { state } = props
  const rows = (Object.entries(state.categories) as Array<[CommitProgressCategory, ProgressState['categories'][CommitProgressCategory]]>)
    .filter(([, category]) => category.visible)

  return (
    <GridDialogBackdrop>
      <div className="plm-extension-grid-form-confirm-panel plm-extension-grid-form-progress-panel">
        <div className="plm-extension-grid-form-confirm-title">Committing Changes</div>
        <div className="plm-extension-grid-form-confirm-text">{state.message}</div>
        <div className="plm-extension-grid-form-progress-grid">
          {rows.map(([key, category]) => {
            const safeTotal = Math.max(0, category.total)
            const boundedCurrent = Math.max(0, Math.min(category.current, safeTotal))
            const percent = safeTotal <= 0 ? 100 : Math.round((boundedCurrent / safeTotal) * 100)
            return (
              <div key={key} className="plm-extension-grid-form-progress-row">
                <span className="plm-extension-grid-form-progress-label">{category.label}</span>
                <span className="plm-extension-grid-form-progress-track">
                  <span className="plm-extension-grid-form-progress-fill" style={{ width: `${percent}%` }} />
                </span>
                <span className="plm-extension-grid-form-progress-value">{`${boundedCurrent}/${safeTotal}`}</span>
              </div>
            )
          })}
        </div>
      </div>
    </GridDialogBackdrop>
  )
}

export function showCommitProgressDialog(overlay: HTMLElement, summary: StagedSummary): CommitProgressDialog {
  const host = document.createElement('div')
  overlay.appendChild(host)
  const root: Root = createRoot(host)
  let closed = false
  const state: ProgressState = {
    message: 'Starting commit...',
    categories: {
      new: { current: 0, total: summary.newRows, visible: summary.newRows > 0, label: 'New' },
      update: { current: 0, total: summary.editedRows, visible: summary.editedRows > 0, label: 'Updates' },
      delete: { current: 0, total: summary.deletedRows, visible: summary.deletedRows > 0, label: 'Delete' }
    }
  }

  const render = (): void => {
    if (closed) return
    root.render(<CommitProgressDialogView state={state} />)
  }

  render()

  return {
    setCategoryProgress(category, current, total) {
      state.categories[category].current = current
      state.categories[category].total = total
      state.categories[category].visible = total > 0
      render()
    },
    setMessage(message) {
      state.message = message
      render()
    },
    close() {
      if (closed) return
      closed = true
      root.unmount()
      host.remove()
    }
  }
}

export function showCommitErrors(overlay: HTMLElement, errors: string[]): Promise<void> {
  return renderDialogPromise(overlay, (resolve) => (
    <GridDialogBackdrop onClose={() => resolve()}>
      <div className="plm-extension-grid-form-confirm-panel plm-extension-grid-form-errors-panel">
        <div className="plm-extension-grid-form-confirm-title">Commit Errors</div>
        <div className="plm-extension-grid-form-confirm-text">
          {`Some operations failed (${errors.length}). Review details below.`}
        </div>
        <ul className="plm-extension-grid-form-confirm-list">
          {errors.map((message, index) => (
            <li key={`${index}:${message}`}>{message}</li>
          ))}
        </ul>
        <div className="plm-extension-grid-form-confirm-actions">
          <button
            type="button"
            className="plm-extension-grid-form-action plm-extension-grid-form-action--primary plm-extension-btn plm-extension-btn--primary"
            onClick={() => resolve()}
          >
            Close
          </button>
        </div>
      </div>
    </GridDialogBackdrop>
  ))
}
