export function normalizeValidatorName(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

export function isRequiredLikeValidatorName(value: unknown): boolean {
  const normalized = normalizeValidatorName(value)
  return normalized === 'required' || normalized === 'missing' || normalized === 'dropdownselection'
}

/** Recursive required check (strict: only `required`, includes nested validators). */
export function hasRequiredValidator(data: unknown): boolean {
  if (!data) return false
  if (Array.isArray(data)) return data.some((entry) => hasRequiredValidator(entry))
  if (typeof data !== 'object') return String(data).trim().toLowerCase() === 'required'
  const record = data as Record<string, unknown>
  const name = String(record.validatorName || record.name || '').trim().toLowerCase()
  if (name === 'required') return true
  if (Array.isArray(record.validators)) return record.validators.some((entry) => hasRequiredValidator(entry))
  return false
}

/** Grid-style required detection including missing/dropdownselection aliases. */
export function hasExtendedRequiredValidator(data: unknown): boolean {
  if (!data) return false
  if (Array.isArray(data)) return data.some((entry) => hasExtendedRequiredValidator(entry))
  if (typeof data !== 'object') return isRequiredLikeValidatorName(data)
  const record = data as Record<string, unknown>
  if (isRequiredLikeValidatorName(record.validatorName) || isRequiredLikeValidatorName(record.name)) return true
  if (Array.isArray(record.validators)) return record.validators.some((entry) => hasExtendedRequiredValidator(entry))
  return false
}

export function walkValidatorTree(
  data: unknown,
  visit: (record: Record<string, unknown>) => void
): void {
  if (!data) return
  if (Array.isArray(data)) {
    for (const entry of data) walkValidatorTree(entry, visit)
    return
  }
  if (typeof data !== 'object') return
  const record = data as Record<string, unknown>
  visit(record)
  if (Array.isArray(record.validators)) {
    for (const entry of record.validators) walkValidatorTree(entry, visit)
  }
  for (const key of ['fieldValidators', 'rules'] as const) {
    if (record[key]) walkValidatorTree(record[key], visit)
  }
}
