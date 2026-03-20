import type { AttachmentDownloadFile, AttachmentDownloadRowRequest, AttachmentDownloadRowResult } from '../models'

const BOM_ROUTE_RE = /^\/plm\/workspaces\/(\d+)\/items\/bom\/nested$/i
const ATTACHMENT_FETCH_CONCURRENCY = 5

type AttachmentDownloadContext = {
  tenant: string
  workspaceId: number
}

function resolveAttachmentDownloadContext(urlString: string): AttachmentDownloadContext | null {
  try {
    const url = new URL(urlString)
    const tenant = String(url.hostname.split('.')[0] || '').trim().toLowerCase()
    const routeMatch = BOM_ROUTE_RE.exec(url.pathname)
    const tab = String(url.searchParams.get('tab') || '').toLowerCase()
    const mode = String(url.searchParams.get('mode') || '').toLowerCase()

    if (!tenant || !routeMatch || tab !== 'bom' || mode !== 'view') return null

    const workspaceId = Number.parseInt(routeMatch[1], 10)
    if (!Number.isFinite(workspaceId) || workspaceId <= 0) return null

    return { tenant, workspaceId }
  } catch {
    return null
  }
}

function getRuntimeRequestAction(): NonNullable<Window['__plmExt']>['requestPlmAction'] {
  const requestPlmAction = window.__plmExt?.requestPlmAction
  if (!requestPlmAction) {
    throw new Error('Extension runtime is unavailable for attachment downloads.')
  }
  return requestPlmAction
}

function normalizeAttachmentExtension(value: unknown): string {
  const trimmed = String(value || '').trim().toLowerCase()
  if (!trimmed) return ''
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`
}

function extractAttachmentExtensionFromName(value: string): string {
  const text = String(value || '').trim()
  if (!text) return ''
  const lastDotIndex = text.lastIndexOf('.')
  if (lastDotIndex <= 0 || lastDotIndex === text.length - 1) return ''
  return text.slice(lastDotIndex).toLowerCase()
}

function normalizeAttachmentFile(entry: Record<string, unknown>): AttachmentDownloadFile {
  const type = entry.type && typeof entry.type === 'object' ? (entry.type as Record<string, unknown>) : {}
  const created = entry.created && typeof entry.created === 'object' ? (entry.created as Record<string, unknown>) : {}
  const resourceName = String(entry.resourceName || entry.name || '').trim()
  const name = String(entry.name || resourceName).trim()
  const id = Number(entry.id)
  const version = Number(entry.version)
  const size = Number(entry.size)
  const extension =
    normalizeAttachmentExtension(type.extension)
    || extractAttachmentExtensionFromName(name)
    || extractAttachmentExtensionFromName(resourceName)

  return {
    name,
    url: String(entry.url || '').trim(),
    id: Number.isFinite(id) ? Math.floor(id) : 0,
    description: String(entry.description || '').trim(),
    version: Number.isFinite(version) ? Math.floor(version) : null,
    extension,
    resourceName,
    timestamp: String(created.timeStamp || created.timestamp || '').trim(),
    size: Number.isFinite(size) ? size : null
  }
}

function extractAttachmentCollection(response: unknown): AttachmentDownloadFile[] {
  const record = response && typeof response === 'object' ? (response as Record<string, unknown>) : {}
  const data = Array.isArray(record.data) ? record.data : []
  return data
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => normalizeAttachmentFile(entry))
}

async function mapWithConcurrency<TInput, TOutput>(
  values: readonly TInput[],
  concurrency: number,
  iteratee: (value: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> {
  const size = Math.max(1, Math.floor(concurrency))
  const results = new Array<TOutput>(values.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await iteratee(values[currentIndex], currentIndex)
    }
  }

  await Promise.all(Array.from({ length: Math.min(size, values.length) }, () => worker()))
  return results
}

export async function fetchAttachmentDownloadRows(
  rows: AttachmentDownloadRowRequest[],
  urlString = window.location.href
): Promise<AttachmentDownloadRowResult[]> {
  const context = resolveAttachmentDownloadContext(urlString)
  if (!context) {
    throw new Error('Unable to resolve the current BOM context for attachment downloads.')
  }

  const requestPlmAction = getRuntimeRequestAction()
  const normalizedRows = rows.filter((row) => Number.isFinite(row.dmsId) && row.dmsId > 0)
  if (normalizedRows.length === 0) return []

  const requestsByDmsId = new Map<number, AttachmentDownloadRowRequest[]>()
  for (const row of normalizedRows) {
    const existing = requestsByDmsId.get(row.dmsId)
    if (existing) existing.push(row)
    else requestsByDmsId.set(row.dmsId, [row])
  }

  const resultsByDmsId = new Map<number, { attachments: AttachmentDownloadFile[]; error: string | null }>()
  await mapWithConcurrency(Array.from(requestsByDmsId.keys()), ATTACHMENT_FETCH_CONCURRENCY, async (dmsId) => {
    try {
      const response = await requestPlmAction('getAttachments', {
        tenant: context.tenant,
        wsId: context.workspaceId,
        dmsId
      })
      resultsByDmsId.set(dmsId, {
        attachments: extractAttachmentCollection(response),
        error: null
      })
    } catch (error) {
      resultsByDmsId.set(dmsId, {
        attachments: [],
        error: error instanceof Error ? error.message : String(error)
      })
    }
  })

  return normalizedRows.map((row) => {
    const result = resultsByDmsId.get(row.dmsId) || {
      attachments: [],
      error: 'Attachment request did not return a result.'
    }

    return {
      ...row,
      attachments: result.attachments,
      error: result.error
    }
  })
}
