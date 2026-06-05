import { ensureApsToken } from './apsAuth'

type OutputType = 'pdf' | 'step' | 'stl' | 'iges' | 'obj' | 'dwg' | 'thumbnail' | 'fbx' | 'svf' | 'svf2'

const AUTODESK_MODEL_DERIVATIVE_BASE_URL =
  'https://developer.api.autodesk.com/modelderivative/v2/designdata'

const MFG_GRAPHQL_PUBLIC_URL = 'https://developer.api.autodesk.com/mfg/v3/graphql/public'

/** Only operations defined here may run; callers send `operation` + `variables`, never a raw `query` string. */
const MFG_GRAPHQL_GET_MODEL_SOURCE_FILE = `
query GetModelSourceFile($modelId: ID!) {
  model(modelId: $modelId) {
    id
    designItem {
      id
      name
      extensionType
      mimeType
      size
      fusionWebUrl
    }
  }
}
`.trim()

const MFG_GRAPHQL_MODEL_ID_MAX_LENGTH = 4096

function isMfgGraphqlVariablesObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function variablesForGetModelSourceFile(variables: unknown): { modelId: string } {
  if (!isMfgGraphqlVariablesObject(variables)) {
    throw new Error('fetchMfgGraphQL: variables must be a plain object')
  }
  const keys = Object.keys(variables).sort()
  if (keys.length !== 1 || keys[0] !== 'modelId') {
    throw new Error('fetchMfgGraphQL: variables for this operation must be { modelId } only')
  }
  const raw = variables.modelId
  if (typeof raw !== 'string') {
    throw new Error('fetchMfgGraphQL: modelId must be a string')
  }
  const modelId = raw.trim()
  if (!modelId) {
    throw new Error('fetchMfgGraphQL: modelId is required')
  }
  if (modelId.length > MFG_GRAPHQL_MODEL_ID_MAX_LENGTH) {
    throw new Error('fetchMfgGraphQL: modelId exceeds maximum length')
  }
  return { modelId }
}

function toBase64Url(value: string): string {
  return btoa(value)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

/**
 * PLM `/designs` returns `encodedDesignUrn` — pass it through unchanged to APS (see Fusion-connected FM).
 * Only raw `urn:...` strings from other sources are base64url-encoded for the MD path segment.
 */
function normalizeUrn(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim() : ''
  if (!value) {
    throw new Error('Model Derivative source URN is required')
  }
  return value.startsWith('urn:') ? toBase64Url(value) : value
}

function normalizeOutputType(raw: unknown): OutputType {
  const value = String(raw || '').trim().toLowerCase()
  const valid: OutputType[] = ['pdf', 'step', 'stl', 'iges', 'obj', 'dwg', 'thumbnail', 'fbx', 'svf', 'svf2']
  if (!valid.includes(value as OutputType)) {
    throw new Error(`Unsupported outputType: ${value || '(empty)'}`)
  }
  return value as OutputType
}

const NUMERIC_ADVANCED_KEYS = new Set(['width', 'height'])

function coerceAdvancedValues(adv: Record<string, string>): Record<string, string | number> {
  const result: Record<string, string | number> = {}
  for (const [k, v] of Object.entries(adv)) {
    result[k] = NUMERIC_ADVANCED_KEYS.has(k) && /^\d+$/.test(v) ? Number(v) : v
  }
  return result
}

function buildOutputFormat(outputType: OutputType, advancedOptions?: Record<string, string>): Record<string, unknown> {
  if (outputType === 'svf')  return { type: 'svf',  views: ['2d', '3d'] }
  if (outputType === 'svf2') return { type: 'svf2', views: ['2d', '3d'] }
  const adv = advancedOptions && Object.keys(advancedOptions).length > 0 ? advancedOptions : undefined
  if (outputType === 'step' && !adv) return { type: 'step', advanced: { applicationProtocol: '214' } }
  return adv ? { type: outputType, advanced: coerceAdvancedValues(adv) } : { type: outputType }
}

const APS_JSON_HEADERS: Record<string, string> = {
  'Content-Type': 'application/json'
}

async function parseResponsePayload(res: Response): Promise<unknown> {
  const text = await res.text()
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return text
  }
}

