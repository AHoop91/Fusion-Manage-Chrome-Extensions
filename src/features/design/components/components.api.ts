import { getTenantFromPlmHost, parseWorkspaceIdFromPlmWorkspacePath } from '../../../shared/url/parse'
import {
  derivativeOutputsForSourceExtension,
  extractFormatsMatrix
} from './components.formats.catalog'
import type {
  ConversionJobManifest,
  DerivativeOutputType,
  DesignComponentsRuntime,
  DesignItemDetails,
  OutputFormatOption,
  SourceFileDescriptor
} from './components.types'

type ItemContext = {
  workspaceId: number
  dmsId: number
}

type DesignRecord = {
  status?: string
  encodedDesignUrn?: string
  designName?: string
  viewerName?: string
}

function base64UrlDecode(value: string): string {
  if (!value) return ''
  try {
    let b64 = value.replace(/-/g, '+').replace(/_/g, '/')
    while (b64.length % 4 !== 0) b64 += '='
    return atob(b64)
  } catch {
    return ''
  }
}

function resolveItemContextFromPageUrl(pageUrl: string): ItemContext | null {
  const workspaceId = parseWorkspaceIdFromPlmWorkspacePath(pageUrl)
  if (workspaceId === null) return null

  try {
    const url = new URL(pageUrl)
    const rawItemId = decodeURIComponent(String(url.searchParams.get('itemId') || ''))
    if (rawItemId) {
      const btParts = rawItemId.split('`')
      const tail = btParts[btParts.length - 1] || ''
      const ids = tail.split(',')
      const dmsFromBt = Number.parseInt(ids[ids.length - 1] ?? '', 10)
      if (Number.isFinite(dmsFromBt)) return { workspaceId, dmsId: dmsFromBt }

      const commaParts = rawItemId.split(',')
      const dmsFromComma = Number.parseInt(commaParts.at(-1) ?? '', 10)
      if (Number.isFinite(dmsFromComma)) return { workspaceId, dmsId: dmsFromComma }

      const urnMatch = /(?:^|[.:])(\d+)$/.exec(rawItemId)
      if (urnMatch) {
        const dmsFromUrn = Number.parseInt(urnMatch[1], 10)
        if (Number.isFinite(dmsFromUrn)) return { workspaceId, dmsId: dmsFromUrn }
      }
    }

    const pathMatch = url.pathname.match(/\/items\/(\d+)\b/i)
    if (pathMatch) {
      const dms = Number.parseInt(pathMatch[1], 10)
      if (Number.isFinite(dms)) return { workspaceId, dmsId: dms }
    }
  } catch {
    return null
  }

  return null
}

function extractDesignList(payload: unknown): DesignRecord[] {
  if (!payload || typeof payload !== 'object') return []
  const record = payload as Record<string, unknown>
  if (Array.isArray(payload)) {
    return payload.filter((entry): entry is DesignRecord => Boolean(entry && typeof entry === 'object'))
  }
  const fromItems = Array.isArray(record.items) ? record.items : null
  const fromData = Array.isArray(record.data) ? record.data : null
  const source = fromItems && fromItems.length > 0 ? fromItems : (fromData || [])
  return source.filter((entry): entry is DesignRecord => Boolean(entry && typeof entry === 'object'))
}

function extensionFromDesignName(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(String(name || '').trim())
  return match?.[1]?.toLowerCase() ?? ''
}

/**
 * Resolves Fusion design source via PLM designs API (same route as Fusion-connected FM downloader).
 */
export async function resolveDesignSourceForItem(
  runtime: DesignComponentsRuntime,
  pageUrl: string
): Promise<SourceFileDescriptor> {
  const context = resolveItemContextFromPageUrl(pageUrl)
  if (!context) {
    throw new Error('Could not resolve workspace/item from the current URL.')
  }
  const tenant = getTenantFromPlmHost(pageUrl)
  if (!tenant) {
    throw new Error('Could not resolve tenant from current URL.')
  }

  const payload = await runtime.requestPlmAction<unknown>('fetchApiJson', {
    tenant,
    path: `/api/v3/workspaces/${context.workspaceId}/items/${context.dmsId}/designs`
  })

  const list = extractDesignList(payload)
  const ready = list.filter((d) => String(d.status || '').toUpperCase() === 'DONE')

  if (ready.length === 0) {
    throw new Error(
      'No design with status DONE found for this item. The linked Fusion design may still be processing.'
    )
  }

  const first = ready[0]
  const encoded = typeof first.encodedDesignUrn === 'string' ? first.encodedDesignUrn.trim() : ''
  if (!encoded) {
    throw new Error('Design record is missing encodedDesignUrn.')
  }

  const designName = String(first.designName || first.viewerName || 'Design').trim()
  const fusionFileUrn = base64UrlDecode(encoded)
  const tenantCode = tenant.toUpperCase()
  const itemUrn = `urn:adsk.plm:tenant.workspace.item:${tenantCode}.${context.workspaceId}.${context.dmsId}`
  const ext = extensionFromDesignName(designName)

  return {
    tenant,
    workspaceId: context.workspaceId,
    dmsId: context.dmsId,
    encodedDesignUrn: encoded,
    fusionFileUrn: fusionFileUrn || undefined,
    designName,
    resourceName: designName,
    extension: ext,
    itemUrn
  }
}

