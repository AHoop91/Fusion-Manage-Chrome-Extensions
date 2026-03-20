import React, { useEffect, useMemo, useRef, useState } from 'react'
import { collectExpandableNodeIds, flattenNodesForDisplay } from '../../clone/services/structure/tree.service'
import {
  buildAttachmentDownloadRowRequests,
  buildAttachmentDownloadSummary,
  buildAttachmentExtensionSummary,
  filterResolvedAttachmentDownloadRows,
  formatExtensionDisplayLabel,
  parseAttachmentNames
} from '../services/attachments.service'
import {
  EXTENSION_GROUPS,
  applyCustomModifiedFrom,
  applyCustomModifiedTo,
  areGroupExtensionsSelected,
  createDefaultAttachmentDownloadRules,
  isValidCustomExtensionToken,
  normalizeCustomExtensionToken,
  splitExtensions,
  toggleExtensionGroup,
  type AttachmentDownloadRules
} from '../services/rules.service'
import type { AttachmentDownloadHandlers } from './types'
import type {
  AttachmentDownloadController,
  AttachmentDownloadProgress,
  AttachmentDownloadRowResult,
  AttachmentDownloadRunResult
} from '../types'
import { createAttachmentDownloadController, downloadAttachmentFiles } from '../services/download.service'
import { fetchAttachmentDownloadRows } from '../services/manifest.service'

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let unitIndex = 0
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }
  const rounded = size >= 100 || unitIndex === 0 ? Math.round(size) : Math.round(size * 10) / 10
  return `${rounded} ${units[unitIndex]}`
}