function formatRequestErrorPayload(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null && 'diagnostic' in payload) {
    const diagnostic = (payload as { diagnostic?: unknown }).diagnostic
    if (typeof diagnostic === 'string' && diagnostic.trim()) {
      return diagnostic.trim()
    }
  }
  return typeof payload === 'object' && payload !== null ? JSON.stringify(payload) : String(payload)
}

function assertOkResponse(res: Response, payload: unknown, context: string): void {
  if (res.ok) return
  const detail = formatRequestErrorPayload(payload)
  throw new Error(`${context} HTTP ${res.status}: ${detail}`)
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

/**
 * Downloads a thumbnail image via the dedicated thumbnail endpoint.
 * @see https://aps.autodesk.com/en/docs/model-derivative/v2/reference/http/urn-thumbnail-GET/
 */
export async function downloadModelDerivativeThumbnail(payload: Record<string, unknown>): Promise<{
  base64: string
  contentType: string
}> {
  const urn = normalizeUrn(payload.urn)
  const params = new URLSearchParams()
  if (typeof payload.width  === 'number') params.set('width',  String(payload.width))
  if (typeof payload.height === 'number') params.set('height', String(payload.height))
  const query = params.size > 0 ? `?${params.toString()}` : ''

  const token = await ensureApsToken()
  const res = await fetch(
    `${AUTODESK_MODEL_DERIVATIVE_BASE_URL}/${encodeURIComponent(urn)}/thumbnail${query}`,
    { method: 'GET', headers: { Authorization: `Bearer ${token}` } }
  )

  const buf = await res.arrayBuffer()
  if (!res.ok) {
    const text = new TextDecoder().decode(buf)
    let parsed: unknown = text
    try { parsed = text ? JSON.parse(text) : null } catch { parsed = text }
    assertOkResponse(res, parsed, 'Model Derivative thumbnail')
  }

  const rawCt = res.headers.get('content-type')
  return {
    base64: arrayBufferToBase64(buf),
    contentType: rawCt?.split(';')[0]?.trim() || 'image/png'
  }
}

/**
 * Downloads derivative bytes for a resource URN from the manifest (GET manifest/{derivativeUrn}).
 */
export async function downloadModelDerivativeAsset(payload: Record<string, unknown>): Promise<{
  base64: string
  contentType: string
}> {
  const urn = normalizeUrn(payload.urn)
  const derivativeUrn = typeof payload.derivativeUrn === 'string' ? payload.derivativeUrn.trim() : ''
  if (!derivativeUrn) {
    throw new Error('derivativeUrn is required')
  }

  const url = `${AUTODESK_MODEL_DERIVATIVE_BASE_URL}/${encodeURIComponent(urn)}/manifest/${encodeURIComponent(derivativeUrn)}`
  const token = await ensureApsToken()
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  })

  const buf = await res.arrayBuffer()
  if (!res.ok) {
    const text = new TextDecoder().decode(buf.byteLength > 0 ? buf : new ArrayBuffer(0))
    let parsed: unknown = text
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = text
    }
    assertOkResponse(res, parsed, 'Model Derivative download')
  }

  const rawCt = res.headers.get('content-type')
  const contentType = rawCt?.split(';')[0]?.trim() || 'application/octet-stream'

  return {
    base64: arrayBufferToBase64(buf),
    contentType
  }
}

/**
 * Submits a Model Derivative translation job using the user's Autodesk session cookies.
 */
