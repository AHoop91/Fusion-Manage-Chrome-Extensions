// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  matchesTableausPage,
  extractWsId,
  extractActiveTableauId,
  extractTenant
} from '../services/tableaus.service'

describe('tableaus/service - matchesTableausPage', () => {
  it('matches plain items list', () => {
    expect(matchesTableausPage('https://test.autodeskplm360.net/plm/workspaces/57/items')).toBe(true)
  })

  it('matches item details with view=split', () => {
    expect(matchesTableausPage('https://test.autodeskplm360.net/plm/workspaces/57/items/itemDetails?view=split&tab=details')).toBe(true)
  })

  it('does not match item details without view=split', () => {
    expect(matchesTableausPage('https://test.autodeskplm360.net/plm/workspaces/57/items/itemDetails?view=full')).toBe(false)
    expect(matchesTableausPage('https://test.autodeskplm360.net/plm/workspaces/57/items/itemDetails')).toBe(false)
  })

  it('does not match grid page', () => {
    expect(matchesTableausPage('https://test.autodeskplm360.net/plm/workspaces/57/items/grid')).toBe(false)
  })

  it('does not match unrelated paths', () => {
    expect(matchesTableausPage('https://test.autodeskplm360.net/plm/workspaces/57')).toBe(false)
    expect(matchesTableausPage('https://other.com/plm/workspaces/57/items')).toBe(false)
  })

  it('returns false for invalid URLs', () => {
    expect(matchesTableausPage('not-a-url')).toBe(false)
  })
})

describe('tableaus/service - extractWsId', () => {
  it('extracts workspace ID from items list URL', () => {
    expect(extractWsId('https://test.autodeskplm360.net/plm/workspaces/57/items')).toBe('57')
  })

  it('extracts workspace ID from item details URL', () => {
    expect(extractWsId('https://test.autodeskplm360.net/plm/workspaces/123/items/itemDetails?view=split')).toBe('123')
  })

  it('returns null for non-matching URL', () => {
    expect(extractWsId('https://test.autodeskplm360.net/plm/workspaces/57')).toBeNull()
  })
})

describe('tableaus/service - extractActiveTableauId', () => {
  it('extracts tableau query param', () => {
    expect(extractActiveTableauId('https://test.autodeskplm360.net/plm/workspaces/57/items?tableau=544')).toBe('544')
  })

  it('returns null when param absent', () => {
    expect(extractActiveTableauId('https://test.autodeskplm360.net/plm/workspaces/57/items')).toBeNull()
  })
})

describe('tableaus/service - extractTenant', () => {
  it('extracts uppercased tenant from hostname', () => {
    expect(extractTenant('https://test.autodeskplm360.net/plm/workspaces/57/items')).toBe('TEST')
  })

  it('returns null for non-PLM host', () => {
    expect(extractTenant('https://other.com/foo')).toBeNull()
  })

  it('returns null for invalid URL', () => {
    expect(extractTenant('not-a-url')).toBeNull()
  })
})
