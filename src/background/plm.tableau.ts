import { httpRequest } from './http'

const APS_BASE = (tenant: string) => `https://${tenant}.autodeskplm360.net`

export async function getTableauList({
  tenant,
  wsId
}: {
  tenant: string
  wsId: string | number
}): Promise<unknown> {
  if (!tenant) throw new Error('tenant is required')
  if (!wsId) throw new Error('wsId is required')
  return httpRequest({
    method: 'GET',
    url: `${APS_BASE(tenant)}/api/v3/workspaces/${wsId}/tableaus`,
    headers: { Accept: 'application/json' }
  })
}

export async function getTableauListMeta({
  tenant,
  wsId
}: {
  tenant: string
  wsId: string | number
}): Promise<unknown> {
  if (!tenant) throw new Error('tenant is required')
  if (!wsId) throw new Error('wsId is required')
  return httpRequest({
    method: 'GET',
    url: `${APS_BASE(tenant)}/api/v3/workspaces/${wsId}/tableaus`,
    headers: { Accept: 'application/vnd.autodesk.plm.meta+json' }
  })
}

export async function getTableau({
  tenant,
  wsId,
  tableauId
}: {
  tenant: string
  wsId: string | number
  tableauId: string | number
}): Promise<unknown> {
  if (!tenant) throw new Error('tenant is required')
  if (!wsId) throw new Error('wsId is required')
  if (!tableauId) throw new Error('tableauId is required')
  return httpRequest({
    method: 'GET',
    url: `${APS_BASE(tenant)}/api/v3/workspaces/${wsId}/tableaus/${tableauId}`,
    headers: { Accept: 'application/vnd.autodesk.plm.meta+json' }
  })
}

export async function createTableau({
  tenant,
  wsId,
  body
}: {
  tenant: string
  wsId: string | number
  body: Record<string, unknown>
}): Promise<unknown> {
  if (!tenant) throw new Error('tenant is required')
  if (!wsId) throw new Error('wsId is required')
  return httpRequest({
    method: 'POST',
    url: `${APS_BASE(tenant)}/api/v3/workspaces/${wsId}/tableaus`,
    body,
    headers: { 'Content-Type': 'application/vnd.autodesk.plm.meta+json' }
  })
}

export async function updateTableau({
  tenant,
  wsId,
  tableauId,
  body
}: {
  tenant: string
  wsId: string | number
  tableauId: string | number
  body: Record<string, unknown>
}): Promise<unknown> {
  if (!tenant) throw new Error('tenant is required')
  if (!wsId) throw new Error('wsId is required')
  if (!tableauId) throw new Error('tableauId is required')
  return httpRequest({
    method: 'PUT',
    url: `${APS_BASE(tenant)}/api/v3/workspaces/${wsId}/tableaus/${tableauId}`,
    body,
    headers: { 'Content-Type': 'application/vnd.autodesk.plm.meta+json' }
  })
}

export async function deleteTableau({
  tenant,
  wsId,
  tableauId
}: {
  tenant: string
  wsId: string | number
  tableauId: string | number
}): Promise<unknown> {
  if (!tenant) throw new Error('tenant is required')
  if (!wsId) throw new Error('wsId is required')
  if (!tableauId) throw new Error('tableauId is required')
  return httpRequest({
    method: 'DELETE',
    url: `${APS_BASE(tenant)}/api/v3/workspaces/${wsId}/tableaus/${tableauId}`
  })
}
