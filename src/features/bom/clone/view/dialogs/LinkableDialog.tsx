import React from 'react'
import type { BomCloneStateSnapshot } from '../../clone.types'
import { buildLinkableDialogViewModel } from '../../services/viewModel.service'

export type CloneLinkableDialogHandlers = {
  onCloseLinkableDialog: () => void
  onLinkableSearchInput: (value: string) => void
  onClearLinkableSelection: () => void
  onToggleLinkableDisplayOnlySelected: () => void
  onToggleLinkableShowOnlyErrors: () => void
  onLinkableDialogScrollNearEnd: () => void
  onResizeLinkableColumn: (column: 'item' | 'workspace' | 'lifecycle', width: number) => void
  onToggleLinkableItem: (itemId: number, selected: boolean) => void
  onAddSelectedLinkableItems: () => void
}

function LinkableLoader(props: { label: string }): React.JSX.Element {
  const { label } = props
  return (
    <div className="plm-extension-bom-clone-loading-center">
      <div className="generic-loader plm-extension-loader">
        <div className="bounce1" />
        <div className="bounce2" />
        <div className="bounce3" />
      </div>
      <div className="plm-extension-bom-clone-loading-text">{label}</div>
    </div>
  )
}

function LinkableStatusRow(props: { children: React.ReactNode }): React.JSX.Element {
  const { children } = props
  return (
    <tr>
      <td colSpan={4} className="plm-extension-bom-linkable-empty">
        {children}
      </td>
    </tr>
  )
}

function LinkableColumnResizeHandle(props: {
  column: 'item' | 'workspace' | 'lifecycle'
  currentWidth: number
  onResize: (column: 'item' | 'workspace' | 'lifecycle', width: number) => void
}): React.JSX.Element {
  const { column, currentWidth, onResize } = props

  return (
    <span
      className="plm-extension-bom-linkable-col-resizer"
      onMouseDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
        const startX = event.clientX
        const onMouseMove = (moveEvent: MouseEvent): void => onResize(column, currentWidth + (moveEvent.clientX - startX))
        const onMouseUp = (): void => {
          window.removeEventListener('mousemove', onMouseMove)
          window.removeEventListener('mouseup', onMouseUp)
        }
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('mouseup', onMouseUp)
      }}
    />
  )
}

/**
 * React version of the BOM linkable-item dialog.
 * This replaces the imperative DOM builder so the dialog can live inside the
 * BOM React shell without another imperative island.
 */
