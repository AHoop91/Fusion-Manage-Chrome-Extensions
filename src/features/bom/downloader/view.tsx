import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { collectExpandableNodeIds, flattenNodesForDisplay, type BomCloneStructureRow } from '../clone/services/structure/tree.service'
import type { AttachmentDownloadBomNode } from './types'

type AttachmentDownloadHandlers = {
  onClose: () => void
  bomNodes: AttachmentDownloadBomNode[]
  bomLoading: boolean
  bomError: string | null
}

type AttachmentDownloadView = {
  render: (modalRoot: HTMLDivElement, handlers: AttachmentDownloadHandlers) => void
  unmount: (modalRoot: HTMLDivElement) => void
}

type AttachmentDownloadRules = {
  selectedExtensions: string[]
  customExtensions: string[]
  customExtensionInput: string
  fileNameSearchText: string
  lastModifiedRange: 'anytime' | 'today' | 'yesterday' | 'this-week' | 'this-month' | 'this-year' | '30d' | '60d' | '180d' | '365d' | 'custom'
  customModifiedFrom: string
  customModifiedTo: string
  createSubFolders: 'per-item' | 'per-top-level-item' | 'matching-bom-path'
  renameFiles:
    | 'filename-date'
    | 'date-filename'
    | 'filename-version'
    | 'filename-version-date'
    | 'filename-revision-version'
    | 'filename-revision-version-date'
    | 'descriptor'
    | 'descriptor-date'
    | 'descriptor-version'
    | 'descriptor-version-date'
    | 'descriptor-revision-version'
    | 'descriptor-revision-version-date'
}

const EXTENSION_GROUPS = [
  { id: 'pdf', label: 'PDF', extensions: ['.pdf'] },
  { id: 'stp', label: 'STP', extensions: ['.step', '.stp'] },
  { id: 'office', label: 'Office', extensions: ['.docx', '.xlsx', '.ppt', '.pptx'] }
] as const

