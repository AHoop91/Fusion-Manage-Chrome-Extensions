const AUTH_FAILURE_MESSAGE = 'Request could not be completed.'

function isAuthFailureStatus(status: number): boolean {
  return status === 401 || status === 403
}

function parseErrorMessage(data: unknown, fallback: string): string {
  if (typeof data === 'string' && data.trim()) return data.trim()
  if (typeof data === 'object' && data && 'message' in data) {
    const message = (data as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }

  try {
    const serialized = JSON.stringify(data)
    return serialized && serialized !== '{}' ? serialized : fallback
  } catch {
    return fallback
  }
}

function buildHttpError(status: number, data: unknown, fallback: string): Error & {
  status?: number
  data?: unknown
} {
  const message = isAuthFailureStatus(status)
    ? AUTH_FAILURE_MESSAGE
    : parseErrorMessage(data, fallback || `HTTP ${status}`)

  const error = new Error(message || fallback || `HTTP ${status}`) as Error & {
    status?: number
    data?: unknown
  }
  error.status = isAuthFailureStatus(status) ? undefined : status
  error.data = isAuthFailureStatus(status) ? null : data
  return error
}

export async function httpRequest({
  method,
  url,
  body,
  headers = {}
}: {
  method: string
  url: string
  body?: unknown
  headers?: Record<string, string>
}): Promise<any> {
  const hasBody = typeof body !== 'undefined'
  const hasContentTypeHeader = Object.keys(headers).some((name) => name.toLowerCase() === 'content-type')

  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(hasBody && !hasContentTypeHeader
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...headers
    },
    body: hasBody ? JSON.stringify(body) : undefined
  })

  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('json') ? await res.json() : await res.text()

  if (!res.ok) throw buildHttpError(res.status, data, `HTTP ${res.status}`)

  return data
}

export async function httpRequestWithMeta({
  method,
  url,
  body,
  headers = {}
}: {
  method: string
  url: string
  body?: unknown
  headers?: Record<string, string>
}): Promise<{ data: any; headers: Record<string, string>; status: number }> {
  const hasBody = typeof body !== 'undefined'
  const hasContentTypeHeader = Object.keys(headers).some((name) => name.toLowerCase() === 'content-type')

  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(hasBody && !hasContentTypeHeader
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...headers
    },
    body: hasBody ? JSON.stringify(body) : undefined
  })

  const contentType = res.headers.get('content-type') || ''
  const data = contentType.includes('json') ? await res.json() : await res.text()
  const responseHeaders: Record<string, string> = {}
  res.headers.forEach((value, key) => {
    responseHeaders[String(key || '').toLowerCase()] = String(value || '')
  })

  if (!res.ok) throw buildHttpError(res.status, data, `HTTP ${res.status}`)

  return {
    data,
    headers: responseHeaders,
    status: res.status
  }
}

export async function httpMultipartRequest({
  method,
  url,
  formData,
  headers = {}
}: {
  method: string
  url: string
  formData: FormData
  headers?: Record<string, string>
}): Promise<boolean> {
  if (!(formData instanceof FormData)) {
    throw new Error('formData must be a FormData instance')
  }

  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      ...headers
    },
    body: formData
  })

  if (!res.ok && res.status !== 204) {
    const text = await res.text()
    throw buildHttpError(res.status, text, `HTTP ${res.status}`)
  }

  return true
}

export async function httpBinaryRequest({
  method = 'GET',
  url,
  headers = {},
  responseType = 'arraybuffer'
}: {
  method?: string
  url: string
  headers?: Record<string, string>
  responseType?: 'arraybuffer' | 'base64'
}): Promise<ArrayBuffer | string> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      ...headers
    }
  })

  if (!res.ok) throw buildHttpError(res.status, null, `HTTP ${res.status}`)

  const buffer = await res.arrayBuffer()

  if (responseType === 'base64') {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const chunkSize = 0x8000

    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }

    return btoa(binary)
  }

  return buffer
}

export async function httpBinaryRequestWithMeta({
  method = 'GET',
  url,
  headers = {},
  responseType = 'arraybuffer'
}: {
  method?: string
  url: string
  headers?: Record<string, string>
  responseType?: 'arraybuffer' | 'base64'
}): Promise<{ data: ArrayBuffer | string; contentType: string }> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      ...headers
    }
  })

  if (!res.ok) throw buildHttpError(res.status, null, `HTTP ${res.status}`)

  const contentType = res.headers.get('content-type') || ''
  const buffer = await res.arrayBuffer()

  if (responseType === 'base64') {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const chunkSize = 0x8000

    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
    }

    return {
      data: btoa(binary),
      contentType
    }
  }

  return {
    data: buffer,
    contentType
  }
}
