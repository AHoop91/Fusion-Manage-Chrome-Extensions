import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { BomCloneStateSnapshot } from '../../clone.types'
import type { CloneStructureViewModel } from '../../services/viewModel.service'
import { buildButtonClassName } from '../shell/CloneShell'
import { Loader } from '../shell/Loader'
import { CloneCommitProgressOverlay } from '../structure/StructureSummary'

type LinkableDialogRuntime = typeof import('./LinkableDialog')

export type ConfirmDialogOptions = {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
}

export type SplitQuantityDialogOptions = {
  descriptor: string
  totalQuantity: string
  remainingQuantity: string
  currentQuantity: string
  maxSplitQuantity: string
  unitOfMeasure: string
  processOptions: Array<{ operationNodeId: string; label: string }>
  allowRootDestinationWhenEmpty?: boolean
  allowEqualCurrentQuantity?: boolean
}

function dialogBackdropStyle(): React.CSSProperties {
  return {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15,23,42,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2147483647
  }
}

function dialogPanelStyle(width: string): React.CSSProperties {
  return {
    width,
    background: '#ffffff',
    borderRadius: '10px',
    boxShadow: '0 20px 50px rgba(0,0,0,0.28)',
    padding: '18px'
  }
}

function ReactConfirmDialog(props: {
  options: ConfirmDialogOptions
  onResolve: (confirmed: boolean) => void
}): React.JSX.Element {
  const { options, onResolve } = props
  return (
    <div
      style={dialogBackdropStyle()}
      onClick={(event) => {
        if (event.target === event.currentTarget) onResolve(false)
      }}
    >
      <div style={dialogPanelStyle('min(460px,92vw)')}>
        <div style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: '#19222e' }}>{options.title}</div>
        <div style={{ margin: '0 0 16px', color: '#384456', fontSize: '14px', lineHeight: 1.45 }}>{options.message}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            className={buildButtonClassName('secondary')}
            onClick={() => onResolve(false)}
          >
            {options.cancelLabel}
          </button>
          <button
            type="button"
            className={buildButtonClassName('primary')}
            onClick={() => onResolve(true)}
          >
            {options.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

function ReactSplitQuantityDialog(props: {
  options: SplitQuantityDialogOptions
  onResolve: (result: { destinationOperationNodeId: string; splitQuantity: string } | null) => void
}): React.JSX.Element {
  const { options, onResolve } = props
  const [destinationOperationNodeId, setDestinationOperationNodeId] = useState('')
  const [splitQuantity, setSplitQuantity] = useState('')
  const [error, setError] = useState('')
  const processSelectRef = useRef<HTMLSelectElement | null>(null)
  const quantityInputRef = useRef<HTMLInputElement | null>(null)
  const hasProcessOptions = options.processOptions.length > 0

  useEffect(() => {
    window.setTimeout(() => {
      if (hasProcessOptions) processSelectRef.current?.focus()
      else quantityInputRef.current?.focus()
    }, 0)
  }, [hasProcessOptions])

  const parseQuantity = (value: string): number => {
    const parsed = Number.parseFloat(String(value || '').trim())
    return Number.isFinite(parsed) ? parsed : NaN
  }

  const currentQuantityNumber = parseQuantity(options.currentQuantity)

  return (
    <div
      style={dialogBackdropStyle()}
      onClick={(event) => {
        if (event.target === event.currentTarget) onResolve(null)
      }}
    >
      <div style={dialogPanelStyle('min(520px,92vw)')}>
        <div style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: '#19222e' }}>Split Quantity</div>
        <div style={{ margin: '0 0 12px', color: '#384456', fontSize: '13px', lineHeight: 1.35, wordBreak: 'break-word' }}>
          {options.descriptor}
        </div>
        <div style={{ margin: '0 0 12px', color: '#304960', fontSize: '12px', lineHeight: 1.3 }}>
          <strong>Total Quantity</strong>{`: ${options.totalQuantity}`} | <strong>Remaining Quantity</strong>{`: ${options.remainingQuantity}`} | <strong>Unit of Measure</strong>{`: ${String(options.unitOfMeasure || '').trim() || '-'}`}
        </div>
        {hasProcessOptions && (
          <>
            <label style={{ display: 'block', margin: '0 0 6px', color: '#2f435a', fontSize: '12px', fontWeight: 700 }}>
              Destination Process
            </label>
            <select
              ref={processSelectRef}
              value={destinationOperationNodeId}
              style={{ width: '100%', height: '34px', border: '1px solid #b8c7d8', borderRadius: '4px', padding: '0 10px', font: '500 13px/1.2 "ArtifaktElement","Segoe UI",Arial,sans-serif', color: '#1f2937' }}
              onChange={(event) => setDestinationOperationNodeId(event.target.value)}
            >
              <option value="">Select process...</option>
              {options.processOptions.map((entry) => (
                <option key={entry.operationNodeId} value={entry.operationNodeId}>{entry.label}</option>
              ))}
            </select>
          </>
        )}
        <label style={{ display: 'block', margin: '12px 0 6px', color: '#2f435a', fontSize: '12px', fontWeight: 700 }}>
          Split Quantity
        </label>
        <input
          ref={quantityInputRef}
          type="text"
          inputMode="decimal"
          placeholder="Enter split quantity"
          value={splitQuantity}
          style={{ width: '100%', height: '34px', border: '1px solid #b8c7d8', borderRadius: '4px', padding: '0 10px', font: '500 13px/1.2 "ArtifaktElement","Segoe UI",Arial,sans-serif', color: '#1f2937' }}
          onChange={(event) => {
            const sanitized = event.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1')
            setSplitQuantity(sanitized)
          }}
        />
        <div style={{ margin: '6px 0 0', color: '#5b6f84', fontSize: '11px', lineHeight: 1.3 }}>
          {options.allowEqualCurrentQuantity
            ? `Split quantity must be > 0 and <= ${options.currentQuantity} (max: ${options.maxSplitQuantity}).`
            : `Split quantity must be > 0 and < ${options.currentQuantity} (max: ${options.maxSplitQuantity}).`}
        </div>
        {error && (
          <div style={{ margin: '10px 0 0', color: '#b42318', fontSize: '12px', fontWeight: 600, lineHeight: 1.25 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
          <button
            type="button"
            className={buildButtonClassName('secondary')}
            onClick={() => onResolve(null)}
          >
            Cancel
          </button>
          <button
            type="button"
            className={buildButtonClassName('primary')}
            onClick={() => {
              if (hasProcessOptions && !destinationOperationNodeId.trim()) {
                setError('Select a destination process.')
                return
              }

              const splitQuantityRaw = String(splitQuantity || '').trim()
              const splitQuantityNumber = parseQuantity(splitQuantityRaw)
              if (!Number.isFinite(splitQuantityNumber) || splitQuantityNumber <= 0) {
                setError('Split quantity must be greater than zero.')
                return
              }
              if (!Number.isFinite(currentQuantityNumber)) {
                setError('Unable to validate split quantity right now.')
                return
              }
              if (options.allowEqualCurrentQuantity) {
                if (splitQuantityNumber > currentQuantityNumber) {
                  setError(`Split quantity must be less than or equal to ${options.currentQuantity}.`)
                  return
                }
              } else if (splitQuantityNumber >= currentQuantityNumber) {
                setError(`Split quantity must be less than ${options.currentQuantity}.`)
                return
              }

              onResolve({
                destinationOperationNodeId: destinationOperationNodeId.trim(),
                splitQuantity: splitQuantityRaw
              })
            }}
          >
            Split
          </button>
        </div>
      </div>
    </div>
  )
}

function renderDialogPromise<T>(
  modalRoot: HTMLDivElement,
  renderDialog: (resolve: (result: T) => void) => React.JSX.Element
): Promise<T> {
  return new Promise((resolve) => {
    const host = document.createElement('div')
    modalRoot.appendChild(host)
    const root = createRoot(host)

    const close = (result: T): void => {
      root.unmount()
      host.remove()
      resolve(result)
    }

    root.render(renderDialog(close))
  })
}

export function showActionConfirm(modalRoot: HTMLDivElement, options: ConfirmDialogOptions): Promise<boolean> {
  return renderDialogPromise(modalRoot, (resolve) => (
    <ReactConfirmDialog options={options} onResolve={resolve} />
  ))
}

export function showSplitQuantityDialogModal(
  modalRoot: HTMLDivElement,
  options: SplitQuantityDialogOptions
): Promise<{ destinationOperationNodeId: string; splitQuantity: string } | null> {
  return renderDialogPromise(modalRoot, (resolve) => (
    <ReactSplitQuantityDialog options={options} onResolve={resolve} />
  ))
}

export function CloneCommitErrorsOverlay(props: {
  snapshot: BomCloneStateSnapshot
  onClose: () => void
}): React.JSX.Element | null {
  const { snapshot, onClose } = props
  if (!snapshot.commitErrorsModalOpen || snapshot.commitErrors.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.32)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2147483646
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: 'min(820px,90vw)',
          maxHeight: 'min(72vh,680px)',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          border: '1px solid #d3dbe7',
          borderRadius: '10px',
          boxShadow: '0 16px 40px rgba(15,23,42,0.24)',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            gap: '12px',
            padding: '10px 12px',
            borderBottom: '1px solid #e4e9f1',
            background: '#f7f9fc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minWidth: 0 }}>
            <h4
              style={{
                margin: 0,
                font: '700 16px/1.2 "ArtifaktElement","Segoe UI",Arial,sans-serif',
                color: '#1f2f43'
              }}
            >
              Commit Errors
            </h4>
            <span
              style={{
                margin: 0,
                color: '#4b637a',
                font: '500 12px/1.2 "ArtifaktElement","Segoe UI",Arial,sans-serif',
                whiteSpace: 'nowrap'
              }}
            >
              {`${snapshot.commitErrors.length} process(es) failed`}
            </span>
          </div>
        </div>
        <div
          style={{
            padding: '10px 12px 12px',
            overflow: 'auto',
            height: 'min(420px,58vh)',
            minHeight: 0
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '320px', padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #dbe4ef', color: '#2a3d54', fontWeight: 700 }}>
                  Descriptor
                </th>
                <th style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #dbe4ef', color: '#2a3d54', fontWeight: 700 }}>
                  Message
                </th>
              </tr>
            </thead>
            <tbody>
              {snapshot.commitErrors.map((entry, index) => (
                <tr key={`${entry.nodeId}:${index}`} style={{ borderBottom: '1px solid #edf2f8', verticalAlign: 'top' }}>
                  <td title={entry.descriptor} style={{ padding: '8px 10px', textAlign: 'left', color: '#23384f', wordBreak: 'break-word' }}>
                    {entry.descriptor}
                  </td>
                  <td title={entry.message} style={{ padding: '8px 10px', textAlign: 'left', color: '#23384f', wordBreak: 'break-word' }}>
                    {entry.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '10px 12px',
            borderTop: '1px solid #e4e9f1',
            background: '#f7f9fc'
          }}
        >
          <button
            type="button"
            className={buildButtonClassName('secondary')}
            style={{ minWidth: '72px', height: '30px' }}
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export function CloneBodyOverlays(props: {
  modalRoot: HTMLDivElement | null
  snapshot: BomCloneStateSnapshot
  structureContext: CloneStructureViewModel | null
  handlers: {
    onCloseCommitErrors: () => void
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
  linkableDialogRuntime: LinkableDialogRuntime | null
  ensureLinkableDialogRuntime: () => void
}): React.JSX.Element | null {
  const {
    modalRoot,
    snapshot,
    structureContext,
    handlers,
    linkableDialogRuntime,
    ensureLinkableDialogRuntime
  } = props

  useEffect(() => {
    if (snapshot.clonePhase !== 'structure' || !snapshot.linkableDialogOpen || linkableDialogRuntime) return
    ensureLinkableDialogRuntime()
  }, [snapshot.clonePhase, snapshot.linkableDialogOpen, linkableDialogRuntime, ensureLinkableDialogRuntime])

  if (snapshot.clonePhase !== 'structure') return null

  const linkableOverlay = snapshot.linkableDialogOpen ? (
    linkableDialogRuntime ? (
      <linkableDialogRuntime.CloneLinkableDialog snapshot={snapshot} handlers={handlers} />
    ) : (
      <div className="plm-extension-bom-linkable-overlay">
        <div className="plm-extension-bom-linkable-dialog">
          <div className="plm-extension-bom-linkable-header">
            <h4>Add Linkable Item</h4>
            <button
              type="button"
              className="plm-extension-bom-linkable-close plm-extension-btn plm-extension-btn--secondary"
              aria-label="Loading dialog"
              disabled
            >
              <span className="zmdi zmdi-close" />
            </button>
          </div>
          <div className="plm-extension-bom-linkable-dialog-loading">
            <Loader label="Loading dialog..." />
          </div>
        </div>
      </div>
    )
  ) : null

  const commitErrorsOverlay = (
    <CloneCommitErrorsOverlay snapshot={snapshot} onClose={handlers.onCloseCommitErrors} />
  )

  const commitProgressOverlay = snapshot.commitInProgress && structureContext ? (
    <CloneCommitProgressOverlay snapshot={snapshot} structureContext={structureContext} />
  ) : null

  return (
    <>
      {modalRoot && linkableOverlay ? createPortal(linkableOverlay, modalRoot) : linkableOverlay}
      {modalRoot && commitErrorsOverlay ? createPortal(commitErrorsOverlay, modalRoot) : commitErrorsOverlay}
      {modalRoot && commitProgressOverlay ? createPortal(commitProgressOverlay, modalRoot) : commitProgressOverlay}
    </>
  )
}
