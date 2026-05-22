import { httpRequest } from './http'
import { sortArray } from './plm.helper'
import { resolveTenantPlmUrl, tenantOrigin } from './plm.url'

type UnknownRecord = Record<string, unknown>

function isUnknownRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function resolveBomWorkspaceId(wsId: string | number | undefined, link: string | undefined): string | number {
  const fromLink = typeof link !== 'undefined' ? link.split('/')[4] : undefined
  const resolved = fromLink !== undefined && fromLink !== '' ? fromLink : wsId
  if (resolved === undefined || resolved === '') {
    throw new Error('workspace id is required')
  }
  return resolved
}

function httpStyleErrorFields(error: unknown): { status: number; message: string; data: unknown } {
  const rec = isUnknownRecord(error) ? error : null
  const statusRaw = rec && 'status' in rec ? rec.status : undefined
  const status = typeof statusRaw === 'number' && Number.isFinite(statusRaw) ? statusRaw : 500
  const data = rec && 'data' in rec ? rec.data : null
  return {
    status,
    message: error instanceof Error ? error.message : String(error ?? ''),
    data
  }
}

const VALIDATION_PAYLOAD_CACHE_MAX = 2000
const validationPayloadCache = new Map<string, unknown>()
const validationPayloadInFlight = new Map<string, Promise<unknown>>()

function getBomViewsListEndpoint(tenant: string, workspaceId: string | number): string {
  return `${tenantOrigin(tenant)}/api/v3/workspaces/${workspaceId}/views/5`
}

function extractBomViewsFromListResponse(response: unknown): unknown[] {
  const root = isUnknownRecord(response) ? response : null
  const dataUnknown =
    root && isUnknownRecord(root.data)
      ? root.data
      : root
  const data = dataUnknown && typeof dataUnknown === 'object' ? (dataUnknown as UnknownRecord) : null
  const fromRoot = Array.isArray(data?.bomViews) ? data.bomViews : []
  if (fromRoot.length > 0) return fromRoot
  const nestedRaw = data && isUnknownRecord(data.data) ? data.data : null
  const fromNested = Array.isArray(nestedRaw?.bomViews) ? nestedRaw.bomViews : []
  if (fromNested.length > 0) return fromNested
  return Array.isArray(root?.bomViews) ? root.bomViews : []
}

