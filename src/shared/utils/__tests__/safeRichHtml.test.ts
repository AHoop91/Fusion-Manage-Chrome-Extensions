// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { sanitizeRichHtml } from '../safeRichHtml'

describe('shared safeRichHtml', () => {
  it('removes blocked tags entirely', () => {
    const html = sanitizeRichHtml('<div>safe</div><script>alert(1)</script><style>.x{}</style>')
    expect(html).toContain('<div>safe</div>')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('<style')
  })

  it('keeps allowed formatting tags and strips unknown wrappers', () => {
    const html = sanitizeRichHtml('<section><strong>Hello</strong><custom-tag>World</custom-tag></section>')
    expect(html).toBe('<strong>Hello</strong>World')
  })

  it('sanitizes anchor hrefs and onclick redirects', () => {
    expect(sanitizeRichHtml('<a href="javascript:alert(1)">Bad</a>')).toBe('<a>Bad</a>')
    expect(sanitizeRichHtml('<a onclick="window.open(\'/plm/workspaces/57\')">Open</a>')).toBe('<a href="/plm/workspaces/57">Open</a>')
    expect(sanitizeRichHtml('<a href="/plm/workspaces/57" target="_blank">Good</a>'))
      .toBe('<a href="/plm/workspaces/57" target="_blank" rel="noopener noreferrer">Good</a>')
  })

  it('keeps safe mailto/tel/hash links and rejects protocol-relative or file/data links', () => {
    expect(sanitizeRichHtml('<a href="#details">Jump</a>')).toBe('<a href="#details">Jump</a>')
    expect(sanitizeRichHtml('<a href="mailto:test@example.com">Mail</a>')).toBe('<a href="mailto:test@example.com">Mail</a>')
    expect(sanitizeRichHtml('<a href="tel:+441234">Call</a>')).toBe('<a href="tel:+441234">Call</a>')
    expect(sanitizeRichHtml('<a href="//evil.example/path">Nope</a>')).toBe('<a>Nope</a>')
    expect(sanitizeRichHtml('<a href="file:///c:/secret.txt">Nope</a>')).toBe('<a>Nope</a>')
    expect(sanitizeRichHtml('<a onclick="location.assign(\'data:text/html,bad\')">Nope</a>')).toBe('<a>Nope</a>')
  })

  it('normalizes relative and absolute safe links while preserving plain text content', () => {
    expect(sanitizeRichHtml('<a href="details/view?id=5">Relative</a>')).toBe('<a href="/details/view?id=5">Relative</a>')
    expect(sanitizeRichHtml('<a href="https://example.com/file?q=1#part">External</a>')).toBe('<a>External</a>')
    expect(sanitizeRichHtml('plain <unknown>text</unknown>')).toBe('plain text')
    expect(sanitizeRichHtml('')).toBe('')
  })
})
