// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { assertPlmAutodeskHttpsUrl, isPlmAutodeskHttpsUrl } from '../plmHttpPolicy'

describe('plmHttpPolicy', () => {
  it('isPlmAutodeskHttpsUrl accepts only PLM HTTPS hosts', () => {
    expect(isPlmAutodeskHttpsUrl('https://test.autodeskplm360.net/api')).toBe(true)
    expect(isPlmAutodeskHttpsUrl('http://test.autodeskplm360.net/')).toBe(false)
    expect(isPlmAutodeskHttpsUrl('https://example.com/')).toBe(false)
  })

  it('assertPlmAutodeskHttpsUrl rejects non-PLM URLs', () => {
    expect(() => assertPlmAutodeskHttpsUrl('https://example.com/')).toThrow(
      /only supports https:\/\/\*\.autodeskplm360\.net/
    )
  })
})
