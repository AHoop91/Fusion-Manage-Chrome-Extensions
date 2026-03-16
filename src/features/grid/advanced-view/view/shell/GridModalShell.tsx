import React from 'react'
import { flushSync } from 'react-dom'
import { createRoot, type Root } from 'react-dom/client'
import { GRID_FORM_FIELDS_ID, GRID_FORM_MODAL_ID, GRID_FORM_REQUIRED_TOGGLE_ID, GRID_FORM_STATUS_ID } from '../constants'

type GridModalOverlay = HTMLDivElement & { __plmReactRoot?: Root }

export interface ModalDomRefs {
  overlay: HTMLDivElement
  panel: HTMLDivElement
  loading: HTMLDivElement
  loadingText: HTMLSpanElement
  expandAction: HTMLButtonElement
  toolbar: HTMLDivElement
  requiredSummary: HTMLDivElement
  requiredToggle: HTMLInputElement
  body: HTMLDivElement
  bodyLoading: HTMLDivElement
  left: HTMLDivElement
  leftActions: HTMLDivElement
  selectErroredAction: HTMLButtonElement
  clearSelectionAction: HTMLButtonElement
  selectedCountLabel: HTMLSpanElement
  rowTable: HTMLTableElement
  rowTableHeadRow: HTMLTableRowElement
  rowTableBody: HTMLTableSectionElement
  main: HTMLDivElement
  fieldsTitle: HTMLDivElement
  fieldsClose: HTMLButtonElement
  fieldsNotice: HTMLDivElement
  fieldsNoticeText: HTMLDivElement
  fieldsNoticeRequired: HTMLDivElement
  fieldsRoot: HTMLDivElement
  status: HTMLDivElement
  closeAction: HTMLButtonElement
  addAction: HTMLButtonElement
  editAction: HTMLButtonElement
  cloneAction: HTMLButtonElement
  revertAction: HTMLButtonElement
  removeAction: HTMLButtonElement
  commitAction: HTMLButtonElement
}

type ShellCaptureRefs = Omit<ModalDomRefs, 'overlay'>

