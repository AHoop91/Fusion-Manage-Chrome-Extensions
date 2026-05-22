import { normalizeText } from '../../../shared/utils/text'
import { classifyColumnKind } from '../../../shared/form/fieldTypes'
import type { GridColumnKind, GridFilterOperator } from '../grid.types'
import type { ColumnCondition } from './model'

export const FILTER_OPERATOR_DEFS: Array<{
  value: GridFilterOperator
  label: string
  requiresValue: boolean
  requiresSecondaryValue: boolean
  kinds: GridColumnKind[]
}> = [
  { value: 'contains', label: 'Contains', requiresValue: true, requiresSecondaryValue: false, kinds: ['text'] },
  { value: 'equals', label: 'Is', requiresValue: true, requiresSecondaryValue: false, kinds: ['text', 'number', 'date', 'boolean'] },
  { value: 'starts_with', label: 'Starts with', requiresValue: true, requiresSecondaryValue: false, kinds: ['text'] },
  { value: 'gt', label: 'Greater than', requiresValue: true, requiresSecondaryValue: false, kinds: ['number'] },
  { value: 'gte', label: 'Greater or equal', requiresValue: true, requiresSecondaryValue: false, kinds: ['number'] },
  { value: 'lt', label: 'Less than', requiresValue: true, requiresSecondaryValue: false, kinds: ['number'] },
  { value: 'lte', label: 'Less or equal', requiresValue: true, requiresSecondaryValue: false, kinds: ['number'] },
  { value: 'before', label: 'Before', requiresValue: true, requiresSecondaryValue: false, kinds: ['date'] },
  { value: 'after', label: 'After', requiresValue: true, requiresSecondaryValue: false, kinds: ['date'] },
  { value: 'between', label: 'Between', requiresValue: true, requiresSecondaryValue: true, kinds: ['number', 'date'] },
  { value: 'is_empty', label: 'Is empty', requiresValue: false, requiresSecondaryValue: false, kinds: ['text', 'number', 'date', 'boolean'] },
  { value: 'not_empty', label: 'Is not empty', requiresValue: false, requiresSecondaryValue: false, kinds: ['text', 'number', 'date', 'boolean'] }
]

export function getOperatorMeta(operator: GridFilterOperator): (typeof FILTER_OPERATOR_DEFS)[number] | undefined {
  return FILTER_OPERATOR_DEFS.find((item) => item.value === operator)
}

export function getOperatorsForKind(kind: GridColumnKind): (typeof FILTER_OPERATOR_DEFS) {
  return FILTER_OPERATOR_DEFS.filter((item) => item.kinds.includes(kind))
}

export function getDefaultOperatorForKind(kind: GridColumnKind): GridFilterOperator {
  if (kind === 'number' || kind === 'date' || kind === 'boolean') return 'equals'
  return 'contains'
}

export function operatorRequiresValue(operator: GridFilterOperator): boolean {
  const match = getOperatorMeta(operator)
  return match ? match.requiresValue : true
}

export function operatorRequiresSecondaryValue(operator: GridFilterOperator): boolean {
  const match = getOperatorMeta(operator)
  return match ? match.requiresSecondaryValue : false
}

export function parseNumberValue(value: string): number | null {
  const cleaned = String(value || '').trim().replace(/,/g, '')
  if (!cleaned) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseDateValue(value: string): number | null {
  const raw = String(value || '').trim()
  if (!raw) return null

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (isoMatch) {
    const y = Number(isoMatch[1])
    const m = Number(isoMatch[2])
    const d = Number(isoMatch[3])
    const dt = Date.UTC(y, m - 1, d)
    return Number.isFinite(dt) ? dt : null
  }

  const usMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw)
  if (usMatch) {
    const m = Number(usMatch[1])
    const d = Number(usMatch[2])
    const y = Number(usMatch[3])
    const dt = Date.UTC(y, m - 1, d)
    return Number.isFinite(dt) ? dt : null
  }

  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export function getTodayIsoDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseBooleanValue(value: string): boolean | null {
  const normalized = normalizeText(value)
  if (!normalized) return null
  if (['true', 'yes', '1', 'enabled', 'checked', 'on'].includes(normalized)) return true
  if (['false', 'no', '0', 'disabled', 'unchecked', 'off'].includes(normalized)) return false
  return null
}

export { classifyColumnKind }

export function ruleMatchesValue(value: string, condition: ColumnCondition, kind: GridColumnKind): boolean {
  const normalizedValue = normalizeText(value)
  const normalizedRuleValue = normalizeText(condition.value)
  const normalizedRuleValueTo = normalizeText(condition.valueTo)

  switch (condition.operator) {
    case 'contains':
      return normalizedRuleValue ? normalizedValue.includes(normalizedRuleValue) : true
    case 'equals':
      if (kind === 'boolean') {
        const left = parseBooleanValue(value)
        const right = parseBooleanValue(condition.value)
        if (left === null || right === null) return false
        return left === right
      }
      if (kind === 'number') {
        const left = parseNumberValue(value)
        const right = parseNumberValue(condition.value)
        if (left === null || right === null) return false
        return left === right
      }
      if (kind === 'date') {
        const left = parseDateValue(value)
        const right = parseDateValue(condition.value)
        if (left === null || right === null) return false
        return left === right
      }
      return normalizedRuleValue ? normalizedValue === normalizedRuleValue : true
    case 'starts_with':
      return normalizedRuleValue ? normalizedValue.startsWith(normalizedRuleValue) : true
    case 'gt': {
      const left = parseNumberValue(value)
      const right = parseNumberValue(condition.value)
      if (left === null || right === null) return false
      return left > right
    }
    case 'gte': {
      const left = parseNumberValue(value)
      const right = parseNumberValue(condition.value)
      if (left === null || right === null) return false
      return left >= right
    }
    case 'lt': {
      const left = parseNumberValue(value)
      const right = parseNumberValue(condition.value)
      if (left === null || right === null) return false
      return left < right
    }
    case 'lte': {
      const left = parseNumberValue(value)
      const right = parseNumberValue(condition.value)
      if (left === null || right === null) return false
      return left <= right
    }
    case 'before': {
      const left = parseDateValue(value)
      const right = parseDateValue(condition.value)
      if (left === null || right === null) return false
      return left < right
    }
    case 'after': {
      const left = parseDateValue(value)
      const right = parseDateValue(condition.value)
      if (left === null || right === null) return false
      return left > right
    }
    case 'between':
      if (kind === 'number') {
        const left = parseNumberValue(value)
        const start = parseNumberValue(condition.value)
        const end = parseNumberValue(condition.valueTo)
        if (left === null || start === null || end === null) return false
        const min = Math.min(start, end)
        const max = Math.max(start, end)
        return left >= min && left <= max
      }
      if (kind === 'date') {
        const left = parseDateValue(value)
        const start = parseDateValue(condition.value)
        const end = parseDateValue(condition.valueTo)
        if (left === null || start === null || end === null) return false
        const min = Math.min(start, end)
        const max = Math.max(start, end)
        return left >= min && left <= max
      }
      return normalizedRuleValue && normalizedRuleValueTo
        ? normalizedValue >= normalizedRuleValue && normalizedValue <= normalizedRuleValueTo
        : true
    case 'is_empty':
      return normalizedValue.length === 0
    case 'not_empty':
      return normalizedValue.length > 0
    default:
      return true
  }
}

