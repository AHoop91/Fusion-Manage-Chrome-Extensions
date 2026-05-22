import type { PlmExtRuntime } from '../../../shared/runtime/types'

export type DesignComponentsRuntime = Pick<PlmExtRuntime, 'requestPlmAction'>

export type DerivativeOutputType =
  | 'pdf'
  | 'step'
  | 'stl'
  | 'iges'
  | 'obj'
  | 'dwg'
  | 'thumbnail'
  | 'fbx'
  | 'svf'
  | 'svf2'

export type DesignItemDetails = {
  id: string
  name: string
  extensionType: string
  mimeType: string
  size: string
  fusionWebUrl: string
}

/**
 * Source for Model Derivative — matches Fusion-connected downloader:
 * `GET /api/v3/workspaces/{ws}/items/{id}/designs` → `encodedDesignUrn` on a DONE design.
 */
export type SourceFileDescriptor = {
  tenant: string
  workspaceId: number
  dmsId: number
  /** Same string PLM returns; passed verbatim to APS MD job + manifest URLs. */
  encodedDesignUrn: string
  /** Optional decoded Fusion file URN for display (base64url decode of encodedDesignUrn). */
  fusionFileUrn?: string
  designName: string
  resourceName: string
  extension: string
  itemUrn: string
}

export type FormatOptionField = {
  key: string
  label: string
  options: { value: string; label: string }[]
  defaultValue: string
}

export type OutputFormatOption = {
  value: DerivativeOutputType
  label: string
  fields?: FormatOptionField[]
}

export type ConversionJobState =
  | 'loading_source'
  | 'ready_to_convert'
  | 'submitting'
  | 'polling'
  | 'success'
  | 'error'

export type ConversionJobManifest = {
  status?: string
  progress?: string | number
  type?: string
  hasThumbnail?: boolean
  [key: string]: unknown
}

export type ConversionState = {
  state: ConversionJobState
  message: string
}

export type DesignComponentsView = {
  mount: () => void
  update: () => void
  unmount: () => void
}
