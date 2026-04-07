export type AttachmentDownloadFile = {
  name: string
  url: string
  id: number
  description: string
  version: number | null
  extension: string
  resourceName: string
  timestamp: string
  size: number | null
}

export type AttachmentDownloadRowRequest = {
  rowId: string
  rowLabel: string
  dmsId: number
  rowRevision: string
  rowPathLabels: string[]
}

export type AttachmentDownloadRowResult = AttachmentDownloadRowRequest & {
  attachments: AttachmentDownloadFile[]
  error: string | null
}

export type AttachmentDownloadRowStatus = {
  totalFiles: number
  completedFiles: number
  failedFiles: number
  activeFiles: number
  errorMessage: string | null
}

export type AttachmentDownloadProgress = {
  totalFiles: number
  completedFiles: number
  failedFiles: number
  activeFiles: number
  transferredBytes: number
  totalBytes: number
  rowStatuses: Record<string, AttachmentDownloadRowStatus>
}

export type AttachmentDownloadRunResult = AttachmentDownloadProgress & {
  directoryName: string
}

export type AttachmentDownloadController = {
  pause: () => void
  resume: () => void
  cancel: () => void
  isPaused: () => boolean
  isCancelled: () => boolean
  waitIfPaused: () => Promise<void>
  trackAbortController: (controller: AbortController) => void
  untrackAbortController: (controller: AbortController) => void
}
