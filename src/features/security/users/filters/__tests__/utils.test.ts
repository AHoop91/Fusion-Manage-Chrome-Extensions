import { describe, expect, it } from 'vitest'
import { normalizeText, titleCase } from '../utils'

describe('security users filters/utils', () => {
  it('normalizes text for comparisons', () => {
    expect(normalizeText('  MIXED   Case Value ')).toBe('mixed case value')
    expect(normalizeText(undefined)).toBe('')
  })

  it('converts tokens into title case without stripping spacing boundaries first', () => {
    expect(titleCase('quality assurance manager')).toBe('Quality Assurance Manager')
    expect(titleCase('two  spaces')).toBe('Two  Spaces')
  })
})
