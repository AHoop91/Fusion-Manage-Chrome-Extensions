import { describe, expect, it } from 'vitest'
import { parseViewDefFieldIdFromLink, parseViewDefIdFromLink } from '../services/form/viewDefLinks'

describe('bom clone form/viewDefLinks', () => {
  it('parses the view definition id from API links', () => {
    expect(parseViewDefIdFromLink('/api/v3/workspaces/57/views/4/viewdef/99')).toBe(99)
    expect(parseViewDefIdFromLink('api/v3/workspaces/57/views/4/viewdef/123?foo=1')).toBe(123)
    expect(parseViewDefIdFromLink('')).toBeNull()
    expect(parseViewDefIdFromLink('/api/v3/workspaces/57/views/4')).toBeNull()
  })

  it('parses field ids from API field links', () => {
    expect(parseViewDefFieldIdFromLink('/api/v3/workspaces/57/viewdef/99/fields/732')).toBe('732')
    expect(parseViewDefFieldIdFromLink('api/v3/workspaces/57/viewdef/99/fields/1001')).toBe('1001')
    expect(parseViewDefFieldIdFromLink(null)).toBeNull()
  })
})