function parseBomViewDefIdFromLink(value: unknown): number | null {
  const text = String(value || '').trim()
  if (!text) return null
  const match = /\/viewdef\/(\d+)(?:[/?#]|$)/i.exec(text)
  if (!match) return null
  const parsed = Number(match[1])
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.floor(parsed)
}

function parseBomViewDefId(entry: unknown): number | null {
  if (!entry || typeof entry !== 'object') return null
  const rec = entry as UnknownRecord

  const linkCandidates: string[] = []
  if (typeof rec.link === 'string') linkCandidates.push(rec.link)
  if (typeof rec.__self__ === 'string') linkCandidates.push(rec.__self__)
  if (rec.__self__ && typeof rec.__self__ === 'object') {
    const selfRec = rec.__self__ as UnknownRecord
    if (typeof selfRec.link === 'string') linkCandidates.push(selfRec.link)
    if (typeof selfRec.urn === 'string') linkCandidates.push(selfRec.urn)
  }
  if (typeof rec.urn === 'string') linkCandidates.push(rec.urn)

  for (const candidate of linkCandidates) {
    const parsed = parseBomViewDefIdFromLink(candidate)
    if (parsed !== null) return parsed
  }

  const directCandidates = [
    rec.viewDefId,
    rec.viewdefid,
    rec.viewdefId,
    rec.id
  ]

  for (const candidate of directCandidates) {
    const parsed = Number(candidate)
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed)
  }

  return null
}

function buildBomViewDefLink(workspaceId: string | number, viewDefId: number): string {
  return `/api/v3/workspaces/${workspaceId}/views/5/viewdef/${viewDefId}`
}

function resolveBomViewLink(entry: unknown): string {
  if (!entry || typeof entry !== 'object') return ''
  const rec = entry as UnknownRecord
  if (typeof rec.link === 'string' && rec.link.trim()) return rec.link.trim()
  if (rec.__self__ && typeof rec.__self__ === 'object') {
    const link = String((rec.__self__ as UnknownRecord).link || '').trim()
    if (link) return link
  }
  if (typeof rec.__self__ === 'string' && rec.__self__.trim()) return rec.__self__.trim()
  return ''
}

function normalizeBomViews(entries: unknown[], workspaceId: string | number): UnknownRecord[] {
  const normalized: UnknownRecord[] = []
  const seen = new Set<string>()

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    if ((entry as UnknownRecord).deleted === true) continue
    const viewDefId = parseBomViewDefId(entry)
    const fallbackLink = viewDefId ? buildBomViewDefLink(workspaceId, viewDefId) : ''
    const resolvedLink = resolveBomViewLink(entry) || fallbackLink
    const key = viewDefId ? `id:${viewDefId}` : `link:${resolvedLink}`
    if (!resolvedLink || seen.has(key)) continue
    seen.add(key)

    normalized.push({
      id: viewDefId,
      name: String((entry as UnknownRecord).name || (entry as UnknownRecord).title || '').trim(),
      isDefault: Boolean((entry as UnknownRecord).isDefault),
      link: resolvedLink,
      urn: String(
        (entry as UnknownRecord).urn
          || ((entry as UnknownRecord).__self__ && typeof (entry as UnknownRecord).__self__ === 'object'
            ? ((entry as UnknownRecord).__self__ as UnknownRecord).urn || ''
            : '')
          || ''
      ).trim()
    })
  }

  return normalized
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  if (!Array.isArray(items) || items.length === 0) return []
  const safeConcurrency = Math.max(1, Math.min(Number(concurrency) || 1, items.length))
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await worker(items[currentIndex], currentIndex)
    }
  }

  await Promise.all(Array.from({ length: safeConcurrency }, () => runWorker()))
  return results
}

function extractFieldsFromResponsePayload(payload: unknown): unknown[] {
  if (!payload) return []

  const payloadRec = isUnknownRecord(payload) ? payload : null
  const dataUnknown =
    payloadRec && isUnknownRecord(payloadRec.data)
      ? payloadRec.data
      : payload
  const data =
    dataUnknown && typeof dataUnknown === 'object' && !Array.isArray(dataUnknown)
      ? (dataUnknown as UnknownRecord)
      : null

  if (data) {
    if (Array.isArray(data.fields)) return data.fields
    if (Array.isArray(data.viewfields)) return data.viewfields
    if (Array.isArray(data.viewFields)) return data.viewFields
  }
  if (Array.isArray(dataUnknown)) return dataUnknown
  return []
}

function resolveValidatorsLink(field: unknown): string {
  if (!field || typeof field !== 'object') return ''
  const rec = field as UnknownRecord
  if (typeof rec.validators === 'string' && rec.validators.trim()) return rec.validators.trim()
  if (rec.validators && typeof rec.validators === 'object') {
    const link = String((rec.validators as UnknownRecord).link || '').trim()
    if (link) return link
  }
  return ''
}

function payloadHasRequiredValidator(value: unknown): boolean {
  if (!value) return false
  if (Array.isArray(value)) return value.some((entry: unknown) => payloadHasRequiredValidator(entry))
  if (typeof value !== 'object') return String(value).trim().toLowerCase() === 'required'

  const rec = value as UnknownRecord
  const validatorName = String(rec.validatorName || rec.name || '').trim().toLowerCase()
  if (validatorName === 'required') return true
  if (Array.isArray(rec.validators)) {
    return rec.validators.some((entry: unknown) => payloadHasRequiredValidator(entry))
  }
  return false
}

