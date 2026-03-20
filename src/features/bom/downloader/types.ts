import type { BomCloneNode } from '../clone/clone.types'
import type {
  AttachmentDownloadController,
  AttachmentDownloadFile,
  AttachmentDownloadProgress,
  AttachmentDownloadRowRequest,
  AttachmentDownloadRowResult,
  AttachmentDownloadRunResult
} from './models'

export type AttachmentDownloadBomNode = BomCloneNode

export type AttachmentPreviewConfig = {
  enabled: boolean
  warningMessage: string | null
  attachmentFieldViewDefId: string | null
}

export type {
  AttachmentDownloadController,
  AttachmentDownloadFile,
  AttachmentDownloadProgress,
  AttachmentDownloadRowRequest,
  AttachmentDownloadRowResult,
  AttachmentDownloadRunResult
}