function GridModalShell(props: {
  capture: { [K in keyof ShellCaptureRefs]: (node: ShellCaptureRefs[K] | null) => void }
}): React.JSX.Element {
  const { capture } = props

  return (
    <div ref={capture.panel} className="plm-extension-grid-form-panel">
      <div className="plm-extension-grid-form-header">
        <div>
          <div className="plm-extension-grid-form-title">Advanced Editor</div>
          <div className="plm-extension-grid-form-subtitle">Rows and fields are generated from Grid API metadata.</div>
          <div ref={capture.loading} className="plm-extension-grid-form-loading">
            <span className="plm-extension-grid-form-loading-spinner" />
            <span ref={capture.loadingText}>Loading metadata...</span>
          </div>
        </div>
        <div className="plm-extension-grid-form-header-actions">
          <button
            ref={capture.expandAction}
            type="button"
            className="plm-extension-grid-form-expand plm-extension-btn plm-extension-btn--secondary"
            title="Expand editor"
            dangerouslySetInnerHTML={{ __html: '<i class="zmdi zmdi-fullscreen" aria-hidden="true"></i>' }}
          />
        </div>
      </div>

      <div ref={capture.toolbar} className="plm-extension-grid-form-toolbar">
        <div ref={capture.requiredSummary} className="plm-extension-grid-form-required-summary">
          Required Fields Remaining: checking...
        </div>
      </div>

      <div ref={capture.body} className="plm-extension-grid-form-body">
        <div ref={capture.left} className="plm-extension-grid-form-left">
          <div className="plm-extension-grid-form-left-header">
            <div className="plm-extension-grid-form-left-title-tools">
              <div className="plm-extension-grid-form-left-title">Rows (Read only)</div>
              <span ref={capture.selectedCountLabel} className="plm-extension-grid-form-selected-count" style={{ display: 'none' }}>
                <span className="plm-extension-grid-form-selected-count-text">0 selected</span>
                <button
                  ref={capture.clearSelectionAction}
                  type="button"
                  className="plm-extension-grid-form-selected-count-clear"
                  aria-label="Clear selected rows"
                  title="Clear selected rows"
                >
                  X
                </button>
              </span>
            </div>
            <div ref={capture.leftActions} className="plm-extension-grid-form-left-actions">
              <button ref={capture.addAction} type="button" className="plm-extension-grid-form-action plm-extension-btn plm-extension-btn--secondary">Add</button>
              <button ref={capture.editAction} type="button" className="plm-extension-grid-form-action plm-extension-grid-form-action--primary plm-extension-btn plm-extension-btn--primary">Edit</button>
              <button ref={capture.cloneAction} type="button" className="plm-extension-grid-form-action plm-extension-btn plm-extension-btn--secondary">Clone</button>
              <button ref={capture.revertAction} type="button" className="plm-extension-grid-form-action plm-extension-btn plm-extension-btn--secondary">Revert</button>
              <button ref={capture.removeAction} type="button" className="plm-extension-grid-form-action plm-extension-btn plm-extension-btn--secondary">Remove</button>
              <button
                ref={capture.selectErroredAction}
                type="button"
                className="plm-extension-grid-form-action plm-extension-btn plm-extension-btn--secondary"
                style={{ display: 'none' }}
              >
                Select Errored
              </button>
            </div>
          </div>

          <div className="plm-extension-grid-form-table-wrap">
            <div className="plm-extension-grid-form-table-scroll">
              <table ref={capture.rowTable} className="plm-extension-grid-form-row-table">
                <thead>
                  <tr ref={capture.rowTableHeadRow} />
                </thead>
                <tbody ref={capture.rowTableBody} />
              </table>
            </div>
          </div>
        </div>

        <div ref={capture.main} className="plm-extension-grid-form-main">
          <div className="plm-extension-grid-form-fields-header">
            <div ref={capture.fieldsTitle} className="plm-extension-grid-form-fields-title">FORM FIELDS</div>
            <button
              ref={capture.fieldsClose}
              type="button"
              className="plm-extension-grid-form-fields-close plm-extension-btn plm-extension-btn--secondary"
              aria-label="Close form fields"
              title="Close form fields"
            >
              Close
            </button>
          </div>
          <div className="plm-extension-grid-form-fields-controls">
            <label className="plm-extension-grid-form-toggle" htmlFor={GRID_FORM_REQUIRED_TOGGLE_ID}>
              <input ref={capture.requiredToggle} id={GRID_FORM_REQUIRED_TOGGLE_ID} type="checkbox" />
              <span>Required only</span>
            </label>
          </div>
          <div ref={capture.fieldsNotice} className="plm-extension-grid-form-fields-note">
            <div ref={capture.fieldsNoticeText} className="plm-extension-grid-form-fields-note-text" />
            <div ref={capture.fieldsNoticeRequired} className="plm-extension-grid-form-fields-note-required" />
          </div>
          <div ref={capture.fieldsRoot} id={GRID_FORM_FIELDS_ID} />
        </div>

        <div ref={capture.bodyLoading} className="plm-extension-grid-form-body-loading">
          <div className="generic-loader plm-extension-loader">
            <div className="bounce1" />
            <div className="bounce2" />
            <div className="bounce3" />
          </div>
          <span className="plm-extension-grid-form-body-loading-text">Loading Advanced Editor...</span>
        </div>
      </div>

      <div className="plm-extension-grid-form-footer">
        <div className="plm-extension-grid-form-status-stack">
          <div ref={capture.status} id={GRID_FORM_STATUS_ID} />
        </div>
        <div className="plm-extension-grid-form-actions">
          <button ref={capture.closeAction} type="button" className="plm-extension-grid-form-action plm-extension-btn plm-extension-btn--secondary">Cancel</button>
          <button ref={capture.commitAction} type="button" className="plm-extension-grid-form-action plm-extension-grid-form-action--primary plm-extension-btn plm-extension-btn--primary">Commit Changes</button>
        </div>
      </div>
    </div>
  )
}

function requireRef<T>(value: T | null, name: keyof ModalDomRefs): T {
  if (value === null) throw new Error(`Grid modal shell did not capture required ref: ${String(name)}`)
  return value
}