function normalizeValidationCacheKey(tenant: string, link: unknown): string {
  const raw = String(link || '').trim()
  if (!raw) return ''

  if (raw.startsWith('http')) {
    try {
      const parsed = new URL(raw)
      return `${tenant}|${parsed.pathname}${parsed.search}`
    } catch {
      return `${tenant}|${raw}`
    }
  }

  return `${tenant}|${raw}`
}

function setValidationPayloadCache(cacheKey: string, payload: unknown): void {
  if (!cacheKey) return
  if (validationPayloadCache.has(cacheKey)) {
    validationPayloadCache.delete(cacheKey)
  }
  validationPayloadCache.set(cacheKey, payload)

  if (validationPayloadCache.size > VALIDATION_PAYLOAD_CACHE_MAX) {
    const oldestKey = validationPayloadCache.keys().next().value
    if (oldestKey) validationPayloadCache.delete(oldestKey)
  }
}

async function fetchValidationPayloadCached(tenant: string, link: unknown): Promise<unknown> {
  const cacheKey = normalizeValidationCacheKey(tenant, link)
  if (!cacheKey) return null

  if (validationPayloadCache.has(cacheKey)) {
    return validationPayloadCache.get(cacheKey)
  }

  if (validationPayloadInFlight.has(cacheKey)) {
    return validationPayloadInFlight.get(cacheKey)
  }

  const requestPromise = (async () => {
    try {
      const response = await httpRequest({
        method: 'GET',
        url: resolveTenantPlmUrl(tenant, String(link))
      })
      setValidationPayloadCache(cacheKey, response)
      return response
    } catch {
      return null
    } finally {
      validationPayloadInFlight.delete(cacheKey)
    }
  })()

  validationPayloadInFlight.set(cacheKey, requestPromise)
  return requestPromise
}

async function hydrateRequiredValidatorsForFieldsResponse(tenant: string, payload: unknown): Promise<unknown> {
  const fields = extractFieldsFromResponsePayload(payload)
  if (!Array.isArray(fields) || fields.length === 0) return payload

  const validationDescriptors: Array<{ cacheKey: string; validatorsLink: string }> = []
  const seenValidationKeys = new Set<string>()

  for (const field of fields) {
    const validatorsLink = resolveValidatorsLink(field)
    if (!validatorsLink) continue
    const cacheKey = normalizeValidationCacheKey(tenant, validatorsLink)
    if (!cacheKey || seenValidationKeys.has(cacheKey)) continue
    seenValidationKeys.add(cacheKey)
    validationDescriptors.push({ cacheKey, validatorsLink })
  }

  if (validationDescriptors.length === 0) return payload

  const validationEntries = await mapWithConcurrency(
    validationDescriptors,
    10,
    async ({ cacheKey, validatorsLink }: { cacheKey: string; validatorsLink: string }) => {
      const response = await fetchValidationPayloadCached(tenant, validatorsLink)
      return [cacheKey, response] as [string, unknown]
    }
  )

  const validationByLink = new Map<string, unknown>(validationEntries)

  for (const field of fields) {
    const fieldRec = field as UnknownRecord
    const validatorsLink = resolveValidatorsLink(field)
    if (!validatorsLink) {
      fieldRec.required = Boolean(fieldRec.required)
      continue
    }

    const cacheKey = normalizeValidationCacheKey(tenant, validatorsLink)
    const validationPayload = validationByLink.get(cacheKey)
    const validations = Array.isArray(validationPayload)
      ? validationPayload
      : isUnknownRecord(validationPayload) && Array.isArray(validationPayload.data)
        ? validationPayload.data
        : []

    fieldRec.validations = validations
    fieldRec.required = Boolean(fieldRec.required) || payloadHasRequiredValidator(validations)
  }

  return payload
}

