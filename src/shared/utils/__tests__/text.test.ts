// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { normalizeFieldToken, normalizeText, normalizeWhitespace } from '../text'

describe('shared/utils/text', () => {
  it('normalizes text by lowercasing and collapsing whitespace', () => {
    expect(normalizeText('  Hello   WORLD  ')).toBe('hello world')
    expect(normalizeText(null)).toBe('')
  })

  it('normalizes whitespace without lowercasing', () => {
    expect(normalizeWhitespace('  Alpha   Beta  ')).toBe('Alpha Beta')
    expect(normalizeWhitespace('Line\n\nBreak')).toBe('Line Break')
  })

  it('normalizes field tokens with underscores and spaces', () => {
    expect(normalizeFieldToken('  PART_NUMBER  VALUE ')).toBe('part number value')
    expect(normalizeFieldToken(undefined)).toBe('')
  })
})
