import type { TableauExport } from '../tableaus.types'

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

const SELF_RE = /\/api\/v3\/workspaces\/(\d+)\/tableaus\/\d+/

export function parseTableauExport(data: unknown): TableauExport {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ValidationError('Invalid file: expected a JSON object')
  }

  const obj = data as Record<string, unknown>

  if (typeof obj.__self__ !== 'string' || !SELF_RE.test(obj.__self__)) {
    throw new ValidationError("Invalid file: missing or invalid '__self__' field")
  }

  // Prefer 'title' (the display name used by the list API) over 'name' (may be an internal identifier)
  const nameValue = (typeof obj.title === 'string' && obj.title.trim())
    ? obj.title.trim()
    : (typeof obj.name === 'string' ? obj.name.trim() : '')
  if (!nameValue) {
    throw new ValidationError("Invalid file: missing or empty 'name'/'title' field")
  }
  const normalised = { ...obj, name: nameValue } as TableauExport

  const normObj = normalised as unknown as Record<string, unknown>
  if (!Array.isArray(normObj.columns) || (normObj.columns as unknown[]).length === 0) {
    throw new ValidationError("Invalid file: 'columns' must be a non-empty array")
  }

  const columns = normObj.columns as unknown[]
  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]
    if (!col || typeof col !== 'object' || Array.isArray(col)) {
      throw new ValidationError(`Invalid file: columns[${i}] is not an object`)
    }
    const colObj = col as Record<string, unknown>
    const field = colObj.field
    if (!field || typeof field !== 'object' || Array.isArray(field)) {
      throw new ValidationError(`Invalid file: columns[${i}].field is not an object`)
    }
    const fieldObj = field as Record<string, unknown>
    if (typeof fieldObj.__self__ !== 'string' || !fieldObj.__self__.trim()) {
      throw new ValidationError(`Invalid file: columns[${i}].field.__self__ is missing`)
    }
    const rawOrder = colObj.displayOrder
    const displayOrder = typeof rawOrder === 'number'
      ? rawOrder
      : typeof rawOrder === 'string' && rawOrder.trim() !== ''
        ? Number(rawOrder)
        : i
    if (!Number.isFinite(displayOrder)) {
      throw new ValidationError(`Invalid file: columns[${i}].displayOrder is not a number`)
    }
    colObj.displayOrder = displayOrder
  }

  return normalised
}

export function extractWsIdFromSelf(self: string): string | null {
  return SELF_RE.exec(self)?.[1] ?? null
}