export function buildModalDom(): ModalDomRefs {
  const overlay = document.createElement('div') as GridModalOverlay
  overlay.id = GRID_FORM_MODAL_ID

  let panel: HTMLDivElement | null = null
  let loading: HTMLDivElement | null = null
  let loadingText: HTMLSpanElement | null = null
  let expandAction: HTMLButtonElement | null = null
  let toolbar: HTMLDivElement | null = null
  let requiredSummary: HTMLDivElement | null = null
  let requiredToggle: HTMLInputElement | null = null
  let body: HTMLDivElement | null = null
  let bodyLoading: HTMLDivElement | null = null
  let left: HTMLDivElement | null = null
  let leftActions: HTMLDivElement | null = null
  let selectErroredAction: HTMLButtonElement | null = null
  let clearSelectionAction: HTMLButtonElement | null = null
  let selectedCountLabel: HTMLSpanElement | null = null
  let rowTable: HTMLTableElement | null = null
  let rowTableHeadRow: HTMLTableRowElement | null = null
  let rowTableBody: HTMLTableSectionElement | null = null
  let main: HTMLDivElement | null = null
  let fieldsTitle: HTMLDivElement | null = null
  let fieldsClose: HTMLButtonElement | null = null
  let fieldsNotice: HTMLDivElement | null = null
  let fieldsNoticeText: HTMLDivElement | null = null
  let fieldsNoticeRequired: HTMLDivElement | null = null
  let fieldsRoot: HTMLDivElement | null = null
  let status: HTMLDivElement | null = null
  let closeAction: HTMLButtonElement | null = null
  let addAction: HTMLButtonElement | null = null
  let editAction: HTMLButtonElement | null = null
  let cloneAction: HTMLButtonElement | null = null
  let revertAction: HTMLButtonElement | null = null
  let removeAction: HTMLButtonElement | null = null
  let commitAction: HTMLButtonElement | null = null

  const root = createRoot(overlay)
  overlay.__plmReactRoot = root

  flushSync(() => {
    root.render(
      <GridModalShell
        capture={{
          panel: (node) => { panel = node },
          loading: (node) => { loading = node },
          loadingText: (node) => { loadingText = node },
          expandAction: (node) => { expandAction = node },
          toolbar: (node) => { toolbar = node },
          requiredSummary: (node) => { requiredSummary = node },
          requiredToggle: (node) => { requiredToggle = node },
          body: (node) => { body = node },
          bodyLoading: (node) => { bodyLoading = node },
          left: (node) => { left = node },
          leftActions: (node) => { leftActions = node },
          selectErroredAction: (node) => { selectErroredAction = node },
          clearSelectionAction: (node) => { clearSelectionAction = node },
          selectedCountLabel: (node) => { selectedCountLabel = node },
          rowTable: (node) => { rowTable = node },
          rowTableHeadRow: (node) => { rowTableHeadRow = node },
          rowTableBody: (node) => { rowTableBody = node },
          main: (node) => { main = node },
          fieldsTitle: (node) => { fieldsTitle = node },
          fieldsClose: (node) => { fieldsClose = node },
          fieldsNotice: (node) => { fieldsNotice = node },
          fieldsNoticeText: (node) => { fieldsNoticeText = node },
          fieldsNoticeRequired: (node) => { fieldsNoticeRequired = node },
          fieldsRoot: (node) => { fieldsRoot = node },
          status: (node) => { status = node },
          closeAction: (node) => { closeAction = node },
          addAction: (node) => { addAction = node },
          editAction: (node) => { editAction = node },
          cloneAction: (node) => { cloneAction = node },
          revertAction: (node) => { revertAction = node },
          removeAction: (node) => { removeAction = node },
          commitAction: (node) => { commitAction = node }
        }}
      />
    )
  })

  return {
    overlay,
    panel: requireRef(panel, 'panel'),
    loading: requireRef(loading, 'loading'),
    loadingText: requireRef(loadingText, 'loadingText'),
    expandAction: requireRef(expandAction, 'expandAction'),
    toolbar: requireRef(toolbar, 'toolbar'),
    requiredSummary: requireRef(requiredSummary, 'requiredSummary'),
    requiredToggle: requireRef(requiredToggle, 'requiredToggle'),
    body: requireRef(body, 'body'),
    bodyLoading: requireRef(bodyLoading, 'bodyLoading'),
    left: requireRef(left, 'left'),
    leftActions: requireRef(leftActions, 'leftActions'),
    selectErroredAction: requireRef(selectErroredAction, 'selectErroredAction'),
    clearSelectionAction: requireRef(clearSelectionAction, 'clearSelectionAction'),
    selectedCountLabel: requireRef(selectedCountLabel, 'selectedCountLabel'),
    rowTable: requireRef(rowTable, 'rowTable'),
    rowTableHeadRow: requireRef(rowTableHeadRow, 'rowTableHeadRow'),
    rowTableBody: requireRef(rowTableBody, 'rowTableBody'),
    main: requireRef(main, 'main'),
    fieldsTitle: requireRef(fieldsTitle, 'fieldsTitle'),
    fieldsClose: requireRef(fieldsClose, 'fieldsClose'),
    fieldsNotice: requireRef(fieldsNotice, 'fieldsNotice'),
    fieldsNoticeText: requireRef(fieldsNoticeText, 'fieldsNoticeText'),
    fieldsNoticeRequired: requireRef(fieldsNoticeRequired, 'fieldsNoticeRequired'),
    fieldsRoot: requireRef(fieldsRoot, 'fieldsRoot'),
    status: requireRef(status, 'status'),
    closeAction: requireRef(closeAction, 'closeAction'),
    addAction: requireRef(addAction, 'addAction'),
    editAction: requireRef(editAction, 'editAction'),
    cloneAction: requireRef(cloneAction, 'cloneAction'),
    revertAction: requireRef(revertAction, 'revertAction'),
    removeAction: requireRef(removeAction, 'removeAction'),
    commitAction: requireRef(commitAction, 'commitAction')
  }
}
