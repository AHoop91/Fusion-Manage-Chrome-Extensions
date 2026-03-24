// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { decodeHtmlEntities, stripHtml } from '../html'

describe('shared html utils', () => {
  it('decodes html entities only when present', () => {
    expect(decodeHtmlEntities('Fish &amp; Chips')).toBe('Fish & Chips')
    expect(decodeHtmlEntities('Plain text')).toBe('Plain text')
  })

  it('strips markup down to visible text', () => {
    expect(stripHtml('<div><strong>Hello</strong> world</div>')).toBe('Hello world')
    expect(stripHtml('No markup')).toBe('No markup')
  })
})
