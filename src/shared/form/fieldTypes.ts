import { normalizeText } from '../utils/text'

export type FormColumnKind = 'text' | 'number' | 'date' | 'boolean'

const LOOKUP_TYPE_IDS = new Set<number>([6, 7, 10, 13, 14, 20, 22, 23, 24, 25, 26, 27, 28])
const MULTI_LOOKUP_TYPE_IDS = new Set<number>([13, 27])
const RADIO_TYPE_IDS = new Set<number>([10, 25])
const LINKING_LOOKUP_TYPE_IDS = new Set<number>([7, 22, 23, 25, 26, 27])
const BOOLEAN_TYPE_IDS = new Set<number>([9])
const DATE_TYPE_IDS = new Set<number>([3])
const NUMBER_TYPE_IDS = new Set<number>([1, 2, 5, 30, 31])
const INTEGER_TYPE_IDS = new Set<number>([1, 30])
const DECIMAL_TYPE_IDS = new Set<number>([2, 5, 31])
const MONEY_TYPE_IDS = new Set<number>([5, 31])
const PARAGRAPH_TYPE_IDS = new Set<number>([8, 17])
const EMAIL_TYPE_IDS = new Set<number>([18])
const URL_TYPE_IDS = new Set<number>([16])

export function isLookupFieldType(typeId: number | null): boolean {
  return Number.isFinite(typeId) && LOOKUP_TYPE_IDS.has(Number(typeId))
}

export function isMultiLookupFieldType(typeId: number | null): boolean {
  return Number.isFinite(typeId) && MULTI_LOOKUP_TYPE_IDS.has(Number(typeId))
}

export function isRadioFieldType(typeId: number | null): boolean {
  return Number.isFinite(typeId) && RADIO_TYPE_IDS.has(Number(typeId))
}

export function isLinkingLookupFieldType(typeId: number | null): boolean {
  return Number.isFinite(typeId) && LINKING_LOOKUP_TYPE_IDS.has(Number(typeId))
}

export function shouldPreloadLookupOptions(typeId: number | null): boolean {
  if (!Number.isFinite(typeId)) return true
  return !isLinkingLookupFieldType(typeId)
}

export function isBooleanFieldType(typeId: number | null): boolean {
  return Number.isFinite(typeId) && BOOLEAN_TYPE_IDS.has(Number(typeId))
}

export function isDateFieldType(typeId: number | null): boolean {
  return Number.isFinite(typeId) && DATE_TYPE_IDS.has(Number(typeId))
}

export function isNumericFieldType(typeId: number | null): boolean {
  return Number.isFinite(typeId) && NUMBER_TYPE_IDS.has(Number(typeId))
}

export function isIntegerFieldType(typeId: number | null): boolean {
  return Number.isFinite(typeId) && INTEGER_TYPE_IDS.has(Number(typeId))
}

export function isDecimalFieldType(typeId: number | null): boolean {
  return Number.isFinite(typeId) && DECIMAL_TYPE_IDS.has(Number(typeId))
}

export function isMoneyFieldType(typeId: number | null): boolean {
  return Number.isFinite(typeId) && MONEY_TYPE_IDS.has(Number(typeId))
}

export function isParagraphFieldType(typeId: number | null): boolean {
  return Number.isFinite(typeId) && PARAGRAPH_TYPE_IDS.has(Number(typeId))
}

export function isEmailFieldType(typeId: number | null): boolean {
  return Number.isFinite(typeId) && EMAIL_TYPE_IDS.has(Number(typeId))
}

export function isUrlFieldType(typeId: number | null): boolean {
  return Number.isFinite(typeId) && URL_TYPE_IDS.has(Number(typeId))
}

export function isApiPathValue(value: unknown): boolean {
  return /^\/api\/v3\//i.test(String(value || '').trim())
}

export function isLookupPayloadValue(value: unknown): boolean {
  const text = String(value || '').trim()
  if (!text) return false
  if (isApiPathValue(text)) return true
  const parts = text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) return false
  return parts.every((part) => isApiPathValue(part))
}

export function inferColumnKindFromTypeId(typeId: number | null): FormColumnKind | null {
  if (isBooleanFieldType(typeId)) return 'boolean'
  if (isDateFieldType(typeId)) return 'date'
  if (isNumericFieldType(typeId)) return 'number'
  return null
}

export function classifyColumnKind(typeTitle: string): FormColumnKind {
  const normalizedType = normalizeText(typeTitle)
  if (normalizedType.includes('checkbox') || normalizedType.includes('check box') || normalizedType.includes('boolean')) {
    return 'boolean'
  }
  if (normalizedType.includes('date')) return 'date'
  if (
    normalizedType.includes('integer') ||
    normalizedType.includes('number') ||
    normalizedType.includes('decimal') ||
    normalizedType.includes('float') ||
    normalizedType.includes('double') ||
    normalizedType.includes('currency')
  ) {
    return 'number'
  }
  return 'text'
}
