import type { BomCloneNode } from '../clone/clone.types'

export type AttachmentDownloadBomNode = BomCloneNode

export type AttachmentDownloadBomRow = {
  id: string
  description: string
  title: string
  revision: string
  lifecycle: string
  itemLink: string
}
