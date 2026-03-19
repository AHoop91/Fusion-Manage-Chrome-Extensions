import type { AttachmentDownloadBomNode, AttachmentPreviewConfig } from '../types'

export type AttachmentDownloadHandlers = {
  onClose: () => void
  bomNodes: AttachmentDownloadBomNode[]
  bomLoading: boolean
  bomError: string | null
  attachmentPreviewConfig: AttachmentPreviewConfig
}

export type AttachmentDownloadView = {
  render: (modalRoot: HTMLDivElement, handlers: AttachmentDownloadHandlers) => void
  unmount: (modalRoot: HTMLDivElement) => void
}