export async function getBomViews({
  tenant,
  wsId,
  link
}: {
  tenant: string
  wsId?: string | number
  link?: string
}) {
  if (!tenant) {
    throw new Error('tenant is required')
  }

  const resolvedWorkspaceId = resolveBomWorkspaceId(wsId, link)
  const viewsUrl = getBomViewsListEndpoint(tenant, resolvedWorkspaceId)

  try {
    const viewsResponse = await httpRequest({
      method: 'GET',
      url: viewsUrl
    })

    const result = normalizeBomViews(
      extractBomViewsFromListResponse(viewsResponse),
      resolvedWorkspaceId
    )
    result.sort((left, right) => Number(left?.id || 0) - Number(right?.id || 0))

    const vr = viewsResponse as UnknownRecord
    const priorData =
      vr && isUnknownRecord(vr.data)
        ? vr.data
        : {}
    return {
      ...vr,
      data: {
        ...priorData,
        bomViews: result,
        count: result.length
      }
    }
  } catch (error: unknown) {
    if (isUnknownRecord(error) && 'response' in error) return error.response
    return error
  }
}

export async function getBomViewsAndFields({
  tenant,
  wsId,
  link
}: {
  tenant: string
  wsId?: string | number
  link?: string
}) {
  if (!tenant) {
    throw new Error('tenant is required')
  }

  const resolvedWorkspaceId = resolveBomWorkspaceId(wsId, link)
  const viewsUrl = getBomViewsListEndpoint(tenant, resolvedWorkspaceId)

  try {
    const viewsResponse = await httpRequest({
      method: 'GET',
      url: viewsUrl
    })

    const listedViews = normalizeBomViews(
      extractBomViewsFromListResponse(viewsResponse),
      resolvedWorkspaceId
    )

    const result = await mapWithConcurrency(
      listedViews,
      10,
      async (view: UnknownRecord) => {
        let fields = null
        const viewFieldsLink = String(view.link || '').endsWith('/fields')
          ? String(view.link || '')
          : `${String(view.link || '')}/fields`

        try {
          fields = await httpRequest({
            method: 'GET',
            url: resolveTenantPlmUrl(tenant, viewFieldsLink)
          })
          fields = await hydrateRequiredValidatorsForFieldsResponse(tenant, fields)
        } catch {
          fields = null
        }

        const id = parseBomViewDefId(view || {})
        const linkValue = resolveBomViewLink(view || {})
        const urnValue = String(view.urn || '').trim()

        return {
          data: {
            id,
            name: String(view.name || '').trim(),
            isDefault: view.isDefault === true,
            link: linkValue,
            urn: urnValue,
            __self__: {
              link: linkValue,
              urn: urnValue
            }
          },
          fields
        }
      }
    )

    result.sort((left, right) => Number(left?.data?.id || 0) - Number(right?.data?.id || 0))

    return { data: result }
  } catch (error: unknown) {
    const { status, message, data } = httpStyleErrorFields(error)
    return { status, message, data }
  }
}

export async function getBomViewFields({
  tenant,
  link,
  wsId,
  viewId
}: {
  tenant: string
  link?: string
  wsId?: string | number
  viewId?: string | number
}) {
  if (!tenant) {
    throw new Error('tenant is required')
  }

  let path = typeof link !== 'undefined' ? String(link) : `/api/v3/workspaces/${wsId}/views/5/viewdef/${viewId}`
  if (!path.endsWith('/fields')) {
    path = `${path}/fields`
  }
  const url = resolveTenantPlmUrl(tenant, path)

  try {
    let response = await httpRequest({
      method: 'GET',
      url
    })
    response = await hydrateRequiredValidatorsForFieldsResponse(tenant, response)
    return response
  } catch (error: unknown) {
    const { status, message, data } = httpStyleErrorFields(error)
    return { status, message, data }
  }
}

