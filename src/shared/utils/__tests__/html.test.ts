// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { decodeHtmlEntities, stripHtml } from '../html'

describe('shared html utils', () => {
  it('decodes html entities only when present', () => {
    expect(decodeHtmlEntities('Fish &amp; Chips')).toBe('Fish & Chips')
    expect(decodeHtmlEntities('Plain text')).toBe('Plain text')
  })

  it('decodes numeric entities', () => {
    expect(decodeHtmlEntities('&#60;')).toBe('<')
    expect(decodeHtmlEntities('&#62;')).toBe('>')
  })

  it('decodes hex entities', () => {
    expect(decodeHtmlEntities('&#x3e;')).toBe('>')
    expect(decodeHtmlEntities('&#x3c;')).toBe('<')
  })

  it('decodes typographical entities', () => {
    expect(decodeHtmlEntities('Break&mdash;down')).toBe('Break—down')
    expect(decodeHtmlEntities('Multiple&hellip;dots')).toBe('Multiple…dots')
  })

  it('preserves unknown entities', () => {
    expect(decodeHtmlEntities('&unknown;')).toBe('&unknown;')
  })

  it('strips markup down to visible text', () => {
    expect(stripHtml('<div><strong>Hello</strong> world</div>')).toBe('Hello world')
    expect(stripHtml('No markup')).toBe('No markup')
  })
})
