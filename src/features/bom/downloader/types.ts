import type { BomCloneNode } from '../clone/clone.types'
import type { AttachmentPreviewConfig } from '../clone/services/service.contract'

export type AttachmentDownloadBomNode = BomCloneNode
export type { AttachmentPreviewConfig }

export type AttachmentDownloadBomRow = {
  id: string
  description: string
  title: string
  revision: string
  lifecycle: string
  itemLink: string
}