export async function resolveModelIdForItem(
  runtime: DesignComponentsRuntime,
  pageUrl: string
): Promise<string> {
  const context = resolveItemContextFromPageUrl(pageUrl)
  if (!context) throw new Error('Could not resolve workspace/item from the current URL.')
  const tenant = getTenantFromPlmHost(pageUrl)
  if (!tenant) throw new Error('Could not resolve tenant from current URL.')

  const payload = await runtime.requestPlmAction<Record<string, unknown>>('fetchApiJson', {
    tenant,
    path: `/api/v3/workspaces/${context.workspaceId}/items/${context.dmsId}`
  })

  const modelId = typeof payload?.modelId === 'string' ? payload.modelId.trim() : ''
  if (!modelId) throw new Error('Item record is missing modelId.')
  return modelId
}

export async function fetchDesignItemFromGraphQL(
  runtime: DesignComponentsRuntime,
  modelId: string
): Promise<DesignItemDetails> {
  const response = await runtime.requestPlmAction<Record<string, unknown>>('fetchMfgGraphQL', {
    operation: 'getModelSourceFile',
    variables: { modelId }
  })

  const model = (response as any)?.data?.model
  if (!model || typeof model !== 'object') {
    throw new Error('GraphQL response missing data.model.')
  }

  const di = (model as any).designItem
  if (!di || typeof di !== 'object') {
    throw new Error('GraphQL response missing data.model.designItem.')
  }

  return {
    id:            typeof di.id            === 'string' ? di.id            : '',
    name:          typeof di.name          === 'string' ? di.name          : '',
    extensionType: typeof di.extensionType === 'string' && di.extensionType.trim()
                     ? di.extensionType.trim().toLowerCase()
                     : 'f3d',
    mimeType:      typeof di.mimeType      === 'string' ? di.mimeType      : '',
    size:          typeof di.size          === 'string' ? di.size          : '',
    fusionWebUrl:  typeof di.fusionWebUrl  === 'string' ? di.fusionWebUrl  : ''
  }
}

export async function resolveTranslationSources(
  runtime: DesignComponentsRuntime,
  pageUrl: string
): Promise<{ designDetails: DesignItemDetails; formatOptions: OutputFormatOption[] }> {
  const [modelId, formatsPayload] = await Promise.all([
    resolveModelIdForItem(runtime, pageUrl),
    runtime.requestPlmAction<unknown>('getModelDerivativeFormats', {})
  ])
  const designDetails = await fetchDesignItemFromGraphQL(runtime, modelId)
  const matrix = extractFormatsMatrix(formatsPayload)

  const formatOptions = matrix
    ? derivativeOutputsForSourceExtension(matrix, designDetails.extensionType).map((value) => ({ value, label: value.toUpperCase() }))
    : []

  return { designDetails, formatOptions }
}

export async function submitConversionJob(
  runtime: DesignComponentsRuntime,
  encodedDesignUrn: string,
  outputType: DerivativeOutputType,
  advancedOptions?: Record<string, string>,
  forceRetranslate?: boolean
): Promise<unknown> {
  return runtime.requestPlmAction('submitModelDerivativeJob', {
    urn: encodedDesignUrn,
    outputType,
    ...(advancedOptions ? { advancedOptions } : {}),
    ...(forceRetranslate != null ? { forceRetranslate } : {})
  })
}

export async function getConversionManifest(
  runtime: DesignComponentsRuntime,
  encodedDesignUrn: string
): Promise<ConversionJobManifest> {
  return runtime.requestPlmAction<ConversionJobManifest>('getModelDerivativeManifest', {
    urn: encodedDesignUrn
  })
}

export function derivativeDownloadFilename(designName: string, outputFormat: DerivativeOutputType): string {
  const base =
    String(designName || 'design')
      .replace(/\.[^/.]+$/i, '')
      .replace(/[^\w\-.]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 96) || 'derivative'
  const extMap: Record<DerivativeOutputType, string> = {
    pdf:       'pdf',
    step:      'step',
    stl:       'stl',
    iges:      'iges',
    obj:       'obj',
    dwg:       'dwg',
    thumbnail: 'png',
    fbx:       'fbx',
    svf:       'svf',
    svf2:      'svf2'
  }
  return `${base}.${extMap[outputFormat]}`
}

export async function downloadDerivativeThumbnail(
  runtime: DesignComponentsRuntime,
  encodedDesignUrn: string,
  width?: string,
  height?: string
): Promise<{ base64: string; contentType: string }> {
  return runtime.requestPlmAction<{ base64: string; contentType: string }>('downloadModelDerivativeThumbnail', {
    urn: encodedDesignUrn,
    ...(width ? { width: Number(width), height: Number(height) } : {})
  })
}

export async function downloadDerivativeAsset(
  runtime: DesignComponentsRuntime,
  encodedDesignUrn: string,
  derivativeUrn: string
): Promise<{ base64: string; contentType: string }> {
  return runtime.requestPlmAction<{ base64: string; contentType: string }>('downloadModelDerivativeAsset', {
    urn: encodedDesignUrn,
    derivativeUrn
  })
}