export async function submitModelDerivativeJob(payload: Record<string, unknown>): Promise<unknown> {
  const urn = normalizeUrn(payload.urn)
  const outputType = normalizeOutputType(payload.outputType)
  const advancedOptions =
    payload.advancedOptions && typeof payload.advancedOptions === 'object'
      ? (payload.advancedOptions as Record<string, string>)
      : undefined

  const forceRetranslate = payload.forceRetranslate !== false

  const token = await ensureApsToken()
  const res = await fetch(`${AUTODESK_MODEL_DERIVATIVE_BASE_URL}/job`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      ...APS_JSON_HEADERS,
      ...(forceRetranslate ? { 'x-ads-force': 'true' } : {}),
      'x-ads-derivative-format': 'latest'
    },
    body: JSON.stringify({
      input: { urn, checkReferences: true },
      output: { formats: [buildOutputFormat(outputType, advancedOptions)] }
    })
  })

  const parsed = await parseResponsePayload(res)
  assertOkResponse(res, parsed, 'Model Derivative submit job')
  return parsed
}

/**
 * Fetches a Model Derivative manifest (job status/details) for a source URN.
 */
export async function getModelDerivativeManifest(payload: Record<string, unknown>): Promise<unknown> {
  const urn = normalizeUrn(payload.urn)
  const token = await ensureApsToken()
  const res = await fetch(`${AUTODESK_MODEL_DERIVATIVE_BASE_URL}/${encodeURIComponent(urn)}/manifest`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  })

  const parsed = await parseResponsePayload(res)
  if (res.status === 404) {
    return {
      status: 'notfound',
      httpStatus: 404,
      ...(typeof parsed === 'object' && parsed !== null ? (parsed as object) : {})
    }
  }
  assertOkResponse(res, parsed, 'Model Derivative manifest')
  return parsed
}

/**
 * Supported translation matrix from APS ([formats GET](https://aps.autodesk.com/en/docs/model-derivative/v2/reference/http/informational/formats-GET/)):
 * each output format key maps to source file extensions that can produce that derivative.
 */
export async function getModelDerivativeFormats(_payload: Record<string, unknown>): Promise<unknown> {
  const token = await ensureApsToken()
  const res = await fetch(`${AUTODESK_MODEL_DERIVATIVE_BASE_URL}/formats`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  })

  const parsed = await parseResponsePayload(res)
  assertOkResponse(res, parsed, 'Model Derivative formats')
  return parsed
}

/**
 * Model metadata (object trees / views) — typically available after SVF translation.
 * @see https://aps.autodesk.com/en/docs/model-derivative/v2/reference/http/urn-metadata-GET/
 */
export async function getModelDerivativeMetadata(payload: Record<string, unknown>): Promise<unknown> {
  const urn = normalizeUrn(payload.urn)
  const token = await ensureApsToken()
  const res = await fetch(`${AUTODESK_MODEL_DERIVATIVE_BASE_URL}/${encodeURIComponent(urn)}/metadata`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` }
  })

  const parsed = await parseResponsePayload(res)
  if (res.status === 404) {
    return {
      status: 'notfound',
      httpStatus: 404,
      ...(typeof parsed === 'object' && parsed !== null ? (parsed as object) : {})
    }
  }
  assertOkResponse(res, parsed, 'Model Derivative metadata')
  return parsed
}

export async function fetchMfgGraphQL(payload: Record<string, unknown>): Promise<unknown> {
  if ('query' in payload) {
    throw new Error('fetchMfgGraphQL: raw GraphQL query strings are not accepted')
  }

  const operation = typeof payload.operation === 'string' ? payload.operation.trim() : ''
  if (operation !== 'getModelSourceFile') {
    throw new Error('fetchMfgGraphQL: unsupported or missing operation')
  }

  const variables = variablesForGetModelSourceFile(payload.variables)

  const token = await ensureApsToken()
  const res = await fetch(MFG_GRAPHQL_PUBLIC_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, ...APS_JSON_HEADERS },
    body: JSON.stringify({ query: MFG_GRAPHQL_GET_MODEL_SOURCE_FILE, variables })
  })

  const parsed = await parseResponsePayload(res)
  assertOkResponse(res, parsed, 'Mfg GraphQL')
  return parsed
}