export function CloneLinkableDialog(props: {
  snapshot: BomCloneStateSnapshot
  handlers: CloneLinkableDialogHandlers
}): React.JSX.Element {
  const { snapshot, handlers } = props
  const viewModel = buildLinkableDialogViewModel(snapshot)
  const selectedCount = snapshot.linkableSelectedItemIds.length
  const progressPercent = snapshot.linkableAddProgressTotal > 0
    ? Math.max(0, Math.min(100, Math.round((snapshot.linkableAddProgressCurrent / Math.max(1, snapshot.linkableAddProgressTotal)) * 100)))
    : 0

  return (
    <div className="plm-extension-bom-linkable-overlay">
      <div className="plm-extension-bom-linkable-dialog">
        <div className="plm-extension-bom-linkable-header">
          <h4>Add Linkable Item</h4>
          <button
            type="button"
            className="plm-extension-bom-linkable-close plm-extension-btn plm-extension-btn--secondary"
            onClick={handlers.onCloseLinkableDialog}
          >
            <span className="zmdi zmdi-close" />
          </button>
        </div>

        <div className="plm-extension-bom-linkable-search">
          <div className="plm-extension-bom-linkable-search-title">Search</div>
          <input
            type="text"
            placeholder="Type to filter items"
            value={snapshot.linkableSearch}
            data-plm-focus-key="linkable-search-input"
            onChange={(event) => handlers.onLinkableSearchInput(event.target.value)}
          />

          <div className="plm-extension-bom-linkable-selected-tools">
            <div className="plm-extension-bom-linkable-selected-actions">
              <button
                type="button"
                className="plm-extension-bom-linkable-action-btn plm-extension-btn plm-extension-btn--secondary"
                disabled={selectedCount === 0 || snapshot.linkableAdding}
                onClick={handlers.onClearLinkableSelection}
              >
                Remove Selected
              </button>
              <button
                type="button"
                className="plm-extension-bom-linkable-action-btn plm-extension-btn plm-extension-btn--secondary"
                disabled={selectedCount === 0 || snapshot.linkableAdding}
                onClick={handlers.onToggleLinkableDisplayOnlySelected}
              >
                {snapshot.linkableDisplayOnlySelected ? 'Display Only Selected: On' : 'Display Only Selected'}
              </button>
              {Object.keys(snapshot.linkableItemErrors).length > 0 && (
                <button
                  type="button"
                  className="plm-extension-bom-linkable-action-btn plm-extension-btn plm-extension-btn--secondary"
                  disabled={snapshot.linkableAdding}
                  onClick={handlers.onToggleLinkableShowOnlyErrors}
                >
                  {snapshot.linkableShowOnlyErrors ? 'Show Only Errors: On' : 'Show Only Errors'}
                </button>
              )}
            </div>
          </div>
        </div>

        {snapshot.linkableError && (
          <p className="plm-extension-bom-clone-error">{snapshot.linkableError}</p>
        )}

        <div
          className="plm-extension-bom-linkable-table-wrap"
          onScroll={(event) => {
            const tableWrap = event.currentTarget
            const thresholdPx = 120
            if (tableWrap.scrollTop + tableWrap.clientHeight >= tableWrap.scrollHeight - thresholdPx) {
              handlers.onLinkableDialogScrollNearEnd()
            }
          }}
        >
          <table className="plm-extension-bom-linkable-table plm-extension-table">
            <colgroup>
              <col style={{ width: '42px' }} />
              <col style={{ width: `${snapshot.linkableColumnWidths.item}px` }} />
              <col style={{ width: `${snapshot.linkableColumnWidths.workspace}px` }} />
              <col style={{ width: `${snapshot.linkableColumnWidths.lifecycle}px` }} />
            </colgroup>
            <thead>
              <tr>
                <th />
                <th>
                  Item
                  <LinkableColumnResizeHandle
                    column="item"
                    currentWidth={snapshot.linkableColumnWidths.item}
                    onResize={handlers.onResizeLinkableColumn}
                  />
                </th>
                <th>
                  Workspace
                  <LinkableColumnResizeHandle
                    column="workspace"
                    currentWidth={snapshot.linkableColumnWidths.workspace}
                    onResize={handlers.onResizeLinkableColumn}
                  />
                </th>
                <th>
                  Lifecycle
                  <LinkableColumnResizeHandle
                    column="lifecycle"
                    currentWidth={snapshot.linkableColumnWidths.lifecycle}
                    onResize={handlers.onResizeLinkableColumn}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {viewModel.showInitialLoading && (
                <LinkableStatusRow>
                  <LinkableLoader label="Loading" />
                </LinkableStatusRow>
              )}

              {viewModel.emptyMessage && (
                <LinkableStatusRow>{viewModel.emptyMessage}</LinkableStatusRow>
              )}

              {!viewModel.showInitialLoading && viewModel.rows.map((rowViewModel) => (
                <tr
                  key={rowViewModel.item.id}
                  className={[
                    rowViewModel.isSelected ? 'is-selected' : '',
                    rowViewModel.errorMessage ? 'has-error' : '',
                    rowViewModel.isOnTargetBom ? 'is-on-target-bom' : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => {
                    if (rowViewModel.isOnTargetBom) return
                    handlers.onToggleLinkableItem(rowViewModel.item.id, !rowViewModel.isSelected)
                  }}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={rowViewModel.isSelected && !rowViewModel.isOnTargetBom}
                      disabled={rowViewModel.isOnTargetBom}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => {
                        if (rowViewModel.isOnTargetBom) return
                        handlers.onToggleLinkableItem(rowViewModel.item.id, event.target.checked)
                      }}
                    />
                    {rowViewModel.isPotentialDuplicate && (
                      <span
                        className="plm-extension-bom-linkable-duplicate-warn"
                        title="Another revision of this item is already staged in the source table"
                      >
                        &#9888;
                      </span>
                    )}
                    {rowViewModel.errorMessage && (
                      <span
                        className="plm-extension-bom-linkable-row-error"
                        title={rowViewModel.errorMessage}
                      >
                        !
                      </span>
                    )}
                  </td>
                  <td>{rowViewModel.item.label}</td>
                  <td>{rowViewModel.item.workspace}</td>
                  <td>{rowViewModel.item.lifecycle}</td>
                </tr>
              ))}

              {viewModel.showTrailingLoading && (
                <LinkableStatusRow>
                  <LinkableLoader label="Loading" />
                </LinkableStatusRow>
              )}
            </tbody>
          </table>
        </div>

        <div className="plm-extension-bom-linkable-footer">
          <div className="plm-extension-bom-linkable-footer-bar">
            <div className="plm-extension-bom-linkable-footer-count">
              {`${viewModel.visibleCount} of ${snapshot.linkableTotal} items`}
            </div>
            <div className="plm-extension-bom-linkable-footer-selected">
              {`${snapshot.linkableSelectedItemIds.length} selected`}
            </div>
          </div>
        </div>

        {snapshot.linkableAdding && snapshot.linkableAddProgressTotal > 0 && (
          <div className="plm-extension-bom-linkable-progress-wrap">
            <div className="plm-extension-bom-linkable-progress-text">
              {`Adding ${snapshot.linkableAddProgressCurrent} of ${snapshot.linkableAddProgressTotal}`}
            </div>
            <div className="plm-extension-bom-linkable-progress-track">
              <div className="plm-extension-bom-linkable-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        )}

        <div className="plm-extension-bom-linkable-actions">
          <button
            type="button"
            className="plm-extension-bom-linkable-action-btn plm-extension-btn plm-extension-btn--secondary"
            disabled={snapshot.linkableAdding}
            onClick={handlers.onCloseLinkableDialog}
          >
            Cancel
          </button>
          <button
            type="button"
            className="plm-extension-bom-clone-btn plm-extension-bom-clone-btn-primary plm-extension-btn plm-extension-btn--primary"
            disabled={snapshot.linkableSelectedItemIds.length === 0 || snapshot.linkableAdding}
            onClick={handlers.onAddSelectedLinkableItems}
          >
            {snapshot.linkableAdding ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}