export async function fetchBomLinkableItems({
  tenant,
  workspaceId,
  currentItemId,
  viewId,
  relatedWorkspaceId,
  search = '',
  sort = '',
  limit = 100,
  offset = 0
}: {
  tenant: string
  workspaceId: string | number
  currentItemId: string | number
  viewId: string | number
  relatedWorkspaceId?: string | number
  search?: string
  sort?: string
  limit?: number
  offset?: number
}) {
  if (!tenant) {
    throw new Error('tenant is required')
  }
  if (!workspaceId || !currentItemId || !viewId) {
    throw new Error('workspaceId, currentItemId, and viewId are required')
  }

  const query = new URLSearchParams()
  query.set('limit', String(limit))
  query.set('offset', String(offset))
  if (relatedWorkspaceId) query.set('relatedWorkspaceId', String(relatedWorkspaceId))
  if (search) query.set('search', String(search))
  if (sort) query.set('sort', String(sort))

  const url =
    `${tenantOrigin(tenant)}/api/v3/workspaces/${workspaceId}/items/${currentItemId}/views/${viewId}/linkable-items?${query.toString()}`

  const response = await httpRequest({
    method: 'GET',
    url
  })

  if (response.data === '') {
    response.data = { items: [] }
  }

  if (!Array.isArray(response?.data?.items) && Array.isArray(response?.data?.linkableItems)) {
    response.data.items = response.data.linkableItems
  }

  return response
}

export async function getBom({
  tenant,
  wsId,
  dmsId,
  link,
  depth,
  revisionBias,
  effectiveDate,
  viewId,
  getBOMPartsList
}: {
  tenant: string
  wsId?: string | number
  dmsId?: string | number
  link?: string
  depth?: number
  revisionBias?: string
  effectiveDate?: string | number
  viewId?: string | number
  getBOMPartsList?: (payload: unknown, bomViewFieldsPayload: unknown, arg: unknown) => unknown
}) {
  if (!tenant) {
    throw new Error('tenant is required')
  }

  const resolvedRevisionBias = typeof revisionBias !== 'undefined' ? revisionBias : 'release'
  const resolvedDepth = typeof depth !== 'undefined' ? depth : 10
  const resolvedGetPartsList = typeof getBOMPartsList !== 'undefined' ? getBOMPartsList : false
  const resolvedLink = typeof link !== 'undefined' ? link : `/api/v3/workspaces/${wsId}/items/${dmsId}`
  const rootId = typeof link !== 'undefined' ? String(link).split('/')[6] : dmsId

  const bomBase = resolveTenantPlmUrl(tenant, resolvedLink)
  let url =
    `${bomBase.replace(/\/$/, '')}` +
    `/bom?depth=${resolvedDepth}&revisionBias=${resolvedRevisionBias}&rootId=${rootId}`
  if (typeof viewId !== 'undefined') url += `&viewDefId=${viewId}`
  if (typeof effectiveDate !== 'undefined') url += `&effectiveDate=${effectiveDate}`

  const response = await httpRequest({
    method: 'GET',
    url,
    headers: {
      Accept: 'application/vnd.autodesk.plm.bom.bulk+json'
    }
  })

  let payload =
    response && typeof response === 'object' && response.data && typeof response.data === 'object'
      ? response.data
      : response

  if (payload && typeof payload === 'object' && Array.isArray(payload.edges)) {
    sortArray(payload.edges, 'itemNumber', '')
    sortArray(payload.edges, 'depth', '')
  }

  if (resolvedGetPartsList && typeof getBOMPartsList === 'function') {
    const workspaceId = resolvedLink.split('/')[4]
    const bomViewFields = await httpRequest({
      method: 'GET',
      url: `${tenantOrigin(tenant)}/api/v3/workspaces/${workspaceId}/views/5/viewdef/${viewId}/fields`
    })
    const bomViewFieldsPayload =
      bomViewFields && typeof bomViewFields === 'object' && Array.isArray(bomViewFields.data)
        ? bomViewFields.data
        : bomViewFields

    if (payload && typeof payload === 'object') {
      payload.bomPartsList = getBOMPartsList(
        payload,
        bomViewFieldsPayload,
        null
      )
    }
  }

  if (response && typeof response === 'object' && response.data && typeof response.data === 'object') {
    response.data = payload
    return response
  }

  return { data: payload }
}