function splitExtensions(value: string): string[] {
  return String(value || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

function normalizeCustomExtensionToken(value: string): string {
  const trimmed = String(value || '').trim().toLowerCase().replace(/,+$/g, '')
  if (!trimmed) return ''
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`
}

function areGroupExtensionsSelected(selectedExtensions: string[], groupExtensions: readonly string[]): boolean {
  return groupExtensions.every((extension) => selectedExtensions.includes(extension))
}

function toggleExtensionGroup(
  selectedExtensions: string[],
  groupExtensions: readonly string[],
  checked: boolean
): string[] {
  const next = new Set(selectedExtensions)
  for (const extension of groupExtensions) {
    if (checked) next.add(extension)
    else next.delete(extension)
  }
  return Array.from(next)
}

function applyCustomModifiedFrom(currentRules: AttachmentDownloadRules, nextFrom: string): AttachmentDownloadRules {
  const nextTo =
    currentRules.customModifiedTo && nextFrom && nextFrom > currentRules.customModifiedTo
      ? nextFrom
      : currentRules.customModifiedTo

  return {
    ...currentRules,
    customModifiedFrom: nextFrom,
    customModifiedTo: nextTo
  }
}

function applyCustomModifiedTo(currentRules: AttachmentDownloadRules, nextTo: string): AttachmentDownloadRules {
  const nextFrom =
    currentRules.customModifiedFrom && nextTo && nextTo < currentRules.customModifiedFrom
      ? nextTo
      : currentRules.customModifiedFrom

  return {
    ...currentRules,
    customModifiedFrom: nextFrom,
    customModifiedTo: nextTo
  }
}

function CubeGlyph(props: { assembly?: boolean }): React.JSX.Element {
  return (
    <svg
      className={`plm-extension-bom-structure-part-glyph${props.assembly ? ' is-assembly-badge' : ''}`}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={['M12 3L4 8V16L12 21L20 16V8Z', 'M4 8L12 13L20 8', 'M12 13V21'].join(' ')}
        fill="none"
        stroke={props.assembly ? '#2d79c7' : 'currentColor'}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function AttachmentDownloadModal(props: AttachmentDownloadHandlers): React.JSX.Element {
  const { onClose, bomNodes, bomLoading, bomError } = props
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set())
  const [rules, setRules] = useState<AttachmentDownloadRules>({
    selectedExtensions: ['.pdf', '.docx', '.xlsx', '.ppt', '.pptx', '.step', '.stp'],
    customExtensions: [],
    customExtensionInput: '',
    fileNameSearchText: '',
    lastModifiedRange: 'anytime',
    customModifiedFrom: '',
    customModifiedTo: '',
    createSubFolders: 'per-item',
    renameFiles: 'filename-date'
  })

  useEffect(() => {
    const panel = hostRef.current?.parentElement
    if (!(panel instanceof HTMLDivElement)) return
    panel.style.width = 'min(1280px, 98vw)'
    panel.style.height = 'min(840px, calc(100vh - 48px))'
    panel.style.maxHeight = 'calc(100vh - 48px)'
    panel.style.display = 'flex'
    panel.style.flexDirection = 'column'
    panel.style.overflow = 'hidden'
    panel.style.padding = '18px'
  }, [])

  useEffect(() => {
    if (!Array.isArray(bomNodes) || bomNodes.length === 0) {
      setExpandedNodeIds(new Set())
      return
    }
    const nextExpandedNodeIds = new Set<string>()
    collectExpandableNodeIds(bomNodes, nextExpandedNodeIds)
    setExpandedNodeIds(nextExpandedNodeIds)
  }, [bomNodes])

  const combinedExtensions = useMemo(() => {
    return Array.from(new Set([...rules.selectedExtensions, ...rules.customExtensions]))
  }, [rules.customExtensions, rules.selectedExtensions])

  const commitCustomExtensionInput = (): void => {
    const normalized = splitExtensions(rules.customExtensionInput).map((token) => normalizeCustomExtensionToken(token)).filter(Boolean)
    if (normalized.length === 0) {
      setRules((current) => ({ ...current, customExtensionInput: '' }))
      return
    }
    setRules((current) => ({
      ...current,
      customExtensions: Array.from(new Set([...current.customExtensions, ...normalized])),
      customExtensionInput: ''
    }))
  }

  const removeCustomExtension = (extension: string): void => {
    setRules((current) => ({
      ...current,
      customExtensions: current.customExtensions.filter((entry) => entry !== extension)
    }))
  }

  const previewRows = useMemo(() => {
    if (!Array.isArray(bomNodes) || bomNodes.length === 0) return [] as BomCloneStructureRow[]
    return flattenNodesForDisplay(bomNodes, expandedNodeIds, null)
  }, [bomNodes, expandedNodeIds])

  const toggleNode = (nodeId: string): void => {
    setExpandedNodeIds((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const startDownloadTitle = bomLoading
    ? 'Please wait for the Bill of Materials to finish loading.'
    : 'Download execution will prompt for a save location when it is wired.'

  return (
    <div ref={hostRef} className="plm-extension-bom-attachment-download-shell">
      <div className="plm-extension-bom-attachment-download-header">
        <h2 className="plm-extension-bom-attachment-download-title">Advanced Download Attachments</h2>
        <p className="plm-extension-bom-attachment-download-description">
          Configure attachment download rules for the current BOM before wiring the execution flow.
        </p>
      </div>

      <div className="plm-extension-bom-attachment-download-layout">
        <div className="plm-extension-bom-attachment-download-config">
          <section className="plm-extension-bom-attachment-download-section">
            <div className="plm-extension-bom-attachment-download-section-header">
              <h3 className="plm-extension-bom-attachment-download-section-title">Filter Search</h3>
              <span
                className="plm-extension-bom-attachment-download-section-info zmdi zmdi-help-outline"
                aria-hidden="true"
                title="Filter attachments by filename using partial text."
              />
            </div>
            <label className="plm-extension-bom-attachment-download-field plm-extension-bom-attachment-download-field--search">
              <input
                className="plm-extension-bom-attachment-download-input"
                type="text"
                value={rules.fileNameSearchText}
                placeholder="Search Filter By File Name"
                onChange={(event) => setRules((current) => ({ ...current, fileNameSearchText: event.target.value }))}
              />
              <span className="plm-extension-bom-attachment-download-help">
                Narrow results using fuzzy or contains-style filename matching. Supports wildcard characters such as `*`.
              </span>
            </label>
          </section>

          <section className="plm-extension-bom-attachment-download-section">
            <div className="plm-extension-bom-attachment-download-section-header">
              <h3 className="plm-extension-bom-attachment-download-section-title">Extensions</h3>
              <span
                className="plm-extension-bom-attachment-download-section-info zmdi zmdi-help-outline"
                aria-hidden="true"
                title="Choose standard file groups and add any custom extensions separated by commas."
              />
            </div>
            <div className="plm-extension-bom-attachment-download-field plm-extension-bom-attachment-download-field--extensions">
              <div className="plm-extension-bom-attachment-download-extension-row">
                <div className="plm-extension-bom-attachment-download-extension-groups">
                  {EXTENSION_GROUPS.map((group) => (
                    <label key={group.id} className="plm-extension-bom-attachment-download-extension-card">
                      <input
                        type="checkbox"
                        checked={areGroupExtensionsSelected(rules.selectedExtensions, group.extensions)}
                        onChange={(event) =>
                          setRules((current) => ({
                            ...current,
                            selectedExtensions: toggleExtensionGroup(current.selectedExtensions, group.extensions, event.target.checked)
                          }))}
                      />
                      <span>{group.label}</span>
                    </label>
                  ))}
                </div>
                <div className="plm-extension-bom-attachment-download-extension-pillbox">
                  {rules.customExtensions.map((extension) => (
                    <span key={extension} className="plm-extension-bom-attachment-download-extension-pill">
                      <span>{extension}</span>
                      <button
                        type="button"
                        className="plm-extension-bom-attachment-download-extension-pill-remove"
                        aria-label={`Remove ${extension}`}
                        onClick={() => removeCustomExtension(extension)}
                      >
                        <span className="zmdi zmdi-close" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  <input
                    className="plm-extension-bom-attachment-download-extension-pill-input"
                    type="text"
                    value={rules.customExtensionInput}
                    placeholder={rules.customExtensions.length === 0 ? '.zip, .csv' : 'Add extension'}
                    onChange={(event) => setRules((current) => ({ ...current, customExtensionInput: event.target.value }))}
                    onBlur={commitCustomExtensionInput}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ',' || event.key === 'Tab') {
                        event.preventDefault()
                        commitCustomExtensionInput()
                      }
                      if (event.key === 'Backspace' && !rules.customExtensionInput && rules.customExtensions.length > 0) {
                        event.preventDefault()
                        removeCustomExtension(rules.customExtensions[rules.customExtensions.length - 1])
                      }
                    }}
                    />
                  </div>
                </div>
            </div>
          </section>

          <section className="plm-extension-bom-attachment-download-section">
            <div className="plm-extension-bom-attachment-download-section-header">
              <h3 className="plm-extension-bom-attachment-download-section-title">Modified</h3>
              <span
                className="plm-extension-bom-attachment-download-section-info zmdi zmdi-help-outline"
                aria-hidden="true"
                title="Restrict attachments by when they were last modified."
              />
            </div>
            <div className="plm-extension-bom-attachment-download-modified-stack">
              <label className="plm-extension-bom-attachment-download-field plm-extension-bom-attachment-download-field--modified">
                <span className="plm-extension-bom-attachment-download-label">Last Modified</span>
                <select
                  className="plm-extension-bom-attachment-download-select"
                  value={rules.lastModifiedRange}
                  onChange={(event) =>
                    setRules((current) => ({
                      ...current,
                      lastModifiedRange: event.target.value as AttachmentDownloadRules['lastModifiedRange']
                    }))}
                >
                  <option value="anytime">Anytime</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="this-week">This Week</option>
                  <option value="this-month">This Month</option>
                  <option value="this-year">This Year</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="60d">Last 60 Days</option>
                  <option value="180d">Last 180 Days</option>
                  <option value="365d">Last 365 Days</option>
                  <option value="custom">Custom Range</option>
                </select>
              </label>

              {rules.lastModifiedRange === 'custom' ? (
                <div className="plm-extension-bom-attachment-download-field plm-extension-bom-attachment-download-field--modified-custom">
                  <span className="plm-extension-bom-attachment-download-label">Between</span>
                  <div className="plm-extension-bom-attachment-download-date-row">
                    <input
                      className="plm-extension-bom-attachment-download-input"
                      type="date"
                      value={rules.customModifiedFrom}
                      max={rules.customModifiedTo || undefined}
                      onChange={(event) => setRules((current) => applyCustomModifiedFrom(current, event.target.value))}
                    />
                    <input
                      className="plm-extension-bom-attachment-download-input"
                      type="date"
                      value={rules.customModifiedTo}
                      min={rules.customModifiedFrom || undefined}
                      onChange={(event) => setRules((current) => applyCustomModifiedTo(current, event.target.value))}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="plm-extension-bom-attachment-download-section">
            <div className="plm-extension-bom-attachment-download-section-header">
              <h3 className="plm-extension-bom-attachment-download-section-title">Download Rules</h3>
              <span
                className="plm-extension-bom-attachment-download-section-info zmdi zmdi-help-outline"
                aria-hidden="true"
                title="Define how folders are created and how downloaded files should be named."
              />
            </div>
            <div className="plm-extension-bom-attachment-download-options">
              <label className="plm-extension-bom-attachment-download-field">
                <span className="plm-extension-bom-attachment-download-label">Create Sub Folders</span>
                <select
                  className="plm-extension-bom-attachment-download-select"
                  value={rules.createSubFolders}
                  onChange={(event) =>
                    setRules((current) => ({
                      ...current,
                      createSubFolders: event.target.value as AttachmentDownloadRules['createSubFolders']
                    }))}
                >
                  <option value="per-item">Yes - Per Item</option>
                  <option value="per-top-level-item">Yes - Per Top Level Item</option>
                  <option value="matching-bom-path">Yes - Matching The BOM Path</option>
                </select>
              </label>

              <label className="plm-extension-bom-attachment-download-field">
                <span className="plm-extension-bom-attachment-download-label">Rename Files</span>
                <select
                  className="plm-extension-bom-attachment-download-select"
                  value={rules.renameFiles}
                  onChange={(event) =>
                    setRules((current) => ({
                      ...current,
                      renameFiles: event.target.value as AttachmentDownloadRules['renameFiles']
                    }))}
                >
                  <option value="filename-date">Filename Date</option>
                  <option value="date-filename">Date Filename</option>
                  <option value="filename-version">Filename Version</option>
                  <option value="filename-version-date">Filename Version Date</option>
                  <option value="filename-revision-version">Filename Revision.Version</option>
                  <option value="filename-revision-version-date">Filename Revision.Version.Date</option>
                  <option value="descriptor">Descriptor</option>
                  <option value="descriptor-date">Descriptor Date</option>
                  <option value="descriptor-version">Descriptor Version</option>
                  <option value="descriptor-version-date">Descriptor Version Date</option>
                  <option value="descriptor-revision-version">Descriptor Revision.Version</option>
                  <option value="descriptor-revision-version-date">Descriptor Revision.Version.Date</option>
                </select>
              </label>
            </div>
          </section>
        </div>

        <div className="plm-extension-bom-attachment-download-preview">
          <div className="plm-extension-bom-attachment-download-preview-header">
            <div>
              <h3 className="plm-extension-bom-attachment-download-preview-title">Bill of Materials</h3>
              <p className="plm-extension-bom-attachment-download-preview-subtitle">
                {bomLoading ? 'Loading current BOM...' : `${previewRows.length} row${previewRows.length === 1 ? '' : 's'} loaded`}
              </p>
            </div>
          </div>
          <div className="plm-extension-bom-attachment-download-preview-body">
            {bomLoading ? (
              <div className="plm-extension-bom-attachment-download-empty">
                <div className="plm-extension-bom-clone-loading-center" role="status" aria-live="polite">
                  <div className="generic-loader plm-extension-loader" aria-hidden="true">
                    <div className="bounce1" />
                    <div className="bounce2" />
                    <div className="bounce3" />
                  </div>
                  <div className="plm-extension-bom-clone-loading-text">Loading Bill of Materials</div>
                </div>
              </div>
            ) : bomError ? (
              <div className="plm-extension-bom-attachment-download-empty">{bomError}</div>
            ) : previewRows.length === 0 ? (
              <div className="plm-extension-bom-attachment-download-empty">No BOM rows were available for this item.</div>
            ) : (
              <table className="plm-extension-bom-structure-table plm-extension-table plm-extension-bom-attachment-download-preview-table">
                <colgroup>
                  <col className="plm-extension-bom-attachment-download-col-description" />
                  <col className="plm-extension-bom-attachment-download-col-files-downloaded" />
                </colgroup>
                <thead>
                  <tr>
                    <th># Description</th>
                    <th>Files Downloaded</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => {
                    const numberValue = String(index + 1)
                    const hasChildren = row.hasChildren
                    const isRootRow = bomNodes.length === 1 && row.id === bomNodes[0].id
                    return (
                      <tr key={row.id}>
                        <td className="plm-extension-bom-structure-number-descriptor-merged-cell">
                          <div className="plm-extension-bom-structure-number-descriptor-merged-wrap">
                            <span className="plm-extension-bom-structure-number" style={{ paddingLeft: `${row.level * 18}px` }}>
                              {hasChildren ? (
                                <button
                                  type="button"
                                  className="plm-extension-bom-structure-chevron"
                                  aria-label={row.expanded ? 'Collapse BOM row' : 'Expand BOM row'}
                                  aria-expanded={row.expanded}
                                  onClick={() => toggleNode(row.id)}
                                >
                                  <span className={`zmdi ${row.expanded ? 'zmdi-chevron-down' : 'zmdi-chevron-right'}`} aria-hidden="true" />
                                </button>
                              ) : (
                                <span className="plm-extension-bom-structure-chevron-spacer" aria-hidden="true" />
                              )}
                              {isRootRow ? (
                                <span className="plm-extension-bom-structure-root-icon-box">
                                  <span className="zmdi zmdi-layers plm-extension-bom-structure-root-assembly-icon" aria-hidden="true" />
                                </span>
                              ) : hasChildren ? (
                                <span className="plm-extension-bom-structure-assembly-icon-box"><CubeGlyph assembly /></span>
                              ) : (
                                <span className="plm-extension-bom-structure-part-icon-box"><CubeGlyph /></span>
                              )}
                              <span className="plm-extension-bom-structure-number-value">{numberValue || '-'}</span>
                            </span>
                            <span className="plm-extension-bom-structure-descriptor-scroll">
                              {row.node.label || 'Untitled BOM row'}
                            </span>
                          </div>
                        </td>
                        <td className="plm-extension-bom-attachment-download-files-cell">-</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="plm-extension-bom-attachment-download-footer">
        <div className="plm-extension-bom-attachment-download-actions">
          <button
            type="button"
            className="plm-extension-bom-attachment-download-btn plm-extension-bom-attachment-download-btn--secondary"
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className="plm-extension-bom-attachment-download-btn plm-extension-bom-attachment-download-btn--primary"
            disabled
            title={startDownloadTitle}
          >
            {bomLoading ? 'Loading BOM...' : 'Download'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function createAttachmentDownloadView(): AttachmentDownloadView {
  const roots = new WeakMap<Element, Root>()

  return {
    render(modalRoot, handlers) {
      const panel = modalRoot.querySelector('div')
      if (!panel) return
      let root = roots.get(panel)
      if (!root) {
        root = createRoot(panel)
        roots.set(panel, root)
      }
      root.render(<AttachmentDownloadModal {...handlers} />)
    },
    unmount(modalRoot) {
      const panel = modalRoot.querySelector('div')
      if (!panel) return
      const root = roots.get(panel)
      root?.unmount()
      roots.delete(panel)
    }
  }
}
