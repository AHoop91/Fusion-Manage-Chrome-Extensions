import type {
  AttachmentDownloadController,
  AttachmentDownloadFile,
  AttachmentDownloadProgress,
  AttachmentDownloadRowRequest,
  AttachmentDownloadRowResult,
  AttachmentDownloadRowStatus,
  AttachmentDownloadRunResult
} from '../models'
import type { AttachmentDownloadRules } from './rules.service'
import { assertAllowedAttachmentDownloadUrl } from './urlValidation.service'

const DEFAULT_ROW_DOWNLOAD_CONCURRENCY = 6
const DEFAULT_FILE_DOWNLOAD_CONCURRENCY_PER_ROW = 3
const PROGRESS_EMIT_INTERVAL_MS = 80
const INVALID_PATH_CHAR_RE = /[<>:"/\\|?*\u0000-\u001F]/g
const RESERVED_PATH_RE = /^\.+$/

type DownloadTask = {
  attachment: AttachmentDownloadFile
  row: AttachmentDownloadRowResult
  fileName: string
  folderSegments: string[]
}

type DownloadTaskGroup = {
  row: AttachmentDownloadRowResult
  tasks: DownloadTask[]
}

class AttachmentDownloadCancelledError extends Error {
  constructor() {
    super('Attachment download was cancelled.')
    this.name = 'AttachmentDownloadCancelledError'
  }
}

function isAttachmentDownloadCancelledError(error: unknown): boolean {
  return error instanceof AttachmentDownloadCancelledError
    || (error instanceof DOMException && error.name === 'AbortError')
}

export function createAttachmentDownloadController(): AttachmentDownloadController {
  let paused = false
  let cancelled = false
  let waiters: Array<() => void> = []
  const abortControllers = new Set<AbortController>()

  return {
    pause() {
      if (cancelled) return
      paused = true
    },
    resume() {
      if (cancelled) return
      paused = false
      const pending = waiters
      waiters = []
      for (const resolve of pending) resolve()
    },
    cancel() {
      if (cancelled) return
      cancelled = true
      paused = false
      const pending = waiters
      waiters = []
      for (const resolve of pending) resolve()
      for (const abortController of abortControllers) {
        abortController.abort()
      }
      abortControllers.clear()
    },
    isPaused() {
      return paused
    },
    isCancelled() {
      return cancelled
    },
    waitIfPaused() {
      if (cancelled) return Promise.reject(new AttachmentDownloadCancelledError())
      if (!paused) return Promise.resolve()
      return new Promise<void>((resolve) => {
        waiters.push(resolve)
      })
        .then(() => {
          if (cancelled) throw new AttachmentDownloadCancelledError()
        })
    },
    trackAbortController(controller) {
      if (cancelled) {
        controller.abort()
        return
      }
      abortControllers.add(controller)
    },
    untrackAbortController(controller) {
      abortControllers.delete(controller)
    }
  }
}

function sanitizePathSegment(value: string, fallback: string): string {
  const sanitized = String(value || '')
    .replace(INVALID_PATH_CHAR_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '')

  if (!sanitized || RESERVED_PATH_RE.test(sanitized)) return fallback
  return sanitized.slice(0, 120)
}

function normalizeExtension(value: string): string {
  const trimmed = String(value || '').trim().toLowerCase()
  if (!trimmed) return ''
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`
}

function splitFileName(sourceName: string, explicitExtension: string): { baseName: string; extension: string } {
  const normalizedSource = String(sourceName || '').trim()
  const normalizedExplicitExtension = normalizeExtension(explicitExtension)

  if (!normalizedSource) {
    return {
      baseName: 'attachment',
      extension: normalizedExplicitExtension
    }
  }

  if (normalizedExplicitExtension && normalizedSource.toLowerCase().endsWith(normalizedExplicitExtension)) {
    return {
      baseName: normalizedSource.slice(0, normalizedSource.length - normalizedExplicitExtension.length) || 'attachment',
      extension: normalizedExplicitExtension
    }
  }

  const lastDotIndex = normalizedSource.lastIndexOf('.')
  if (lastDotIndex > 0 && lastDotIndex < normalizedSource.length - 1) {
    return {
      baseName: normalizedSource.slice(0, lastDotIndex) || 'attachment',
      extension: normalizedSource.slice(lastDotIndex).toLowerCase()
    }
  }

  return {
    baseName: normalizedSource,
    extension: normalizedExplicitExtension
  }
}

function formatDateToken(timestamp: string): string {
  const parsed = Date.parse(String(timestamp || ''))
  if (!Number.isFinite(parsed)) return ''
  const date = new Date(parsed)
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

function buildFileNameWithTokens(baseName: string, tokens: string[], extension: string): string {
  const safeBaseName = sanitizePathSegment(baseName, 'attachment')
  const safeTokens = tokens
    .map((token) => sanitizePathSegment(token, ''))
    .filter(Boolean)

  const joined = safeTokens.length > 0 ? `${safeBaseName}_${safeTokens.join('_')}` : safeBaseName
  return `${joined}${extension}`
}

function buildAttachmentFileName(row: AttachmentDownloadRowResult, attachment: AttachmentDownloadFile, renameMode: AttachmentDownloadRules['renameFiles']): string {
  const sourceName = attachment.resourceName || attachment.name || `attachment-${attachment.id || row.dmsId}`
  const { baseName, extension } = splitFileName(sourceName, attachment.extension)
  const descriptor = sanitizePathSegment(row.rowLabel, `item-${row.dmsId}`)
  const dateToken = formatDateToken(attachment.timestamp)
  const versionToken = attachment.version !== null ? `v${attachment.version}` : ''
  const revisionToken = sanitizePathSegment(row.rowRevision, '')
  const revisionVersionToken =
    revisionToken && attachment.version !== null
      ? `${revisionToken}.${attachment.version}`
      : revisionToken || versionToken

  switch (renameMode) {
    case 'filename-date':
      return buildFileNameWithTokens(baseName, [dateToken], extension)
    case 'date-filename':
      return buildFileNameWithTokens(dateToken || 'date', [baseName], extension)
    case 'filename-version':
      return buildFileNameWithTokens(baseName, [versionToken], extension)
    case 'filename-version-date':
      return buildFileNameWithTokens(baseName, [versionToken, dateToken], extension)
    case 'filename-revision-version':
      return buildFileNameWithTokens(baseName, [revisionVersionToken], extension)
    case 'filename-revision-version-date':
      return buildFileNameWithTokens(baseName, [revisionVersionToken, dateToken], extension)
    case 'descriptor':
      return buildFileNameWithTokens(descriptor, [], extension)
    case 'descriptor-date':
      return buildFileNameWithTokens(descriptor, [dateToken], extension)
    case 'descriptor-version':
      return buildFileNameWithTokens(descriptor, [versionToken], extension)
    case 'descriptor-version-date':
      return buildFileNameWithTokens(descriptor, [versionToken, dateToken], extension)
    case 'descriptor-revision-version':
      return buildFileNameWithTokens(descriptor, [revisionVersionToken], extension)
    case 'descriptor-revision-version-date':
      return buildFileNameWithTokens(descriptor, [revisionVersionToken, dateToken], extension)
    case 'none':
    default:
      return buildFileNameWithTokens(baseName, [], extension)
  }
}

function stripRevisionSuffix(value: string): string {
  return String(value || '').replace(/\s*\[REV:[^\]]+\]\s*$/i, '').trim()
}

function resolveFolderSegments(row: AttachmentDownloadRowResult, mode: AttachmentDownloadRules['createSubFolders']): string[] {
  const sanitizedPath = row.rowPathLabels.map((label, index) => (
    sanitizePathSegment(
      stripRevisionSuffix(label),
      index === 0 ? `item-${row.dmsId}` : `level-${index + 1}`
    )
  ))
  const currentItemSegment = sanitizedPath[sanitizedPath.length - 1]
    || sanitizePathSegment(stripRevisionSuffix(row.rowLabel), `item-${row.dmsId}`)
  const topLevelSegment = sanitizedPath.length > 1 ? sanitizedPath[1] : ''

  switch (mode) {
    case 'matching-bom-path': {
      // The selected destination folder already represents the BOM root.
      // Only create nested folders beneath it when the row lives below the root.
      return sanitizedPath.length > 1 ? sanitizedPath.slice(1).filter(Boolean) : []
    }
    case 'per-top-level-item': {
      // Group descendants under their first child beneath the BOM root.
      // Root attachments stay in the selected folder instead of duplicating the root as a subfolder.
      return topLevelSegment ? [topLevelSegment] : []
    }
    case 'per-item':
    default:
      return currentItemSegment ? [currentItemSegment] : []
  }
}

function appendNumericSuffix(fileName: string, copyNumber: number): string {
  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex <= 0) return `${fileName} (${copyNumber})`
  return `${fileName.slice(0, lastDotIndex)} (${copyNumber})${fileName.slice(lastDotIndex)}`
}

async function fileExists(directoryHandle: FileSystemDirectoryHandle, fileName: string): Promise<boolean> {
  try {
    await directoryHandle.getFileHandle(fileName)
    return true
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return false
    throw error
  }
}

async function ensureDirectoryHandle(
  rootHandle: FileSystemDirectoryHandle,
  folderSegments: string[],
  cache: Map<string, Promise<FileSystemDirectoryHandle>>
): Promise<FileSystemDirectoryHandle> {
  if (folderSegments.length === 0) return rootHandle

  let currentHandle = rootHandle
  let currentPath = ''
  for (const segment of folderSegments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment
    let handlePromise = cache.get(currentPath)
    if (!handlePromise) {
      const parentHandle = currentHandle
      handlePromise = parentHandle.getDirectoryHandle(segment, { create: true })
      cache.set(currentPath, handlePromise)
    }
    currentHandle = await handlePromise
  }

  return currentHandle
}

async function createUniqueFileHandle(
  directoryHandle: FileSystemDirectoryHandle,
  folderKey: string,
  proposedFileName: string,
  reservedNamesByFolder: Map<string, Set<string>>
): Promise<FileSystemFileHandle> {
  const reservedNames = reservedNamesByFolder.get(folderKey) || new Set<string>()
  reservedNamesByFolder.set(folderKey, reservedNames)

  let copyNumber = 1
  let candidate = proposedFileName
  for (;;) {
    const normalizedCandidate = candidate.toLowerCase()
    const alreadyReserved = reservedNames.has(normalizedCandidate)
    const alreadyExists = alreadyReserved ? true : await fileExists(directoryHandle, candidate)
    if (!alreadyExists) {
      reservedNames.add(normalizedCandidate)
      return directoryHandle.getFileHandle(candidate, { create: true })
    }
    copyNumber += 1
    candidate = appendNumericSuffix(proposedFileName, copyNumber)
  }
}

async function streamResponseToFile(
  response: Response,
  writable: FileSystemWritableFileStream,
  onChunk: (chunkBytes: number) => void,
  controller: AttachmentDownloadController
): Promise<void> {
  const body = response.body
  if (!body) {
    await controller.waitIfPaused()
    if (controller.isCancelled()) throw new AttachmentDownloadCancelledError()
    const buffer = await response.arrayBuffer()
    await controller.waitIfPaused()
    if (controller.isCancelled()) throw new AttachmentDownloadCancelledError()
    await writable.write(buffer)
    onChunk(buffer.byteLength)
    await writable.close()
    return
  }

  const reader = body.getReader()
  try {
    for (;;) {
      await controller.waitIfPaused()
      if (controller.isCancelled()) throw new AttachmentDownloadCancelledError()
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue
      await controller.waitIfPaused()
      if (controller.isCancelled()) throw new AttachmentDownloadCancelledError()
      await writable.write(value)
      onChunk(value.byteLength)
    }
    await writable.close()
  } catch (error) {
    try {
      await writable.abort()
    } catch {
      // Ignore abort failures; the original error is more useful.
    }
    throw error
  } finally {
    reader.releaseLock()
  }
}

function buildDownloadTaskGroups(rows: AttachmentDownloadRowResult[], rules: AttachmentDownloadRules): DownloadTaskGroup[] {
  return rows
    .map((row) => ({
      row,
      tasks: row.attachments
        .filter((attachment) => Boolean(String(attachment.url || '').trim()))
        .map((attachment) => ({
          attachment,
          row,
          fileName: buildAttachmentFileName(row, attachment, rules.renameFiles),
          folderSegments: resolveFolderSegments(row, rules.createSubFolders)
        }))
    }))
    .filter((group) => group.tasks.length > 0)
}

function createEmptyRowStatus(): AttachmentDownloadRowStatus {
  return {
    totalFiles: 0,
    completedFiles: 0,
    failedFiles: 0,
    activeFiles: 0
  }
}

export async function downloadAttachmentFiles(params: {
  directoryHandle: FileSystemDirectoryHandle
  rows: AttachmentDownloadRowResult[]
  rules: AttachmentDownloadRules
  rowConcurrency?: number
  fileConcurrencyPerRow?: number
  controller?: AttachmentDownloadController
  onProgress?: (progress: AttachmentDownloadProgress) => void
}): Promise<AttachmentDownloadRunResult> {
  const {
    directoryHandle,
    rows,
    rules,
    rowConcurrency = DEFAULT_ROW_DOWNLOAD_CONCURRENCY,
    fileConcurrencyPerRow = DEFAULT_FILE_DOWNLOAD_CONCURRENCY_PER_ROW,
    controller = createAttachmentDownloadController(),
    onProgress
  } = params
  const taskGroups = buildDownloadTaskGroups(rows, rules)
  const tasks = taskGroups.flatMap((group) => group.tasks)

  if (tasks.length === 0) {
    throw new Error('No downloadable attachment URLs were available for the current filter selection.')
  }

  const progressState: AttachmentDownloadProgress = {
    totalFiles: tasks.length,
    completedFiles: 0,
    failedFiles: 0,
    activeFiles: 0,
    transferredBytes: 0,
    totalBytes: tasks.reduce((sum, task) => sum + Math.max(0, task.attachment.size || 0), 0),
    rowStatuses: Object.fromEntries(taskGroups.map((group) => ([
      group.row.rowId,
      {
        ...createEmptyRowStatus(),
        totalFiles: group.tasks.length
      } satisfies AttachmentDownloadRowStatus
    ])))
  }

  let lastProgressEmit = 0
  const directoryCache = new Map<string, Promise<FileSystemDirectoryHandle>>()
  const reservedNamesByFolder = new Map<string, Set<string>>()

  const emitProgress = (force = false): void => {
    if (!onProgress) return
    const now = Date.now()
    if (!force && now - lastProgressEmit < PROGRESS_EMIT_INTERVAL_MS) return
    lastProgressEmit = now
    onProgress({ ...progressState })
  }

  emitProgress(true)

  async function downloadTask(task: DownloadTask): Promise<void> {
    await controller.waitIfPaused()
    if (controller.isCancelled()) throw new AttachmentDownloadCancelledError()
    progressState.activeFiles += 1
    const rowStatus = progressState.rowStatuses[task.row.rowId]
    if (rowStatus) {
      rowStatus.activeFiles += 1
    }
    emitProgress()

    try {
      const folderKey = task.folderSegments.join('/')
      const targetDirectory = await ensureDirectoryHandle(directoryHandle, task.folderSegments, directoryCache)
      const targetFileHandle = await createUniqueFileHandle(
        targetDirectory,
        folderKey,
        task.fileName,
        reservedNamesByFolder
      )
      const downloadUrl = assertAllowedAttachmentDownloadUrl(task.attachment.url)
      const abortController = new AbortController()
      controller.trackAbortController(abortController)
      let response: Response
      try {
        response = await fetch(downloadUrl, {
          method: 'GET',
          credentials: 'omit',
          signal: abortController.signal
        })
      } finally {
        controller.untrackAbortController(abortController)
      }

      if (!response.ok) {
        throw new Error(`Failed to download ${task.attachment.name || task.fileName} (HTTP ${response.status})`)
      }

      const writable = await targetFileHandle.createWritable()
      await streamResponseToFile(response, writable, (chunkBytes) => {
        progressState.transferredBytes += chunkBytes
        emitProgress()
      }, controller)
      progressState.completedFiles += 1
      if (rowStatus) {
        rowStatus.completedFiles += 1
      }
    } catch (error) {
      if (isAttachmentDownloadCancelledError(error)) throw error
      progressState.failedFiles += 1
      const rowStatus = progressState.rowStatuses[task.row.rowId]
      if (rowStatus) {
        rowStatus.failedFiles += 1
      }
    } finally {
      progressState.activeFiles = Math.max(0, progressState.activeFiles - 1)
      const rowStatus = progressState.rowStatuses[task.row.rowId]
      if (rowStatus) {
        rowStatus.activeFiles = Math.max(0, rowStatus.activeFiles - 1)
      }
      emitProgress(true)
    }
  }

  async function processTaskGroup(group: DownloadTaskGroup): Promise<void> {
    const queue = group.tasks.slice()
    const workerCount = Math.max(1, Math.min(Math.floor(fileConcurrencyPerRow), queue.length))

    async function fileWorker(): Promise<void> {
      while (queue.length > 0) {
        await controller.waitIfPaused()
        if (controller.isCancelled()) throw new AttachmentDownloadCancelledError()
        const task = queue.shift()
        if (!task) return
        await downloadTask(task)
      }
    }

    await Promise.all(Array.from({ length: workerCount }, () => fileWorker()))
  }

  const groupQueue = taskGroups.slice()
  const rowWorkerCount = Math.max(1, Math.min(Math.floor(rowConcurrency), groupQueue.length))

  async function rowWorker(): Promise<void> {
    while (groupQueue.length > 0) {
      await controller.waitIfPaused()
      if (controller.isCancelled()) throw new AttachmentDownloadCancelledError()
      const group = groupQueue.shift()
      if (!group) return
      await processTaskGroup(group)
    }
  }

  await Promise.all(Array.from({ length: rowWorkerCount }, () => rowWorker()))

  return {
    ...progressState,
    directoryName: directoryHandle.name
  }
}

export async function resolveAndDownloadAttachmentFiles(params: {
  directoryHandle: FileSystemDirectoryHandle
  rowRequests: AttachmentDownloadRowRequest[]
  rules: AttachmentDownloadRules
  rowConcurrency?: number
  fileConcurrencyPerRow?: number
  controller?: AttachmentDownloadController
  resolveRow: (row: AttachmentDownloadRowRequest) => Promise<AttachmentDownloadRowResult>
  filterResolvedRow: (row: AttachmentDownloadRowResult) => AttachmentDownloadRowResult
  onRowResolved?: (row: AttachmentDownloadRowResult) => void
  onProgress?: (progress: AttachmentDownloadProgress) => void
}): Promise<AttachmentDownloadRunResult> {
  const {
    directoryHandle,
    rowRequests,
    rules,
    rowConcurrency = DEFAULT_ROW_DOWNLOAD_CONCURRENCY,
    fileConcurrencyPerRow = DEFAULT_FILE_DOWNLOAD_CONCURRENCY_PER_ROW,
    controller = createAttachmentDownloadController(),
    resolveRow,
    filterResolvedRow,
    onRowResolved,
    onProgress
  } = params

  const normalizedRowRequests = rowRequests.filter((row) => Number.isFinite(row.dmsId) && row.dmsId > 0)
  if (normalizedRowRequests.length === 0) {
    throw new Error('No BOM rows currently match the active attachment filters.')
  }

  const progressState: AttachmentDownloadProgress = {
    totalFiles: 0,
    completedFiles: 0,
    failedFiles: 0,
    activeFiles: 0,
    transferredBytes: 0,
    totalBytes: 0,
    rowStatuses: Object.fromEntries(normalizedRowRequests.map((row) => ([row.rowId, createEmptyRowStatus()])))
  }

  let lastProgressEmit = 0
  const directoryCache = new Map<string, Promise<FileSystemDirectoryHandle>>()
  const reservedNamesByFolder = new Map<string, Set<string>>()

  const emitProgress = (force = false): void => {
    if (!onProgress) return
    const now = Date.now()
    if (!force && now - lastProgressEmit < PROGRESS_EMIT_INTERVAL_MS) return
    lastProgressEmit = now
    onProgress({ ...progressState })
  }

  emitProgress(true)

  async function downloadTask(task: DownloadTask): Promise<void> {
    await controller.waitIfPaused()
    if (controller.isCancelled()) throw new AttachmentDownloadCancelledError()
    progressState.activeFiles += 1
    const rowStatus = progressState.rowStatuses[task.row.rowId]
    if (rowStatus) {
      rowStatus.activeFiles += 1
    }
    emitProgress()

    try {
      const folderKey = task.folderSegments.join('/')
      const targetDirectory = await ensureDirectoryHandle(directoryHandle, task.folderSegments, directoryCache)
      const targetFileHandle = await createUniqueFileHandle(
        targetDirectory,
        folderKey,
        task.fileName,
        reservedNamesByFolder
      )
      const downloadUrl = assertAllowedAttachmentDownloadUrl(task.attachment.url)
      const abortController = new AbortController()
      controller.trackAbortController(abortController)
      let response: Response
      try {
        response = await fetch(downloadUrl, {
          method: 'GET',
          credentials: 'omit',
          signal: abortController.signal
        })
      } finally {
        controller.untrackAbortController(abortController)
      }

      if (!response.ok) {
        throw new Error(`Failed to download ${task.attachment.name || task.fileName} (HTTP ${response.status})`)
      }

      const writable = await targetFileHandle.createWritable()
      await streamResponseToFile(response, writable, (chunkBytes) => {
        progressState.transferredBytes += chunkBytes
        emitProgress()
      }, controller)
      progressState.completedFiles += 1
      if (rowStatus) {
        rowStatus.completedFiles += 1
      }
    } catch (error) {
      if (isAttachmentDownloadCancelledError(error)) throw error
      progressState.failedFiles += 1
      const rowStatus = progressState.rowStatuses[task.row.rowId]
      if (rowStatus) {
        rowStatus.failedFiles += 1
      }
    } finally {
      progressState.activeFiles = Math.max(0, progressState.activeFiles - 1)
      const rowStatus = progressState.rowStatuses[task.row.rowId]
      if (rowStatus) {
        rowStatus.activeFiles = Math.max(0, rowStatus.activeFiles - 1)
      }
      emitProgress(true)
    }
  }

  async function processResolvedRow(row: AttachmentDownloadRowResult): Promise<void> {
    const filteredRow = filterResolvedRow(row)
    const taskGroup = buildDownloadTaskGroups([filteredRow], rules)[0] || null
    const rowStatus = progressState.rowStatuses[filteredRow.rowId] || createEmptyRowStatus()
    progressState.rowStatuses[filteredRow.rowId] = rowStatus

    const tasks = taskGroup?.tasks || []
    rowStatus.totalFiles = tasks.length
    progressState.totalFiles += tasks.length
    progressState.totalBytes += tasks.reduce((sum, task) => sum + Math.max(0, task.attachment.size || 0), 0)
    emitProgress(true)

    if (!taskGroup || tasks.length === 0) return

    const queue = tasks.slice()
    const workerCount = Math.max(1, Math.min(Math.floor(fileConcurrencyPerRow), queue.length))

    async function fileWorker(): Promise<void> {
      while (queue.length > 0) {
        await controller.waitIfPaused()
        if (controller.isCancelled()) throw new AttachmentDownloadCancelledError()
        const task = queue.shift()
        if (!task) return
        await downloadTask(task)
      }
    }

    await Promise.all(Array.from({ length: workerCount }, () => fileWorker()))
  }

  const rowQueue = normalizedRowRequests.slice()
  const rowWorkerCount = Math.max(1, Math.min(Math.floor(rowConcurrency), rowQueue.length))

  async function rowWorker(): Promise<void> {
    while (rowQueue.length > 0) {
      await controller.waitIfPaused()
      if (controller.isCancelled()) throw new AttachmentDownloadCancelledError()
      const rowRequest = rowQueue.shift()
      if (!rowRequest) return

      let resolvedRow: AttachmentDownloadRowResult

      try {
        resolvedRow = await resolveRow(rowRequest)
      } catch (error) {
        resolvedRow = {
          ...rowRequest,
          attachments: [],
          error: error instanceof Error ? error.message : String(error)
        }
      }

      onRowResolved?.(resolvedRow)
      emitProgress(true)

      await controller.waitIfPaused()
      if (controller.isCancelled()) throw new AttachmentDownloadCancelledError()
      await processResolvedRow(resolvedRow)
    }
  }

  await Promise.all(Array.from({ length: rowWorkerCount }, () => rowWorker()))

  return {
    ...progressState,
    directoryName: directoryHandle.name
  }
}
