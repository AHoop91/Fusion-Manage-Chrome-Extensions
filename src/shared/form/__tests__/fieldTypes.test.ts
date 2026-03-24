import { describe, expect, it } from 'vitest'
import {
  classifyColumnKind,
  inferColumnKindFromTypeId,
  isApiPathValue,
  isBooleanFieldType,
  isDateFieldType,
  isDecimalFieldType,
  isEmailFieldType,
  isIntegerFieldType,
  isLinkingLookupFieldType,
  isLookupFieldType,
  isLookupPayloadValue,
  isMoneyFieldType,
  isMultiLookupFieldType,
  isNumericFieldType,
  isParagraphFieldType,
  isRadioFieldType,
  isUrlFieldType,
  shouldPreloadLookupOptions
} from '../fieldTypes'

describe('shared/form/fieldTypes', () => {
  it('classifies core field-type id families correctly', () => {
    expect(isLookupFieldType(6)).toBe(true)
    expect(isMultiLookupFieldType(27)).toBe(true)
    expect(isRadioFieldType(25)).toBe(true)
    expect(isLinkingLookupFieldType(22)).toBe(true)
    expect(shouldPreloadLookupOptions(22)).toBe(false)
    expect(shouldPreloadLookupOptions(6)).toBe(true)
    expect(shouldPreloadLookupOptions(null)).toBe(true)

    expect(isBooleanFieldType(9)).toBe(true)
    expect(isDateFieldType(3)).toBe(true)
    expect(isNumericFieldType(31)).toBe(true)
    expect(isIntegerFieldType(30)).toBe(true)
    expect(isDecimalFieldType(2)).toBe(true)
    expect(isMoneyFieldType(31)).toBe(true)
    expect(isParagraphFieldType(17)).toBe(true)
    expect(isEmailFieldType(18)).toBe(true)
    expect(isUrlFieldType(16)).toBe(true)
  })

  it('detects API-style lookup payloads and infers column kinds', () => {
    expect(isApiPathValue('/api/v3/workspaces/57/items/10')).toBe(true)
    expect(isApiPathValue('value')).toBe(false)

    expect(isLookupPayloadValue('/api/v3/workspaces/57/items/10')).toBe(true)
    expect(isLookupPayloadValue('/api/v3/workspaces/57/items/10, /api/v3/workspaces/57/items/11')).toBe(true)
    expect(isLookupPayloadValue('value, /api/v3/workspaces/57/items/11')).toBe(false)

    expect(inferColumnKindFromTypeId(9)).toBe('boolean')
    expect(inferColumnKindFromTypeId(3)).toBe('date')
    expect(inferColumnKindFromTypeId(31)).toBe('number')
    expect(inferColumnKindFromTypeId(4)).toBeNull()
  })

  it('classifies type titles into text, number, date, and boolean columns', () => {
    expect(classifyColumnKind('Check Box')).toBe('boolean')
    expect(classifyColumnKind('Date & Time')).toBe('date')
    expect(classifyColumnKind('Currency')).toBe('number')
    expect(classifyColumnKind('Single Line Text')).toBe('text')
  })
})
