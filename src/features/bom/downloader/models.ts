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
}

export type AttachmentDownloadRowResult = AttachmentDownloadRowRequest & {
  attachments: AttachmentDownloadFile[]
  error: string | null
}