function getDownloadProgressPercent(progress: AttachmentDownloadProgress | null): number {
  if (!progress || progress.totalFiles <= 0) return 0
  const processedFiles = progress.completedFiles + progress.failedFiles
  return Math.max(0, Math.min(100, Math.round((processedFiles / progress.totalFiles) * 100)))
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

function PaperclipGlyph(): React.JSX.Element {
  return (
    <span className="plm-extension-bom-attachment-download-paperclip zmdi zmdi-attachment" aria-hidden="true" />
  )
}

export function AttachmentDownloadModal(props: AttachmentDownloadHandlers): React.JSX.Element {
  const { onClose, bomNodes, bomLoading, bomError, attachmentPreviewConfig } = props
  const hostRef = useRef<HTMLDivElement | null>(null)
  const downloadControllerRef = useRef<AttachmentDownloadController | null>(null)
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set())
  const [rules, setRules] = useState<AttachmentDownloadRules>(() => createDefaultAttachmentDownloadRules())
  const [resolvedRowResults, setResolvedRowResults] = useState<AttachmentDownloadRowResult[]>([])
  const [resolvingAttachments, setResolvingAttachments] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [hasResolvedAttachments, setHasResolvedAttachments] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<AttachmentDownloadProgress | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadResult, setDownloadResult] = useState<AttachmentDownloadRunResult | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDownloadPaused, setIsDownloadPaused] = useState(false)

  useEffect(() => {
    const panel = hostRef.current?.parentElement
    if (!(panel instanceof HTMLDivElement)) return
    panel.style.width = 'min(1380px, 98vw)'
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

  const invalidCustomExtensions = useMemo(() => {
    return splitExtensions(rules.customExtensionInput).filter((token) => !isValidCustomExtensionToken(token))
  }, [rules.customExtensionInput])

  const hasInvalidCustomExtensionInput = invalidCustomExtensions.length > 0

  const commitCustomExtensionInput = (): void => {
    if (hasInvalidCustomExtensionInput) return

    const normalized = splitExtensions(rules.customExtensionInput)
      .map((token) => normalizeCustomExtensionToken(token))
      .filter(Boolean)

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
    if (!Array.isArray(bomNodes) || bomNodes.length === 0) return []
    return flattenNodesForDisplay(bomNodes, expandedNodeIds, null)
  }, [bomNodes, expandedNodeIds])

  const attachmentExtensionSummary = useMemo(() => {
    return buildAttachmentExtensionSummary(previewRows, attachmentPreviewConfig.attachmentFieldViewDefId)
  }, [attachmentPreviewConfig.attachmentFieldViewDefId, previewRows])

  const attachmentDownloadSummary = useMemo(() => {
    return buildAttachmentDownloadSummary({
      previewRows,
      attachmentFieldViewDefId: attachmentPreviewConfig.attachmentFieldViewDefId,
      selectedExtensions: combinedExtensions,
      fileNameSearchText: rules.fileNameSearchText,
      normalizeExtension: normalizeCustomExtensionToken
    })
  }, [
    attachmentPreviewConfig.attachmentFieldViewDefId,
    combinedExtensions,
    previewRows,
    rules.fileNameSearchText
  ])

  const attachmentRowRequests = useMemo(() => {
    return buildAttachmentDownloadRowRequests({
      previewRows,
      attachmentFieldViewDefId: attachmentPreviewConfig.attachmentFieldViewDefId,
      selectedExtensions: combinedExtensions,
      fileNameSearchText: rules.fileNameSearchText,
      normalizeExtension: normalizeCustomExtensionToken
    })
  }, [
    attachmentPreviewConfig.attachmentFieldViewDefId,
    combinedExtensions,
    previewRows,
    rules.fileNameSearchText
  ])

  useEffect(() => {
    setResolvedRowResults([])
    setResolvingAttachments(false)
    setResolveError(null)
    setHasResolvedAttachments(false)
    setDownloadProgress(null)
    setDownloadError(null)
    setDownloadResult(null)
    setIsDownloading(false)
    setIsDownloadPaused(false)
    downloadControllerRef.current = null
  }, [
    attachmentPreviewConfig.attachmentFieldViewDefId,
    attachmentRowRequests,
    rules.customModifiedFrom,
    rules.customModifiedTo,
    rules.lastModifiedRange
  ])

  const filteredResolvedRowResults = useMemo(() => {
    return filterResolvedAttachmentDownloadRows({
      rowResults: resolvedRowResults,
      selectedExtensions: combinedExtensions,
      fileNameSearchText: rules.fileNameSearchText,
      normalizeExtension: normalizeCustomExtensionToken,
      lastModifiedRange: rules.lastModifiedRange,
      customModifiedFrom: rules.customModifiedFrom,
      customModifiedTo: rules.customModifiedTo
    })
  }, [
    combinedExtensions,
    resolvedRowResults,
    rules.customModifiedFrom,
    rules.customModifiedTo,
    rules.fileNameSearchText,
    rules.lastModifiedRange
  ])

  const resolvedRowById = useMemo(() => {
    return new Map(filteredResolvedRowResults.map((row) => [row.rowId, row]))
  }, [filteredResolvedRowResults])

  const rawResolvedRowById = useMemo(() => {
    return new Map(resolvedRowResults.map((row) => [row.rowId, row]))
  }, [resolvedRowResults])

  const requestedRowIds = useMemo(() => {
    return new Set(attachmentRowRequests.map((row) => row.rowId))
  }, [attachmentRowRequests])

  const resolvedAttachmentSummary = useMemo(() => {
    const matchedCount = filteredResolvedRowResults.reduce((sum, row) => sum + row.attachments.length, 0)
    const totalCount = resolvedRowResults.reduce((sum, row) => sum + row.attachments.length, 0)
    const failedRowCount = resolvedRowResults.filter((row) => Boolean(row.error)).length
    const resolvedRowCount = resolvedRowResults.length - failedRowCount
    return {
      matchedCount,
      totalCount,
      failedRowCount,
      resolvedRowCount
    }
  }, [filteredResolvedRowResults, resolvedRowResults])

  const downloadableRowResults = useMemo(() => {
    return filteredResolvedRowResults.filter((row) => row.attachments.length > 0)
  }, [filteredResolvedRowResults])

  const downloadableFileCount = useMemo(() => {
    return downloadableRowResults.reduce((sum, row) => sum + row.attachments.length, 0)
  }, [downloadableRowResults])

  const downloadProgressPercent = useMemo(() => {
    return getDownloadProgressPercent(downloadProgress)
  }, [downloadProgress])

  const toggleNode = (nodeId: string): void => {
    setExpandedNodeIds((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  const downloadFilesTitle = bomLoading
    ? 'Please wait for the Bill of Materials to finish loading.'
    : resolvingAttachments
      ? 'Resolving attachment metadata before starting the download.'
      : !hasResolvedAttachments && attachmentRowRequests.length === 0
        ? 'No BOM rows currently match the attachment filters.'
        : hasResolvedAttachments && downloadableFileCount === 0
          ? 'No files currently match the active filters.'
          : isDownloading
            ? isDownloadPaused
              ? 'Downloads are paused. Resume them to continue.'
              : 'Files are currently downloading.'
            : 'Choose a folder and stream the matching AWS attachment URLs into it.'

  async function resolveAttachmentManifest(): Promise<AttachmentDownloadRowResult[]> {
    if (attachmentRowRequests.length === 0) {
      setResolvedRowResults([])
      setHasResolvedAttachments(true)
      return []
    }

    setResolvingAttachments(true)
    setResolveError(null)
    setHasResolvedAttachments(false)
    setDownloadProgress(null)
    setDownloadError(null)
    setDownloadResult(null)

    try {
      const results = await fetchAttachmentDownloadRows(attachmentRowRequests)
      setResolvedRowResults(Array.isArray(results) ? results : [])
      setHasResolvedAttachments(true)
      return Array.isArray(results) ? results : []
    } catch (error) {
      setResolvedRowResults([])
      setResolveError(`Failed to resolve attachment downloads. ${error instanceof Error ? error.message : String(error)}`)
      setHasResolvedAttachments(false)
      throw error
    } finally {
      setResolvingAttachments(false)
    }
  }

  async function handleDownloadFiles(): Promise<void> {
    if (bomLoading || resolvingAttachments || isDownloading) return

    let rowsToDownload = downloadableRowResults

    if (!hasResolvedAttachments) {
      try {
        const resolvedResults = await resolveAttachmentManifest()
        rowsToDownload = filterResolvedAttachmentDownloadRows({
          rowResults: resolvedResults,
          selectedExtensions: combinedExtensions,
          fileNameSearchText: rules.fileNameSearchText,
          normalizeExtension: normalizeCustomExtensionToken,
          lastModifiedRange: rules.lastModifiedRange,
          customModifiedFrom: rules.customModifiedFrom,
          customModifiedTo: rules.customModifiedTo
        }).filter((row) => row.attachments.length > 0)
      } catch {
        return
      }
    }

    if (rowsToDownload.length === 0) {
      setDownloadError('No matching attachment files are ready to download.')
      return
    }

    const pickerWindow = window as DirectoryPickerWindow
    if (typeof pickerWindow.showDirectoryPicker !== 'function') {
      setDownloadError('Folder downloads are not supported in this browser context.')
      return
    }

    try {
      const directoryHandle = await pickerWindow.showDirectoryPicker({ mode: 'readwrite' })
      const controller = createAttachmentDownloadController()
      downloadControllerRef.current = controller
      setIsDownloading(true)
      setIsDownloadPaused(false)
      setDownloadError(null)
      setDownloadResult(null)
      setDownloadProgress(null)

      const result = await downloadAttachmentFiles({
        directoryHandle,
        rows: rowsToDownload,
        rules,
        rowConcurrency: 6,
        fileConcurrencyPerRow: 3,
        controller,
        onProgress: (progress) => {
          setDownloadProgress(progress)
        }
      })

      setDownloadProgress(result)
      setDownloadResult(result)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setDownloadProgress(null)
        return
      }

      setDownloadError(`Failed to download attachments. ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsDownloading(false)
      setIsDownloadPaused(false)
      downloadControllerRef.current = null
    }
  }

  function handleTogglePause(): void {
    const controller = downloadControllerRef.current
    if (!controller || !isDownloading) return

    if (controller.isPaused()) {
      controller.resume()
      setIsDownloadPaused(false)
      return
    }

    controller.pause()
    setIsDownloadPaused(true)
  }

  return (
    <div ref={hostRef} className="plm-extension-bom-attachment-download-shell">
      <div className="plm-extension-bom-attachment-download-header">
        <h2 className="plm-extension-bom-attachment-download-title">Advanced Download Attachments</h2>
        <p className="plm-extension-bom-attachment-download-description">
          Resolve the matching attachment manifest, then stream the signed AWS file URLs into a folder with parallel downloads and live progress.
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
                            selectedExtensions: toggleExtensionGroup(
                              current.selectedExtensions,
                              group.extensions,
                              event.target.checked
                            )
                          }))}
                      />
                      <span>{group.label}</span>
                      <span
                        className="plm-extension-bom-attachment-download-extension-card-info zmdi zmdi-help-outline"
                        aria-hidden="true"
                        title={group.tooltip}
                      />
                    </label>
                  ))}
                </div>
                <div
                  className={`plm-extension-bom-attachment-download-extension-input-wrap${
                    hasInvalidCustomExtensionInput ? ' is-invalid' : ''
                  }`}
                >
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
              {rules.customExtensions.length > 0 ? (
                <div className="plm-extension-bom-attachment-download-custom-extension-list">
                  {rules.customExtensions.map((extension) => (
                    <span key={extension} className="plm-extension-bom-attachment-download-custom-extension-chip">
                      <span>{formatExtensionDisplayLabel(extension)}</span>
                      <button
                        type="button"
                        className="plm-extension-bom-attachment-download-custom-extension-chip-remove"
                        aria-label={`Remove ${extension}`}
                        onClick={() => removeCustomExtension(extension)}
                      >
                        <span className="zmdi zmdi-close" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              {hasInvalidCustomExtensionInput ? (
                <span className="plm-extension-bom-attachment-download-help plm-extension-bom-attachment-download-help--error">
                  Invalid extension. Use a single extension like `.zip` and separate entries with commas.
                </span>
              ) : null}
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
                  <option value="none">No</option>
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
                {attachmentExtensionSummary.length > 0 ? (
                  <div className="plm-extension-bom-attachment-download-extension-summary">
                    <div className="plm-extension-bom-attachment-download-section-header plm-extension-bom-attachment-download-section-header--summary">
                      <span className="plm-extension-bom-attachment-download-label">Extensions Found</span>
                      <span
                        className="plm-extension-bom-attachment-download-section-info zmdi zmdi-help-outline"
                        aria-hidden="true"
                        title="Summary of attachment file extensions discovered in the current BOM preview."
                      />
                    </div>
                    <div className="plm-extension-bom-attachment-download-extension-summary-list">
                      {attachmentExtensionSummary.map((entry) => (
                        <span key={entry.extension} className="plm-extension-bom-attachment-download-extension-summary-pill">
                          <span>{entry.extension}</span>
                          <strong>{entry.count}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {!bomLoading && !attachmentPreviewConfig.warningMessage && !hasResolvedAttachments ? (
                  <div className="plm-extension-bom-attachment-download-download-summary">
                    <strong>
                      {attachmentDownloadSummary.matchedCount} Files Will Be Downloaded out of {attachmentDownloadSummary.totalCount}
                    </strong>
                    <span className="plm-extension-bom-attachment-download-help">
                      Preview count is based on the current filename search and selected extensions.
                    </span>
                  </div>
                ) : null}
                {!bomLoading && hasResolvedAttachments ? (
                  <div className="plm-extension-bom-attachment-download-download-summary">
                    <strong>
                      {resolvedAttachmentSummary.matchedCount} Matching Files Prepared out of {resolvedAttachmentSummary.totalCount}
                    </strong>
                    <span className="plm-extension-bom-attachment-download-help">
                      Attachment metadata now comes from `/attachments`; you can now download the matching AWS file URLs directly.
                    </span>
                    {resolvedAttachmentSummary.failedRowCount > 0 ? (
                      <span className="plm-extension-bom-attachment-download-help plm-extension-bom-attachment-download-help--error">
                        {resolvedAttachmentSummary.failedRowCount} BOM row{resolvedAttachmentSummary.failedRowCount === 1 ? '' : 's'} failed while resolving attachment metadata.
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {!bomLoading && attachmentPreviewConfig.warningMessage ? (
                  <div className="plm-extension-bom-attachment-download-warning plm-extension-bom-attachment-download-warning--summary">
                    <span
                      className="plm-extension-bom-attachment-download-warning-icon zmdi zmdi-alert-triangle"
                      aria-hidden="true"
                    />
                    {attachmentPreviewConfig.warningMessage}
                  </div>
                ) : null}
                {!bomLoading && resolveError ? (
                  <div className="plm-extension-bom-attachment-download-warning plm-extension-bom-attachment-download-warning--summary">
                    <span
                      className="plm-extension-bom-attachment-download-warning-icon zmdi zmdi-alert-triangle"
                      aria-hidden="true"
                    />
                    {resolveError}
                  </div>
                ) : null}
                {!bomLoading && downloadError ? (
                  <div className="plm-extension-bom-attachment-download-warning plm-extension-bom-attachment-download-warning--summary">
                    <span
                      className="plm-extension-bom-attachment-download-warning-icon zmdi zmdi-alert-triangle"
                      aria-hidden="true"
                    />
                    {downloadError}
                  </div>
                ) : null}
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
                  <col className="plm-extension-bom-attachment-download-col-attachments" />
                  <col className="plm-extension-bom-attachment-download-col-files-downloaded" />
                </colgroup>
                <thead>
                  <tr>
                    <th># Description</th>
                    <th className="plm-extension-bom-attachment-download-column-header--center">Attachments</th>
                    <th className="plm-extension-bom-attachment-download-column-header--center">Files Matched</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => {
                    const numberValue = String(index + 1)
                    const hasChildren = row.hasChildren
                    const isRootRow = bomNodes.length === 1 && row.id === bomNodes[0].id
                    const attachmentCountValue = attachmentPreviewConfig.attachmentFieldViewDefId
                      ? String(row.node.bomFieldValues?.[attachmentPreviewConfig.attachmentFieldViewDefId] || '').trim()
                      : ''
                    const attachmentNames = attachmentPreviewConfig.attachmentFieldViewDefId
                      ? parseAttachmentNames(row.node.bomFieldContents?.[attachmentPreviewConfig.attachmentFieldViewDefId])
                      : []
                    const attachmentTooltip = attachmentNames.length > 0 ? attachmentNames.join('\n') : undefined
                    const resolvedRow = resolvedRowById.get(row.id) || null
                    const rawResolvedRow = rawResolvedRowById.get(row.id) || null
                    const matchedFileCountLabel = resolvingAttachments && requestedRowIds.has(row.id)
                      ? '...'
                      : rawResolvedRow?.error
                        ? 'ERR'
                        : resolvedRow
                          ? String(resolvedRow.attachments.length)
                          : hasResolvedAttachments && requestedRowIds.has(row.id)
                            ? '0'
                            : '-'
                    const matchedFileTitle = rawResolvedRow?.error || undefined

                    return (
                      <tr key={row.id}>
                        <td className="plm-extension-bom-structure-number-descriptor-merged-cell">
                          <div className="plm-extension-bom-structure-number-descriptor-merged-wrap">
                            <span className="plm-extension-bom-structure-number" style={{ paddingLeft: `${row.level * 34}px` }}>
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
                        <td className="plm-extension-bom-attachment-download-attachments-cell" title={attachmentTooltip}>
                          {attachmentPreviewConfig.enabled && attachmentCountValue ? (
                            <span className="plm-extension-bom-attachment-download-attachment-pill">
                              <PaperclipGlyph />
                              <span className="plm-extension-bom-attachment-download-attachment-count">{attachmentCountValue}</span>
                            </span>
                          ) : (
                            <span className="plm-extension-bom-attachment-download-attachment-empty">-</span>
                          )}
                        </td>
                        <td className="plm-extension-bom-attachment-download-files-cell" title={matchedFileTitle}>
                          {matchedFileCountLabel}
                        </td>
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
        {downloadProgress ? (
          <div className="plm-extension-bom-attachment-download-progress-panel plm-extension-bom-attachment-download-progress-panel--footer">
            <div className="plm-extension-bom-attachment-download-progress-header">
              <strong>
                {isDownloading ? (isDownloadPaused ? 'Download Paused' : 'Downloading Files') : downloadResult ? 'Download Complete' : 'Download Progress'}
              </strong>
              <span>{`${downloadProgress.completedFiles + downloadProgress.failedFiles} of ${downloadProgress.totalFiles} files (${downloadProgressPercent}%)`}</span>
            </div>
            <div className="plm-extension-bom-attachment-download-progress-track">
              <span
                className="plm-extension-bom-attachment-download-progress-fill"
                style={{ width: `${downloadProgressPercent}%` }}
              />
            </div>
            <div className="plm-extension-bom-attachment-download-progress-meta">
              <span>{`${downloadProgress.completedFiles} complete, ${downloadProgress.failedFiles} failed, ${downloadProgress.activeFiles} active`}</span>
              {isDownloading && isDownloadPaused ? (
                <span>Workers are paused</span>
              ) : null}
              {downloadProgress.totalBytes > 0 ? (
                <span>{`${formatBytes(downloadProgress.transferredBytes)} of ${formatBytes(downloadProgress.totalBytes)}`}</span>
              ) : null}
              {downloadResult ? (
                <span>{`Saved into ${downloadResult.directoryName}`}</span>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="plm-extension-bom-attachment-download-actions">
          <button
            type="button"
            className="plm-extension-bom-attachment-download-btn plm-extension-bom-attachment-download-btn--secondary"
            disabled={isDownloading}
            onClick={onClose}
          >
            Close
          </button>
          <button
            type="button"
            className={`plm-extension-bom-attachment-download-btn ${
              isDownloading
                ? 'plm-extension-bom-attachment-download-btn--secondary'
                : 'plm-extension-bom-attachment-download-btn--primary'
            }`}
            disabled={
              bomLoading
              || resolvingAttachments
              || (!isDownloading && attachmentRowRequests.length === 0)
            }
            title={downloadFilesTitle}
            onClick={() => {
              if (isDownloading) {
                handleTogglePause()
                return
              }
              void handleDownloadFiles()
            }}
          >
            {bomLoading
              ? 'Loading BOM...'
              : resolvingAttachments
                ? 'Resolving...'
                : isDownloading
                  ? (isDownloadPaused ? 'Resume' : 'Pause')
                  : 'Download Files'}
          </button>
        </div>
      </div>
    </div>
  )
}