export async function getBomFlat({
  tenant,
  wsId,
  dmsId,
  rootId,
  revisionBias,
  effectiveDate,
  viewId
}: {
  tenant: string
  wsId: string | number
  dmsId: string | number
  rootId?: string | number
  revisionBias?: string
  effectiveDate?: string | number
  viewId?: string | number
}) {
  if (!tenant) {
    throw new Error('tenant is required')
  }
  if (!wsId) {
    throw new Error('wsId is required')
  }
  if (!dmsId) {
    throw new Error('dmsId is required')
  }

  const query = new URLSearchParams()
  query.set('revisionBias', typeof revisionBias !== 'undefined' ? String(revisionBias) : 'release')
  query.set('rootId', typeof rootId !== 'undefined' ? String(rootId) : String(dmsId))
  if (typeof effectiveDate !== 'undefined' && String(effectiveDate).trim()) {
    query.set('effectiveDate', String(effectiveDate).trim())
  }
  if (typeof viewId !== 'undefined' && String(viewId).trim()) {
    query.set('viewDefId', String(viewId).trim())
  }

  return httpRequest({
    method: 'GET',
    url: `${tenantOrigin(tenant)}/api/v3/workspaces/${wsId}/items/${dmsId}/bom-items?${query.toString()}`,
    headers: {
      Accept: 'application/vnd.autodesk.plm.bom.flat.bulk+json'
    }
  })
}

export async function addBomItem({
  tenant,
  wsIdParent,
  wsIdChild,
  dmsIdParent,
  dmsIdChild,
  linkParent,
  linkChild,
  quantity,
  pinned,
  number,
  fields
}: {
  tenant: string
  wsIdParent?: string | number
  wsIdChild?: string | number
  dmsIdParent?: string | number
  dmsIdChild?: string | number
  linkParent?: string
  linkChild?: string
  quantity?: string | number
  pinned?: string | boolean
  number?: string | number
  fields?: Array<{ link: string; value: unknown }>
}) {
  if (!tenant) {
    throw new Error('tenant is required')
  }

  const resolvedLinkParent = typeof linkParent !== 'undefined' ? linkParent : `/api/v3/workspaces/${wsIdParent}/items/${dmsIdParent}`
  const resolvedLinkChild = typeof linkChild !== 'undefined' ? linkChild : `/api/v3/workspaces/${wsIdChild}/items/${dmsIdChild}`
  const isPinned = typeof pinned === 'undefined' ? false : String(pinned).toLowerCase() === 'true'
  const resolvedQuantity = typeof quantity === 'undefined' ? 1 : quantity
  const params: UnknownRecord = {
    quantity: Number(resolvedQuantity),
    isPinned,
    item: {
      link: resolvedLinkChild
    }
  }

  if (typeof number !== 'undefined') {
    params.itemNumber = Number(number)
  }

  if (typeof fields !== 'undefined' && fields.length > 0) {
    params.fields = []
    for (const field of fields) {
      ;(params.fields as UnknownRecord[]).push({
        metaData: {
          link: field.link
        },
        value: field.value
      })
    }
  }

  try {
    const parentBase = resolveTenantPlmUrl(tenant, resolvedLinkParent)
    const response = await httpRequest({
      method: 'POST',
      url: `${parentBase.replace(/\/$/, '')}/bom-items`,
      body: params
    })

    const resolvedStatus = Number(response?.status)
    return {
      data: true,
      status: Number.isFinite(resolvedStatus) ? resolvedStatus : 200
    }
  } catch (error: unknown) {
    const { status, message, data } = httpStyleErrorFields(error)
    return { status, message, data }
  }
}

