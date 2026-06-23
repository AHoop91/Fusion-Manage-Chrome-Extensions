// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  getOperatorMeta,
  getDefaultOperatorForKind,
  getOperatorsForKind,
  getTodayIsoDate,
  operatorRequiresSecondaryValue,
  operatorRequiresValue,
  parseBooleanValue,
  parseDateValue,
  parseNumberValue,
  ruleMatchesValue
} from '../filterEngine'
import type { ColumnCondition } from '../model'

function createCondition(overrides: Partial<ColumnCondition> & Pick<ColumnCondition, 'operator'>): ColumnCondition {
  return {
    id: overrides.id || 'condition-1',
    operator: overrides.operator,
    value: overrides.value || '',
    valueTo: overrides.valueTo || ''
  }
}

describe('grid filters/filterEngine', () => {
  it('returns the expected default operators and operator capabilities', () => {
    expect(getDefaultOperatorForKind('text')).toBe('contains')
    expect(getDefaultOperatorForKind('number')).toBe('equals')
    expect(getDefaultOperatorForKind('date')).toBe('equals')
    expect(getDefaultOperatorForKind('boolean')).toBe('equals')

    expect(operatorRequiresValue('contains')).toBe(true)
    expect(operatorRequiresValue('is_empty')).toBe(false)
    expect(operatorRequiresSecondaryValue('between')).toBe(true)
    expect(operatorRequiresSecondaryValue('equals')).toBe(false)
    expect(getOperatorMeta('contains')?.label).toBe('Contains')

    expect(getOperatorsForKind('number').map((entry) => entry.value)).toContain('between')
    expect(getOperatorsForKind('text').map((entry) => entry.value)).not.toContain('gt')
    expect(getOperatorsForKind('boolean').map((entry) => entry.value)).toEqual(['equals', 'is_empty', 'not_empty'])
    expect(getOperatorMeta('between')?.requiresSecondaryValue).toBe(true)
  })

  it('parses number, date, and boolean values robustly', () => {
    expect(parseNumberValue('1,234.5')).toBe(1234.5)
    expect(parseNumberValue('abc')).toBeNull()
    expect(parseNumberValue('')).toBeNull()

    expect(parseDateValue('2026-03-22')).toBe(Date.UTC(2026, 2, 22))
    expect(parseDateValue('03/22/2026')).toBe(Date.UTC(2026, 2, 22))
    expect(typeof getTodayIsoDate()).toBe('string')
    expect(getTodayIsoDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(parseDateValue('not-a-date')).toBeNull()

    expect(parseBooleanValue(' Enabled ')).toBe(true)
    expect(parseBooleanValue('off')).toBe(false)
    expect(parseBooleanValue('unknown')).toBeNull()
  })

  it('evaluates text rules correctly', () => {
    expect(ruleMatchesValue('Rear Connector PCBA', createCondition({ operator: 'contains', value: 'connector' }), 'text')).toBe(true)
    expect(ruleMatchesValue('Rear Connector PCBA', createCondition({ operator: 'starts_with', value: 'rear' }), 'text')).toBe(true)
    expect(ruleMatchesValue('Rear Connector PCBA', createCondition({ operator: 'equals', value: 'rear connector pcba' }), 'text')).toBe(true)
    expect(ruleMatchesValue('Rear Connector PCBA', createCondition({ operator: 'equals', value: '' }), 'text')).toBe(false)
    expect(ruleMatchesValue('', createCondition({ operator: 'is_empty' }), 'text')).toBe(true)
    expect(ruleMatchesValue('value', createCondition({ operator: 'not_empty' }), 'text')).toBe(true)
  })

  it('evaluates numeric and date ranges correctly', () => {
    expect(ruleMatchesValue('15', createCondition({ operator: 'between', value: '10', valueTo: '20' }), 'number')).toBe(true)
    expect(ruleMatchesValue('15', createCondition({ operator: 'between', value: '20', valueTo: '10' }), 'number')).toBe(true)
    expect(ruleMatchesValue('abc', createCondition({ operator: 'gt', value: '10' }), 'number')).toBe(false)
    expect(ruleMatchesValue('25', createCondition({ operator: 'lt', value: '20' }), 'number')).toBe(false)
    expect(ruleMatchesValue('25', createCondition({ operator: 'gte', value: '20' }), 'number')).toBe(true)
    expect(ruleMatchesValue('25', createCondition({ operator: 'lte', value: '25' }), 'number')).toBe(true)
    expect(ruleMatchesValue('2026-03-22', createCondition({ operator: 'before', value: '2026-03-23' }), 'date')).toBe(true)
    expect(ruleMatchesValue('2026-03-22', createCondition({ operator: 'after', value: '2026-03-23' }), 'date')).toBe(false)
    expect(ruleMatchesValue('2026-03-22', createCondition({ operator: 'between', value: '2026-03-23', valueTo: '2026-03-20' }), 'date')).toBe(true)
    expect(ruleMatchesValue('bad-date', createCondition({ operator: 'between', value: '2026-03-23', valueTo: '2026-03-20' }), 'date')).toBe(false)
  })

  it('evaluates boolean equality using normalized values', () => {
    expect(ruleMatchesValue('Yes', createCondition({ operator: 'equals', value: 'true' }), 'boolean')).toBe(true)
    expect(ruleMatchesValue('disabled', createCondition({ operator: 'equals', value: 'true' }), 'boolean')).toBe(false)
  })

  it('fails closed on empty values and unknown operators', () => {
    expect(ruleMatchesValue('Rear Connector', createCondition({ operator: 'contains', value: '' }), 'text')).toBe(false)
    expect(ruleMatchesValue('B', createCondition({ operator: 'between', value: 'A', valueTo: 'C' }), 'text')).toBe(false)
    expect(ruleMatchesValue('B', createCondition({ operator: 'between', value: '', valueTo: 'C' }), 'text')).toBe(false)
    expect(ruleMatchesValue('   ', createCondition({ operator: 'is_empty' }), 'text')).toBe(true)
    expect(ruleMatchesValue('anything', createCondition({ operator: 'unknown' as never }), 'text')).toBe(false)
  })

  describe('fail-closed behavior for empty and unknown operators', () => {
    it('contains with empty value returns false', () => {
      expect(ruleMatchesValue('any value', createCondition({ operator: 'contains', value: '' }), 'text')).toBe(false)
      expect(ruleMatchesValue('any value', createCondition({ operator: 'contains', value: '   ' }), 'text')).toBe(false)
    })

    it('equals (text) with empty value returns false', () => {
      expect(ruleMatchesValue('any value', createCondition({ operator: 'equals', value: '' }), 'text')).toBe(false)
      expect(ruleMatchesValue('any value', createCondition({ operator: 'equals', value: '   ' }), 'text')).toBe(false)
    })

    it('starts_with with empty value returns false', () => {
      expect(ruleMatchesValue('any value', createCondition({ operator: 'starts_with', value: '' }), 'text')).toBe(false)
      expect(ruleMatchesValue('any value', createCondition({ operator: 'starts_with', value: '   ' }), 'text')).toBe(false)
    })

    it('unknown operator string returns false', () => {
      expect(ruleMatchesValue('any value', createCondition({ operator: 'unknown' as never }), 'text')).toBe(false)
      expect(ruleMatchesValue('', createCondition({ operator: 'invalid_op' as never }), 'text')).toBe(false)
    })
  })
})
