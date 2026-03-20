import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
import { createAttachmentDownloadController, resolveAndDownloadAttachmentFiles } from '../services/download.service'
import { fetchAttachmentDownloadRow } from '../services/manifest.service'

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

function getDownloadProgressPercent(progress: AttachmentDownloadProgress | null, totalFilesOverride?: number): number {
  const totalFiles = typeof totalFilesOverride === 'number' && Number.isFinite(totalFilesOverride)
    ? totalFilesOverride
    : progress?.totalFiles || 0
  if (!progress || totalFiles <= 0) return 0
  const processedFiles = progress.completedFiles + progress.failedFiles
  return Math.max(0, Math.min(100, Math.round((processedFiles / totalFiles) * 100)))
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

function WarningGlyph(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width="44"
      height="44"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', width: '44px', height: '44px', margin: '0 auto 6px' }}
    >
      <path
        d="M12 3L21 20H3L12 3Z"
        fill="#f59e0b"
        stroke="#d97706"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M12 8V13.25" stroke="#ffffff" strokeWidth="2.3" strokeLinecap="round" />
      <circle cx="12" cy="16.6" r="1.25" fill="#ffffff" />
    </svg>
  )
}

function pathRiskOverlayStyle(): React.CSSProperties {
  return {
    position: 'fixed',
    inset: 0,
    zIndex: 2147483647,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'rgba(15, 23, 42, 0.32)'
  }
}

function pathRiskDialogStyle(): React.CSSProperties {
  return {
    width: 'min(620px, 92vw)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    padding: '26px 28px 22px',
    border: '1px solid #dde6ef',
    borderRadius: '16px',
    background: '#ffffff',
    boxShadow: '0 24px 48px rgba(15, 23, 42, 0.20)'
  }
}

function pathRiskButtonStyle(variant: 'primary' | 'secondary'): React.CSSProperties {
  if (variant === 'primary') {
    return {
      minHeight: '38px',
      padding: '0 16px',
      borderRadius: '8px',
      border: '1px solid #149cd8',
      background: '#149cd8',
      color: '#ffffff',
      font: '600 12px/1 var(--plm-bom-font-sans)',
      cursor: 'pointer'
    }
  }

  return {
    minHeight: '38px',
    padding: '0 16px',
    borderRadius: '8px',
    border: '1px solid #ccd7e2',
    background: '#ffffff',
    color: '#203246',
    font: '600 12px/1 var(--plm-bom-font-sans)',
    cursor: 'pointer'
  }
}

