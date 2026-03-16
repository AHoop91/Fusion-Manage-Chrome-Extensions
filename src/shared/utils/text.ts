/**
 * Shared text normalization helpers.
 */
export function normalizeText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeWhitespace(value: string): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeFieldToken(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .trim()
}
