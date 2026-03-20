import type { BomCloneNode } from '../clone/clone.types'
import type { AttachmentDownloadFile, AttachmentDownloadRowRequest, AttachmentDownloadRowResult } from './models'

export type AttachmentDownloadBomNode = BomCloneNode

export type AttachmentPreviewConfig = {
  enabled: boolean
  warningMessage: string | null
  attachmentFieldViewDefId: string | null
}

export type {
  AttachmentDownloadFile,
  AttachmentDownloadRowRequest,
  AttachmentDownloadRowResult
}
