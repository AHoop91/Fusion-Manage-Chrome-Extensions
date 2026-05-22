import {
  httpRequest,
  httpRequestWithMeta,
  httpMultipartRequest,
  httpBinaryRequestWithMeta
} from './http'
import {
  buildGridRowPayload,
  buildItemSectionsPayload
} from './plm.helper'
import { resolveTenantPlmUrl, tenantOrigin } from './plm.url'

const IMAGE_LINK_PATH_REGEX = /\/api\/v\d+\/workspaces\/(\d+)\/items\/(\d+)\/field-values\/[^/]+\/image\/(\d+)(?:[/?#]|$)/i

async function uploadItemImage({
  itemUrl,
  image
}: {
  itemUrl: string
  image: { fieldId: string; value: string }
}) {
  if (!image?.fieldId || !image?.value) {
    throw new Error('Invalid image payload')
  }

  const itemDetail = await httpRequest({
    method: 'GET',
    url: itemUrl
  })

  const base64 = image.value.replace(/^data:image\/\w+;base64,/, '')
  const binary = Uint8Array.from(atob(base64), (value) => value.charCodeAt(0))
  const blob = new Blob([binary], { type: 'application/octet-stream' })
  const formData = new FormData()
  formData.append(image.fieldId, blob)
  formData.append(
    'itemDetail',
    new Blob([JSON.stringify(itemDetail)], {
      type: 'application/json'
    })
  )

  await httpMultipartRequest({
    method: 'PUT',
    url: itemUrl,
    formData
  })
}

function inferImageMimeFromBytes(bytes: Uint8Array): string {
  if (
    bytes?.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) return 'image/png'

  if (bytes?.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }

  if (
    bytes?.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) return 'image/gif'

  if (
    bytes?.length >= 4 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46
  ) return 'image/webp'

  return 'image/png'
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }

  return btoa(binary)
}

function normalizeImageMimeFromContentType(contentType: unknown): string | null {
  const normalized = String(contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase()

  if (!normalized || !normalized.startsWith('image/')) return null
  if (normalized === 'image/jpg') return 'image/jpeg'
  return normalized
}

function looksLikeHtmlPayload(bytes: Uint8Array): boolean {
  if (!bytes || bytes.length < 4) return false
  const sample = Array.from(bytes.subarray(0, Math.min(bytes.length, 80)))
    .map((code) => String.fromCharCode(Number(code)))
    .join('')
    .trim()
    .toLowerCase()

  return (
    sample.startsWith('<!doctype html') ||
    sample.startsWith('<html') ||
    sample.startsWith('<head') ||
    sample.startsWith('<body')
  )
}

function parseImagePathParts(link: unknown): { workspaceId: number; dmsId: number; imageId: number } | null {
  const match = IMAGE_LINK_PATH_REGEX.exec(String(link || '').trim())
  if (!match) return null

  const workspaceId = Number(match[1])
  const dmsId = Number(match[2])
  const imageId = Number(match[3])

  if (!Number.isFinite(workspaceId) || !Number.isFinite(dmsId) || !Number.isFinite(imageId)) {
    return null
  }

  return { workspaceId, dmsId, imageId }
}

function buildItemImagePath({
  workspaceId,
  dmsId,
  imageId,
  fieldId = 'IMAGE'
}: {
  workspaceId: number
  dmsId: number
  imageId: number
  fieldId?: string
}): string {
  return (
    `/api/v2/workspaces/${workspaceId}` +
    `/items/${dmsId}` +
    `/field-values/${fieldId}` +
    `/image/${imageId}`
  )
}

export async function fetchSections({
  tenant,
  workspaceId,
  link
}: {
  tenant: string
  workspaceId?: string | number
  link?: string
}) {
  let wsId = workspaceId

  if (!wsId && link) {
    const parts = link.split('/')
    wsId = Number(parts[4])
  }

  if (!wsId) {
    throw new Error('workspaceId is required')
  }

  return httpRequest({
    method: 'GET',
    url: `${tenantOrigin(tenant)}/api/v3/workspaces/${wsId}/sections`,
    headers: {
      Accept: 'application/vnd.autodesk.plm.sections.bulk+json'
    }
  })
}

export async function fetchFields({
  tenant,
  workspaceId,
  link
}: {
  tenant: string
  workspaceId?: string | number
  link?: string
}) {
  let wsId = workspaceId

  if (!wsId && link) {
    const parts = link.split('/')
    wsId = Number(parts[4])
  }

  if (!wsId) {
    throw new Error('workspaceId is required')
  }

  const response = await httpRequest({
    method: 'GET',
    url: `${tenantOrigin(tenant)}/api/v3/workspaces/${wsId}/fields`
  })

  return response?.fields ?? []
}

export async function createItem({
  tenant,
  workspaceId,
  sections,
  fields,
  derived,
  image,
  getDetails = false
}: {
  tenant: string
  workspaceId: string | number
  sections: Array<Record<string, unknown>>
  fields?: Array<Record<string, unknown>>
  derived?: { sections?: Array<Record<string, unknown>> }
  image?: { fieldId: string; value: string }
  getDetails?: boolean
}) {
  if (!tenant) throw new Error('tenant is required')
  if (!workspaceId) throw new Error('workspaceId is required')

  const prefix = `/api/v3/workspaces/${workspaceId}`
  const payloadSections = buildItemSectionsPayload({
    prefix,
    sections: sections as Array<Record<string, unknown>>,
    fields,
    derived
  })

  const createResponseMeta = await httpRequestWithMeta({
    method: 'POST',
    url: `${tenantOrigin(tenant)}${prefix}/items`,
    body: { sections: payloadSections }
  })
  const createResponse = createResponseMeta?.data
  const locationHeader = String(createResponseMeta?.headers?.location || '').trim()
  const itemPath =
    locationHeader ||
    createResponse?.__self__ ||
    createResponse?.location ||
    createResponse?.data

  if (!itemPath) {
    throw new Error('Item creation did not return item location')
  }

  const itemUrl = resolveTenantPlmUrl(tenant, String(itemPath))

  if (image) {
    await uploadItemImage({ itemUrl, image })
  }

  if (getDetails) {
    return httpRequest({
      method: 'GET',
      url: itemUrl
    })
  }

  return { location: itemUrl }
}

export async function getItemDescriptor({
  tenant,
  workspaceId,
  dmsId,
  link
}: {
  tenant: string
  workspaceId?: string | number
  dmsId?: string | number
  link?: string
}) {
  if (!tenant) {
    throw new Error('tenant is required')
  }

  let itemPath: string

  if (link) {
    itemPath = link
  } else {
    if (!workspaceId || !dmsId) {
      throw new Error('workspaceId and dmsId are required when link is not provided')
    }
    itemPath = `/api/v3/workspaces/${workspaceId}/items/${dmsId}`
  }

  const itemUrl = resolveTenantPlmUrl(tenant, itemPath)
  const item = await httpRequest({
    method: 'GET',
    url: itemUrl
  })

  return item?.title ?? null
}

export async function getItemDetails({
  tenant,
  workspaceId,
  dmsId,
  link
}: {
  tenant: string
  workspaceId?: string | number
  dmsId?: string | number
  link?: string
}) {
  if (!tenant) {
    throw new Error('tenant is required')
  }

  let itemPath: string

  if (link) {
    itemPath = link
  } else {
    if (!workspaceId || !dmsId) {
      throw new Error('workspaceId and dmsId are required when link is not provided')
    }
    itemPath = `/api/v3/workspaces/${workspaceId}/items/${dmsId}`
  }

  const itemUrl = resolveTenantPlmUrl(tenant, itemPath)

  return httpRequest({
    method: 'GET',
    url: itemUrl
  })
}

export async function getFieldImageData({
  tenant,
  link
}: {
  tenant: string
  link: string
}) {
  if (!tenant) {
    throw new Error('tenant is required')
  }
  if (!link || typeof link !== 'string') {
    throw new Error('link is required')
  }

  const imagePathParts = parseImagePathParts(link)
  const normalizedPath = imagePathParts
    ? buildItemImagePath({
      workspaceId: imagePathParts.workspaceId,
      dmsId: imagePathParts.dmsId,
      imageId: imagePathParts.imageId,
      fieldId: 'IMAGE'
    })
    : link
  const url = resolveTenantPlmUrl(tenant, normalizedPath)
  const imageResponse = await httpBinaryRequestWithMeta({
    method: 'GET',
    url,
    headers: {
      Accept: 'image/png,image/jpeg,image/gif,image/webp,image/*,*/*;q=0.8'
    },
    responseType: 'arraybuffer'
  })

  const buffer = imageResponse.data as ArrayBuffer
  const bytes = new Uint8Array(buffer)
  const mimeFromHeader = normalizeImageMimeFromContentType(imageResponse.contentType)
  if (!mimeFromHeader && looksLikeHtmlPayload(bytes)) {
    throw new Error('Image request returned HTML instead of binary image data.')
  }

  const mime = mimeFromHeader || inferImageMimeFromBytes(bytes)
  const base64 = arrayBufferToBase64(buffer)

  return {
    dataUrl: `data:${mime};base64,${base64}`
  }
}

export async function addItemGridRow({
  tenant,
  workspaceId,
  dmsId,
  viewId = 13,
  link,
  data
}: {
  tenant: string
  workspaceId?: string | number
  dmsId?: string | number
  viewId?: string | number
  link?: string
  data: Array<Record<string, unknown>>
}) {
  if (!tenant) {
    throw new Error('tenant is required')
  }
  if (!Array.isArray(data)) {
    throw new Error('data must be an array')
  }

  let itemPath: string
  let resolvedWorkspaceId: string | number | undefined = workspaceId

  if (link) {
    itemPath = link
    if (resolvedWorkspaceId === undefined || resolvedWorkspaceId === '') {
      const fromLink = link.split('/')[4]
      if (!fromLink) {
        throw new Error('Could not resolve workspace id from item link')
      }
      resolvedWorkspaceId = fromLink
    }
  } else {
    if (!workspaceId || !dmsId) {
      throw new Error('workspaceId and dmsId are required when link is not provided')
    }
    itemPath = `/api/v3/workspaces/${workspaceId}/items/${dmsId}`
  }

  const resolvedViewId = Number.isFinite(Number(viewId)) ? Number(viewId) : 13
  const itemBase = resolveTenantPlmUrl(tenant, itemPath)
  const url = `${itemBase.replace(/\/$/, '')}/views/${resolvedViewId}/rows`
  const rowData = buildGridRowPayload({
    tenant,
    workspaceId: resolvedWorkspaceId as string | number,
    viewId: resolvedViewId,
    data: data as unknown as Array<Record<string, any>>
  })

  const response = await httpRequest({
    method: 'POST',
    url,
    body: { rowData }
  })

  return response?.location ?? null
}

export async function updateItemGridRow({
  tenant,
  workspaceId,
  dmsId,
  viewId = 13,
  link,
  rowId,
  data
}: {
  tenant: string
  workspaceId?: string | number
  dmsId?: string | number
  viewId?: string | number
  link?: string
  rowId: string | number
  data: Array<Record<string, unknown>>
}) {
  if (!tenant) {
    throw new Error('tenant is required')
  }
  if (!rowId) {
    throw new Error('rowId is required')
  }
  if (!Array.isArray(data)) {
    throw new Error('data must be an array')
  }

  let itemPath: string
  let resolvedWorkspaceId: string | number | undefined = workspaceId

  if (link) {
    itemPath = link
    if (resolvedWorkspaceId === undefined || resolvedWorkspaceId === '') {
      const fromLink = link.split('/')[4]
      if (!fromLink) {
        throw new Error('Could not resolve workspace id from item link')
      }
      resolvedWorkspaceId = fromLink
    }
  } else {
    if (!workspaceId || !dmsId) {
      throw new Error('workspaceId and dmsId are required when link is not provided')
    }
    itemPath = `/api/v3/workspaces/${workspaceId}/items/${dmsId}`
  }

  const resolvedViewId = Number.isFinite(Number(viewId)) ? Number(viewId) : 13
  const itemBase = resolveTenantPlmUrl(tenant, itemPath)
  const url = `${itemBase.replace(/\/$/, '')}/views/${resolvedViewId}/rows/${rowId}`
  const rowData = buildGridRowPayload({
    tenant,
    workspaceId: resolvedWorkspaceId as string | number,
    viewId: resolvedViewId,
    data: data as unknown as Array<Record<string, any>>
  })

  const response = await httpRequest({
    method: 'PUT',
    url,
    body: { rowData }
  })

  if (!response || response === '') {
    return []
  }

  return Array.isArray(response.rows) ? response.rows : []
}

export async function removeItemGridRow({
  tenant,
  link
}: {
  tenant: string
  link: string
}) {
  if (!tenant) {
    throw new Error('tenant is required')
  }
  if (!link) {
    throw new Error('row link is required')
  }

  const url = resolveTenantPlmUrl(tenant, link)

  await httpRequest({
    method: 'DELETE',
    url
  })

  return { removed: true }
}
