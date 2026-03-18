import { httpRequest } from './http'

const APS_BASE = (tenant: string) => `https://${tenant}.autodeskplm360.net`

function normalizeTenant(tenant: unknown): string {
  return String(tenant || '').trim().toLowerCase()
}

function normalizeApiJsonPath(tenant: unknown, path: unknown): string {
  const normalizedTenant = normalizeTenant(tenant)
  const rawPath = String(path || '').trim()
  if (!normalizedTenant) throw new Error('tenant is required')
  if (!rawPath) throw new Error('path is required')

  if (/^https?:\/\//i.test(rawPath)) {
    const url = new URL(rawPath)
    const expectedHost = `${normalizedTenant}.autodeskplm360.net`
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== expectedHost) {
      throw new Error('path must target the current tenant host')
    }
    if (!/^\/api\/v3\//i.test(url.pathname)) {
      throw new Error('Only /api/v3 JSON endpoints are allowed')
    }
    return `${url.pathname}${url.search}`
  }

  const normalizedPath = rawPath.startsWith('/') ? rawPath : `/${rawPath}`
  if (!/^\/api\/v3\//i.test(normalizedPath)) {
    throw new Error('Only /api/v3 JSON endpoints are allowed')
  }
  return normalizedPath
}

export async function fetchApiJson({
  tenant,
  path
}: {
  tenant: string
  path: string
}): Promise<any> {
  const normalizedTenant = normalizeTenant(tenant)
  const normalizedPath = normalizeApiJsonPath(normalizedTenant, path)
  return httpRequest({
    method: 'GET',
    url: `${APS_BASE(normalizedTenant)}${normalizedPath}`
  })
}

export async function getAttachments({
  tenant,
  wsId,
  dmsId,
  link,
  filenamesIn = [],
  filenamesEx = []
}: {
  tenant: string
  wsId?: string | number
  dmsId?: string | number
  link?: string
  filenamesIn?: Array<string>
  filenamesEx?: Array<string>
}): Promise<any> {
  if (!tenant) throw new Error('tenant is required')
  if (!link && (!wsId || !dmsId)) throw new Error('either link or wsId + dmsId are required')

  const itemPath = link || `/api/v3/workspaces/${wsId}/items/${dmsId}`
  const itemUrl = itemPath.startsWith('http') ? itemPath : `${APS_BASE(tenant)}${itemPath}`
  const url = itemUrl.endsWith('/attachments') ? `${itemUrl}?asc=name` : `${itemUrl}/attachments?asc=name`

  if (!Array.isArray(filenamesIn)) filenamesIn = [filenamesIn]
  if (!Array.isArray(filenamesEx)) filenamesEx = [filenamesEx]

  const response = await httpRequest({
    method: 'GET',
    url,
    headers: {
      Accept: 'application/vnd.autodesk.plm.attachments.bulk+json'
    }
  })

  const attachments = []

  if (response && response !== '') {
    for (const attachment of response.attachments || []) {
      if (attachment?.type && !attachment.type.extension) {
        attachment.type.extension = ''
      }

      const ext = attachment.type?.extension || ''
      const fileName = (attachment.resourceName + ext).toLowerCase()

      let included = filenamesIn.length === 0
        || filenamesIn.some((value) => fileName.includes(String(value).toLowerCase()))

      if (included && filenamesEx.length > 0) {
        included = !filenamesEx.some((value) => fileName.includes(String(value).toLowerCase()))
      }

      if (included) attachments.push(attachment)
    }
  }

  return {
    data: attachments,
    status: 200
  }
}

export async function searchBulk({
  tenant,
  wsId,
  query,
  limit,
  offset,
  bulk,
  page,
  revision,
  sort
}: {
  tenant: string
  wsId?: string | number
  query: string
  limit?: string | number
  offset?: string | number
  bulk?: boolean
  page?: string
  revision?: string
  sort?: string
}): Promise<any> {
  if (!tenant) {
    throw new Error('tenant is required')
  }

  const resolvedLimit = typeof limit === 'undefined' ? 100 : limit
  const resolvedOffset = typeof offset === 'undefined' ? 0 : offset
  const resolvedBulk = typeof bulk === 'undefined' ? true : bulk
  const resolvedPage = typeof page === 'undefined' ? '' : page
  const resolvedRevision = typeof revision === 'undefined' ? '1' : revision
  const resolvedSort = typeof sort === 'undefined' ? '' : String(sort).trim()

  let url =
    `${APS_BASE(tenant)}/api/v3/search-results?limit=${resolvedLimit}` +
    `&offset=${resolvedOffset}` +
    `&query=${query}` +
    `&revision=${resolvedRevision}`

  if (resolvedPage !== '') {
    url += `&page=${resolvedPage}`
  }

  if (resolvedSort) {
    url += `&sort=${encodeURIComponent(resolvedSort)}`
  }

  if (typeof wsId !== 'undefined') {
    url += `+AND+(workspaceId%3D${wsId})`
  }

  const headers: Record<string, string> = {}
  if (resolvedBulk) {
    headers.Accept = 'application/vnd.autodesk.plm.items.bulk+json'
  }

  try {
    const response = await httpRequest({
      method: 'GET',
      url,
      headers
    })

    if (response.data === '') {
      response.data = { items: [] }
    }

    return response
  } catch (error: any) {
    return error?.response ?? error
  }
}

export async function getWorkspaces({
  tenant,
  offset = 0,
  limit = 250
}: {
  tenant: string
  offset?: string | number
  limit?: string | number
}): Promise<any> {
  if (!tenant) {
    throw new Error('tenant is required')
  }

  try {
    return await httpRequest({
      method: 'GET',
      url: `${APS_BASE(tenant)}/api/v3/workspaces?offset=${offset}&limit=${limit}`
    })
  } catch (error: any) {
    return error?.response ?? error
  }
}

export async function getPermissions({
  tenant,
  wsId,
  dmsId,
  link
}: {
  tenant: string
  wsId?: string | number
  dmsId?: string | number
  link?: string
}): Promise<any> {
  if (!tenant) {
    throw new Error('tenant is required')
  }

  let itemPath

  if (link) {
    itemPath = link
  } else {
    if (!wsId) {
      throw new Error('wsId is required when link is not provided')
    }

    itemPath = `/api/v3/workspaces/${wsId}`

    if (typeof dmsId !== 'undefined') {
      itemPath += `/items/${dmsId}`
    }
  }

  try {
    const response = await httpRequest({
      method: 'GET',
      url: `${APS_BASE(tenant)}${itemPath}/users/@me/permissions`
    })

    return {
      data: response?.permissions ?? response?.data?.permissions ?? [],
      status: response?.status
    }
  } catch (error: any) {
    return error?.response ?? error
  }
}