export async function getBomV1({
  tenant,
  wsId,
  dmsId,
  depth
}: {
  tenant: string
  wsId: string | number
  dmsId: string | number
  depth?: number
}) {
  if (!tenant) {
    throw new Error('tenant is required')
  }
  if (!wsId) {
    throw new Error('wsId is required')
  }
  if (!dmsId) {
    throw new Error('dmsId is required')
  }

  const resolvedDepth = typeof depth !== 'undefined' ? depth : 100

  return httpRequest({
    method: 'GET',
    url: `${tenantOrigin(tenant)}/api/rest/v1/workspaces/${wsId}/items/${dmsId}/boms?depth=${resolvedDepth}`,
    headers: {
      Accept: 'application/json'
    }
  })
}

export async function updateBomItem({
  tenant,
  wsIdParent,
  wsIdChild,
  dmsIdParent,
  dmsIdChild,
  linkParent,
  linkChild,
  edgeId,
  quantity,
  pinned,
  number,
  fields
}: {
  tenant: string
  wsIdParent?: string | number
  wsIdChild?: string | number
  dmsIdParent?: string | number
  dmsIdChild?: string | number
  linkParent?: string
  linkChild?: string
  edgeId: string | number
  quantity?: string | number
  pinned?: string | boolean
  number?: string | number
  fields?: Array<{ link: string; value: unknown }>
}) {
  if (!tenant) {
    throw new Error('tenant is required')
  }

  const resolvedLinkParent = typeof linkParent !== 'undefined' ? linkParent : `/api/v3/workspaces/${wsIdParent}/items/${dmsIdParent}`
  const resolvedLinkChild = typeof linkChild !== 'undefined' ? linkChild : `/api/v3/workspaces/${wsIdChild}/items/${dmsIdChild}`
  const isPinned = typeof pinned === 'undefined' ? false : String(pinned).toLowerCase() === 'true'
  const resolvedQuantity = typeof quantity === 'undefined' ? 1 : quantity
  const params: UnknownRecord = {
    quantity: Number(resolvedQuantity),
    isPinned,
    item: {
      link: resolvedLinkChild
    }
  }

  if (typeof number !== 'undefined') {
    params.itemNumber = Number(number)
  }

  if (typeof fields !== 'undefined' && fields.length > 0) {
    params.fields = []
    for (const field of fields) {
      ;(params.fields as UnknownRecord[]).push({
        metaData: {
          link: field.link
        },
        value: field.value
      })
    }
  }

  try {
    const parentBase = resolveTenantPlmUrl(tenant, resolvedLinkParent)
    const response = await httpRequest({
      method: 'PATCH',
      url: `${parentBase.replace(/\/$/, '')}/bom-items/${edgeId}`,
      body: params
    })

    const resolvedStatus = Number(response?.status)
    return {
      data: true,
      status: Number.isFinite(resolvedStatus) ? resolvedStatus : 200
    }
  } catch (error: unknown) {
    const { status, message, data } = httpStyleErrorFields(error)
    return { status, message, data }
  }
}

export async function removeBomItem({
  tenant,
  wsId,
  dmsId,
  link,
  edgeId,
  edgeLink
}: {
  tenant: string
  wsId?: string | number
  dmsId?: string | number
  link?: string
  edgeId: string | number
  edgeLink?: string
}) {
  if (!tenant) {
    throw new Error('tenant is required')
  }

  let resolvedEdgeLink = edgeLink
  if (typeof resolvedEdgeLink === 'undefined') {
    resolvedEdgeLink = typeof link !== 'undefined' ? link : `/api/v3/workspaces/${wsId}/items/${dmsId}`
    resolvedEdgeLink += `/bom-items/${edgeId}`
  }

  const url = resolveTenantPlmUrl(tenant, resolvedEdgeLink)

  try {
    const response = await httpRequest({
      method: 'DELETE',
      url
    })

    const resolvedStatus = Number(response?.status)
    return { data: true, status: Number.isFinite(resolvedStatus) ? resolvedStatus : 204 }
  } catch (error: unknown) {
    const { status, message, data } = httpStyleErrorFields(error)
    return { status, message, data }
  }
}
