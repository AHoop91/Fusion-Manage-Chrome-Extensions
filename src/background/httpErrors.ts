function interpolateMessageTemplate(template: string, args: unknown[]): string {
  let result = template
  for (let i = 0; i < args.length; i += 1) {
    result = result.replace(new RegExp(`\\{${i}\\}`, 'g'), String(args[i] ?? ''))
  }
  return result
}

/**
 * Prefer Fusion Manage-style `errors[]` with templated `message` + `arguments`
 * over generic top-level `message` (e.g. "HTTP 400 Bad Request").
 */
export function formatPlmErrorsArrayMessage(data: Record<string, unknown>): string | null {
  const rawErrors = data.errors
  if (!Array.isArray(rawErrors) || rawErrors.length === 0) return null

  const parts: string[] = []
  for (const entry of rawErrors) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const template = typeof record.message === 'string' ? record.message : ''
    if (!template.trim()) continue

    const args = Array.isArray(record.arguments) ? record.arguments : []
    const interpolated = interpolateMessageTemplate(template, args).trim()
    if (interpolated) parts.push(interpolated)
  }

  if (parts.length === 0) return null
  return parts.join('; ')
}
