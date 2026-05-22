export function applyMessageTemplate(template: string, args: unknown[]): string {
  return template.replace(/\{(\d+)\}/g, (_, idx: string) => {
    const value = args[Number(idx)]
    return value == null ? '' : String(value)
  })
}

export function extractValidationMessage(entry: unknown): string {
  if (!entry || typeof entry !== 'object') return ''
  const record = entry as Record<string, unknown>
  const template = typeof record.message === 'string' ? record.message.trim() : ''
  const args = Array.isArray(record.arguments) ? record.arguments : []
  if (template) return applyMessageTemplate(template, args).trim()
  const field = record.field
  if (field && typeof field === 'object') {
    const title = typeof (field as Record<string, unknown>).title === 'string'
      ? String((field as Record<string, unknown>).title).trim()
      : ''
    if (title) return `${title}: invalid value`
  }
  return ''
}

export function tryParseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export function extractValidationMessageDeep(value: unknown): string {
  if (value == null) return ''

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return ''
    const parsed = tryParseJson(trimmed)
    if (parsed !== null) return extractValidationMessageDeep(parsed)
    return ''
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const direct = extractValidationMessage(entry)
      if (direct) return direct
      const nested = extractValidationMessageDeep(entry)
      if (nested) return nested
    }
    return ''
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const direct = extractValidationMessage(record)
    if (direct) return direct

    const nestedKeys = ['data', 'errors', 'details', 'validationErrors']
    for (const key of nestedKeys) {
      if (!(key in record)) continue
      const nested = extractValidationMessageDeep(record[key])
      if (nested) return nested
    }
  }

  return ''
}

export function extractBomMutationErrorMessage(result: unknown, fallback: string): string {
  if (!result || typeof result !== 'object') return fallback
  const record = result as Record<string, unknown>
  const structured = extractValidationMessageDeep(record.data)
    || extractValidationMessageDeep(record.errors)
    || extractValidationMessageDeep(record.message)
    || extractValidationMessageDeep(record)
  if (structured) return structured

  const directMessage = typeof record.message === 'string' ? record.message.trim() : ''
  if (directMessage) return directMessage

  const statusText = typeof record.statusText === 'string' ? record.statusText.trim() : ''
  if (statusText) return statusText

  const data = record.data
  if (data && typeof data === 'object') {
    const dataRecord = data as Record<string, unknown>
    const dataMessage = typeof dataRecord.message === 'string' ? dataRecord.message.trim() : ''
    if (dataMessage) return dataMessage
    const dataError = typeof dataRecord.error === 'string' ? dataRecord.error.trim() : ''
    if (dataError) return dataError
  }
  return fallback
}

function hasMutationErrorEntries(value: unknown, depth = 0): boolean {
  if (depth > 6 || value == null) return false
  if (Array.isArray(value)) {
    if (value.length === 0) return false
    return value.some((entry) => hasMutationErrorEntries(entry, depth + 1))
  }
  if (typeof value !== 'object') return false

  const record = value as Record<string, unknown>
  const code = typeof record.code === 'string' ? record.code.trim() : ''
  if (code.startsWith('errors.')) return true
  if (record.field && typeof record.field === 'object') return true

  const nestedKeys = ['data', 'errors', 'details', 'validationErrors']
  for (const key of nestedKeys) {
    if (!(key in record)) continue
    if (hasMutationErrorEntries(record[key], depth + 1)) return true
  }

  const message = typeof record.message === 'string' ? record.message.trim() : ''
  if (message) {
    const parsed = tryParseJson(message)
    if (parsed !== null && hasMutationErrorEntries(parsed, depth + 1)) return true
  }

  return false
}

function createBomMutationError(action: 'add' | 'update' | 'remove', result: unknown, fallback: string): Error {
  const error = new Error(extractBomMutationErrorMessage(result, fallback))
  ;(error as Error & { status?: number; data?: unknown; details?: unknown }).status = Number((result as { status?: unknown })?.status)
  ;(error as Error & { status?: number; data?: unknown; details?: unknown }).data = (result as { data?: unknown })?.data
  ;(error as Error & { status?: number; data?: unknown; details?: unknown }).details = result
  return error
}

export function assertMutationSuccess(action: 'add' | 'update' | 'remove', result: unknown): void {
  const fallback = `BOM ${action} failed`

  if (hasMutationErrorEntries(result)) {
    throw createBomMutationError(action, result, fallback)
  }

  const status = Number((result as { status?: unknown })?.status)
  if (Number.isFinite(status) && status >= 200 && status < 300) return
  if (Number.isFinite(status)) {
    throw createBomMutationError(action, result, `BOM ${action} failed (status ${status})`)
  }
  const errorMessage = extractBomMutationErrorMessage(result, '')
  if (errorMessage) {
    throw createBomMutationError(action, result, errorMessage)
  }

  throw createBomMutationError(action, result, fallback)
}


