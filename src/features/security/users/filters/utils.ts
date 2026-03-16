import { normalizeText as normalizeSharedText } from '../../../../shared/utils/text'

export function normalizeText(value: unknown): string {
  return normalizeSharedText(value)
}

export function titleCase(value: string): string {
  return String(value || '')
    .split(' ')
    .map((token) => {
      if (!token) return token
      return token.charAt(0).toUpperCase() + token.slice(1)
    })
    .join(' ')
}