export function AttachmentDownloadModal(props: AttachmentDownloadHandlers): React.JSX.Element {
  const { onClose, bomNodes, bomLoading, bomError, attachmentPreviewConfig } = props
  const hostRef = useRef<HTMLDivElement | null>(null)
  const downloadControllerRef = useRef<AttachmentDownloadController | null>(null)
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(() => new Set())
  const [rules, setRules] = useState<AttachmentDownloadRules>(() => createDefaultAttachmentDownloadRules())
  const [resolvedRowResults, setResolvedRowResults] = useState<AttachmentDownloadRowResult[]>([])
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [hasResolvedAttachments, setHasResolvedAttachments] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<AttachmentDownloadProgress | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [downloadResult, setDownloadResult] = useState<AttachmentDownloadRunResult | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDownloadPaused, setIsDownloadPaused] = useState(false)
  const [isCancellingDownload, setIsCancellingDownload] = useState(false)
  const [showMatchedItemsOnly, setShowMatchedItemsOnly] = useState(false)
  const [showPathLengthRiskDialog, setShowPathLengthRiskDialog] = useState(false)

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
    if (rules.includeAllFiles) return []
    return Array.from(new Set([...rules.selectedExtensions, ...rules.customExtensions]))
  }, [rules.customExtensions, rules.includeAllFiles, rules.selectedExtensions])

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
    setResolveError(null)
    setHasResolvedAttachments(false)
    setDownloadProgress(null)
    setDownloadError(null)
    setDownloadResult(null)
    setIsDownloading(false)
    setIsDownloadPaused(false)
    setIsCancellingDownload(false)
    setShowMatchedItemsOnly(false)
    setShowPathLengthRiskDialog(false)
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

  const displayedProgressTotalFiles = useMemo(() => {
    if (downloadResult) return downloadResult.totalFiles
    if (downloadProgress) {
      return Math.max(downloadProgress.totalFiles, attachmentDownloadSummary.matchedCount)
    }
    return attachmentDownloadSummary.matchedCount
  }, [attachmentDownloadSummary.matchedCount, downloadProgress, downloadResult])

  const downloadProgressPercent = useMemo(() => {
    return getDownloadProgressPercent(downloadProgress, displayedProgressTotalFiles)
  }, [displayedProgressTotalFiles, downloadProgress])

  const downloadRowStatuses = useMemo(() => {
    return downloadProgress?.rowStatuses || {}
  }, [downloadProgress])

  const displayedPreviewRows = useMemo(() => {
    if (!showMatchedItemsOnly || !downloadResult) return previewRows

    const visibleRowIds = new Set<string>()
    const ancestorStack: string[] = []

    for (const row of previewRows) {
      while (ancestorStack.length > row.level) {
        ancestorStack.pop()
      }

      const resolvedRow = resolvedRowById.get(row.id) || null
      const hasMatchedFiles = Boolean(resolvedRow && resolvedRow.attachments.length > 0)

      if (hasMatchedFiles) {
        for (const ancestorId of ancestorStack) {
          visibleRowIds.add(ancestorId)
        }
        visibleRowIds.add(row.id)
      }

      ancestorStack[row.level] = row.id
      ancestorStack.length = row.level + 1
    }

    return previewRows.filter((row) => visibleRowIds.has(row.id))
  }, [downloadResult, previewRows, resolvedRowById, showMatchedItemsOnly])

  const previewSubtitle = useMemo(() => {
    if (bomLoading) return 'Loading current BOM...'
    if (showMatchedItemsOnly && downloadResult) {
      return `${displayedPreviewRows.length} matched row${displayedPreviewRows.length === 1 ? '' : 's'} shown of ${previewRows.length}`
    }
    return `${previewRows.length} row${previewRows.length === 1 ? '' : 's'} loaded`
  }, [bomLoading, displayedPreviewRows.length, downloadResult, previewRows.length, showMatchedItemsOnly])

  const hasDeepBomHierarchy = useMemo(() => {
    return previewRows.some((row) => row.level >= 2)
  }, [previewRows])

  const shouldWarnAboutPathLengthRisk = rules.createSubFolders === 'matching-bom-path' && hasDeepBomHierarchy
  const modalRoot = hostRef.current?.ownerDocument?.body || null

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
    : !isDownloading && attachmentRowRequests.length === 0
        ? 'No BOM rows currently match the attachment filters.'
        : hasResolvedAttachments && !isDownloading && downloadableFileCount === 0
          ? 'No files currently match the active filters.'
          : isDownloading
            ? isDownloadPaused
              ? 'Downloads are paused. Resume them to continue.'
              : isCancellingDownload
                ? 'Cancelling the current download run.'
                : 'Files are currently downloading.'
            : 'Choose a folder and start resolving and downloading matching files immediately.'

  async function startDownloadFiles(): Promise<void> {
    if (bomLoading || isDownloading) return

    if (attachmentRowRequests.length === 0) {
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
      setResolvedRowResults([])
      setResolveError(null)
      setHasResolvedAttachments(true)
      setIsDownloading(true)
      setIsDownloadPaused(false)
      setIsCancellingDownload(false)
      setDownloadError(null)
      setDownloadResult(null)
      setDownloadProgress(null)

      const result = await resolveAndDownloadAttachmentFiles({
        directoryHandle,
        rowRequests: attachmentRowRequests,
        rules,
        rowConcurrency: 6,
        fileConcurrencyPerRow: 3,
        controller,
        resolveRow: (row) => fetchAttachmentDownloadRow(row),
        filterResolvedRow: (row) => (
          filterResolvedAttachmentDownloadRows({
            rowResults: [row],
            selectedExtensions: combinedExtensions,
            fileNameSearchText: rules.fileNameSearchText,
            normalizeExtension: normalizeCustomExtensionToken,
            lastModifiedRange: rules.lastModifiedRange,
            customModifiedFrom: rules.customModifiedFrom,
            customModifiedTo: rules.customModifiedTo
          })[0] || { ...row, attachments: [] }
        ),
        onRowResolved: (row) => {
          setResolvedRowResults((current) => {
            const next = new Map(current.map((entry) => [entry.rowId, entry]))
            next.set(row.rowId, row)
            return attachmentRowRequests
              .map((request) => next.get(request.rowId))
              .filter((entry): entry is AttachmentDownloadRowResult => Boolean(entry))
          })
        },
        onProgress: (progress) => {
          setDownloadProgress(progress)
        }
      })

      if (result.totalFiles === 0) {
        setDownloadError('No matching attachment files were found after resolving the selected BOM rows.')
      }
      setDownloadProgress(result)
      setDownloadResult(result)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError' && !downloadControllerRef.current?.isCancelled()) {
        setDownloadProgress(null)
        return
      }

      if (error instanceof Error && error.name === 'AttachmentDownloadCancelledError') {
        setDownloadError('Download cancelled.')
        return
      }

      setDownloadError(`Failed to download attachments. ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsDownloading(false)
      setIsDownloadPaused(false)
      setIsCancellingDownload(false)
      downloadControllerRef.current = null
    }
  }

  function handleDownloadFiles(): void {
    if (bomLoading || isDownloading) return

    if (attachmentRowRequests.length === 0) {
      setDownloadError('No matching attachment files are ready to download.')
      return
    }

    if (shouldWarnAboutPathLengthRisk) {
      setShowPathLengthRiskDialog(true)
      return
    }

    void startDownloadFiles()
  }

  function handleTogglePause(): void {
    const controller = downloadControllerRef.current
    if (!controller || !isDownloading || isCancellingDownload) return

    if (controller.isPaused()) {
      controller.resume()
      setIsDownloadPaused(false)
      return
    }

    controller.pause()
    setIsDownloadPaused(true)
  }

  function handleCancelDownload(): void {
    const controller = downloadControllerRef.current
    if (!controller || !isDownloading || isCancellingDownload) return
    setIsCancellingDownload(true)
    setIsDownloadPaused(false)
    controller.cancel()
  }

  const pathLengthRiskDialog = showPathLengthRiskDialog ? (
    <div
      style={pathRiskOverlayStyle()}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) setShowPathLengthRiskDialog(false)
      }}
    >
      <div
        style={pathRiskDialogStyle()}
        role="alertdialog"
        aria-modal="true"
        aria-live="polite"
        aria-labelledby="plm-extension-bom-attachment-download-path-risk-title"
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            alignItems: 'center',
            textAlign: 'center',
            color: '#4b5563'
          }}
        >
          <WarningGlyph />
          <strong
            id="plm-extension-bom-attachment-download-path-risk-title"
            style={{
              display: 'block',
              fontFamily: 'var(--plm-bom-font-sans)',
              fontSize: '26px',
              lineHeight: 1.12,
              fontWeight: 700,
              color: '#142435',
              letterSpacing: '-0.018em'
            }}
          >
            Download Path Length Risk
          </strong>
          <span style={{ maxWidth: '520px', font: '500 14px/1.6 var(--plm-bom-font-sans)' }}>
            This download is set to create the full BOM folder path. On large or deeply nested assemblies, some
            files may fail to save if the generated local path becomes too long.
          </span>
          <span style={{ maxWidth: '520px', font: '500 14px/1.6 var(--plm-bom-font-sans)' }}>
            Continue if you want to accept those possible failures, or cancel and choose a shorter destination path
            or a flatter folder rule.
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '2px' }}>
          <button
            type="button"
            style={pathRiskButtonStyle('secondary')}
            onClick={() => setShowPathLengthRiskDialog(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            style={pathRiskButtonStyle('primary')}
            onClick={() => {
              setShowPathLengthRiskDialog(false)
              void startDownloadFiles()
            }}
          >
            Continue Download
          </button>
        </div>
      </div>
    </div>
  ) : null

  return (
    <>
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
                title="Narrow results using fuzzy or contains-style filename matching. Supports wildcard characters such as `*`."
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
              <label className="plm-extension-bom-attachment-download-extension-card plm-extension-bom-attachment-download-extension-card--all-files">
                <input
                  type="checkbox"
                  checked={rules.includeAllFiles}
                  onChange={(event) => setRules((current) => ({ ...current, includeAllFiles: event.target.checked }))}
                />
                <span>All Files</span>
                <span
                  className="plm-extension-bom-attachment-download-extension-card-info zmdi zmdi-help-outline"
                  aria-hidden="true"
                  title="Ignore extension filters and include every attachment type that matches the other rules."
                />
              </label>
              <div className="plm-extension-bom-attachment-download-extension-row">
                <div
                  className={`plm-extension-bom-attachment-download-extension-groups${
                    rules.includeAllFiles ? ' is-disabled' : ''
                  }`}
                >
                  {EXTENSION_GROUPS.map((group) => (
                    <label key={group.id} className="plm-extension-bom-attachment-download-extension-card">
                      <input
                        type="checkbox"
                        disabled={rules.includeAllFiles}
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
                  }${rules.includeAllFiles ? ' is-disabled' : ''}`}
                >
                  <input
                    className="plm-extension-bom-attachment-download-extension-pill-input"
                    type="text"
                    disabled={rules.includeAllFiles}
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
                        disabled={rules.includeAllFiles}
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
                <span className="plm-extension-bom-attachment-download-field-heading">
                  <span className="plm-extension-bom-attachment-download-label">Rename Files</span>
                  <span
                    className="plm-extension-bom-attachment-download-section-info zmdi zmdi-help-outline"
                    aria-hidden="true"
                    title="Descriptor uses the BOM row description as the saved filename base instead of the original attachment filename. The Descriptor variants append date, version, and revision tokens to that BOM description."
                  />
                </span>
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
                {!bomLoading && hasResolvedAttachments && resolvedAttachmentSummary.failedRowCount > 0 ? (
                  <div className="plm-extension-bom-attachment-download-download-summary">
                    <span className="plm-extension-bom-attachment-download-help plm-extension-bom-attachment-download-help--error">
                      {resolvedAttachmentSummary.failedRowCount} BOM row{resolvedAttachmentSummary.failedRowCount === 1 ? '' : 's'} failed while resolving attachment metadata.
                    </span>
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
                {previewSubtitle}
              </p>
            </div>
            {downloadResult ? (
              <label className="plm-extension-bom-attachment-download-preview-toggle">
                <input
                  type="checkbox"
                  checked={showMatchedItemsOnly}
                  onChange={(event) => setShowMatchedItemsOnly(event.target.checked)}
                />
                <span>Show Matched Items Only</span>
              </label>
            ) : null}
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
            ) : displayedPreviewRows.length === 0 ? (
              <div className="plm-extension-bom-attachment-download-empty">
                {showMatchedItemsOnly && downloadResult
                  ? 'No matched BOM rows were found for the completed download.'
                  : 'No BOM rows were available for this item.'}
              </div>
            ) : (
              <table className="plm-extension-bom-structure-table plm-extension-table plm-extension-bom-attachment-download-preview-table">
                <colgroup>
                  <col className="plm-extension-bom-attachment-download-col-description" />
                  <col className="plm-extension-bom-attachment-download-col-attachments" />
                  <col className="plm-extension-bom-attachment-download-col-files-matched" />
                  <col className="plm-extension-bom-attachment-download-col-status" />
                </colgroup>
                <thead>
                  <tr>
                    <th># Description</th>
                    <th className="plm-extension-bom-attachment-download-column-header--center">Attachments</th>
                    <th className="plm-extension-bom-attachment-download-column-header--center">Files Matched</th>
                    <th className="plm-extension-bom-attachment-download-column-header--center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedPreviewRows.map((row, index) => {
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
                    const downloadRowStatus = downloadRowStatuses[row.id] || null
                    const processedRowFiles = downloadRowStatus
                      ? downloadRowStatus.completedFiles + downloadRowStatus.failedFiles
                      : 0
                    const matchedFileCountLabel = isDownloading && requestedRowIds.has(row.id) && !rawResolvedRow
                      ? '...'
                      : rawResolvedRow?.error
                        ? 'ERR'
                        : resolvedRow
                          ? String(resolvedRow.attachments.length)
                          : hasResolvedAttachments && requestedRowIds.has(row.id)
                            ? '0'
                            : '-'
                    const matchedFileTitle = rawResolvedRow?.error || undefined

                    let statusTitle = rawResolvedRow?.error || undefined
                    let statusContent: React.JSX.Element | string = '-'

                    if (isDownloading && requestedRowIds.has(row.id) && !rawResolvedRow) {
                      statusContent = <span className="plm-extension-bom-attachment-download-status-indicator is-pending">...</span>
                      statusTitle = 'Resolving attachment metadata.'
                    } else if (rawResolvedRow?.error) {
                      statusContent = (
                        <span className="plm-extension-bom-attachment-download-status-indicator is-failed" aria-label="Failed">
                          <span className="zmdi zmdi-close" aria-hidden="true" />
                        </span>
                      )
                    } else if (downloadRowStatus) {
                      if (downloadRowStatus.activeFiles > 0 || processedRowFiles < downloadRowStatus.totalFiles) {
                        statusContent = <span className="plm-extension-bom-attachment-download-status-indicator is-pending">...</span>
                        statusTitle = 'Downloading files for this BOM row.'
                      } else if (downloadRowStatus.failedFiles > 0) {
                        statusContent = (
                          <span className="plm-extension-bom-attachment-download-status-indicator is-failed" aria-label="Failed">
                            <span className="zmdi zmdi-close" aria-hidden="true" />
                          </span>
                        )
                        statusTitle = downloadRowStatus.errorMessage
                          ? `${downloadRowStatus.failedFiles} file${downloadRowStatus.failedFiles === 1 ? '' : 's'} failed for this BOM row. ${downloadRowStatus.errorMessage}`
                          : `${downloadRowStatus.failedFiles} file${downloadRowStatus.failedFiles === 1 ? '' : 's'} failed for this BOM row.`
                      } else if (downloadRowStatus.totalFiles > 0 && downloadRowStatus.completedFiles === downloadRowStatus.totalFiles) {
                        statusContent = (
                          <span className="plm-extension-bom-attachment-download-status-indicator is-success" aria-label="Completed">
                            <span className="zmdi zmdi-check" aria-hidden="true" />
                          </span>
                        )
                        statusTitle = `${downloadRowStatus.completedFiles} file${downloadRowStatus.completedFiles === 1 ? '' : 's'} downloaded successfully.`
                      }
                    } else if (hasResolvedAttachments && requestedRowIds.has(row.id) && resolvedRow && resolvedRow.attachments.length === 0) {
                      statusTitle = 'No matching files were downloaded for this BOM row.'
                    }

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
                            <span
                              className="plm-extension-bom-structure-descriptor-scroll"
                              title={row.node.label || 'Untitled BOM row'}
                            >
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
                        <td className="plm-extension-bom-attachment-download-files-cell" title={statusTitle}>
                          {statusContent}
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
                {isDownloading
                  ? (isCancellingDownload ? 'Cancelling Download' : isDownloadPaused ? 'Download Paused' : 'Downloading Files')
                  : downloadResult ? 'Download Complete' : 'Download Progress'}
              </strong>
              <span>{`${downloadProgress.completedFiles + downloadProgress.failedFiles} of ${displayedProgressTotalFiles} files (${downloadProgressPercent}%)`}</span>
            </div>
            <div className="plm-extension-bom-attachment-download-progress-track">
              <span
                className="plm-extension-bom-attachment-download-progress-fill"
                style={{ width: `${downloadProgressPercent}%` }}
              />
            </div>
            <div className="plm-extension-bom-attachment-download-progress-meta">
              <span>{`${downloadProgress.completedFiles} complete, ${downloadProgress.failedFiles} failed`}</span>
              {isDownloading && isDownloadPaused ? (
                <span>Workers are paused</span>
              ) : null}
              {isDownloading && isCancellingDownload ? (
                <span>Cancelling current download</span>
              ) : null}
              {downloadProgress.transferredBytes > 0 ? (
                <span>{`${formatBytes(downloadProgress.transferredBytes)} downloaded`}</span>
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
            disabled={isCancellingDownload}
            onClick={isDownloading ? handleCancelDownload : onClose}
          >
            {isDownloading ? (isCancellingDownload ? 'Cancelling...' : 'Cancel') : 'Close'}
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
              || isCancellingDownload
              || (!isDownloading && attachmentRowRequests.length === 0)
            }
            title={downloadFilesTitle}
            onClick={() => {
              if (isDownloading) {
                handleTogglePause()
                return
              }
              handleDownloadFiles()
            }}
          >
            {bomLoading
              ? 'Loading BOM...'
              : isDownloading
                ? (isDownloadPaused ? 'Resume' : 'Pause')
                : 'Download Files'}
          </button>
        </div>
      </div>

      </div>
      {modalRoot && pathLengthRiskDialog ? createPortal(pathLengthRiskDialog, modalRoot) : pathLengthRiskDialog}
    </>
  )
}
