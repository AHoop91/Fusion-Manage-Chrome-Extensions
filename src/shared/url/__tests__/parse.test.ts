import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isAddItemPage,
  isFusionHost,
  isItemDetailsPage,
  normalizeApiUrlPath,
  parseGridContextFromPageUrl,
  parseItemDetailsContextFromPageUrl,
  parseWorkspaceIdFromPlmWorkspacePath
} from '../parse'

describe('shared/url/parse', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('recognizes Fusion hosts only', () => {
    expect(isFusionHost('https://tenant.autodeskplm360.net/plm/workspaces/57/items/itemDetails')).toBe(true)
    expect(isFusionHost('https://example.com/plm/workspaces/57/items/itemDetails')).toBe(false)
  })

  it('parses item details context from a valid page URL', () => {
    expect(parseItemDetailsContextFromPageUrl(
      'https://tenant.autodeskplm360.net/plm/workspaces/57/items/itemDetails?itemId=tenant,57,14669'
    )).toEqual({ workspaceId: 57, dmsId: 14669 })

    expect(isItemDetailsPage(
      'https://tenant.autodeskplm360.net/plm/workspaces/57/items/itemDetails?itemId=tenant,57,14669'
    )).toBe(true)
  })

  it('rejects mismatched workspace IDs in page context', () => {
    expect(parseItemDetailsContextFromPageUrl(
      'https://tenant.autodeskplm360.net/plm/workspaces/57/items/itemDetails?itemId=tenant,99,14669'
    )).toBeNull()
  })

  it('parses grid context only for supported grid view URLs', () => {
    expect(parseGridContextFromPageUrl(
      'https://tenant.autodeskplm360.net/plm/workspaces/57/items/grid?tab=grid&view=full&mode=view&itemId=tenant,57,14669'
    )).toEqual({ workspaceId: 57, dmsId: 14669 })

    expect(parseGridContextFromPageUrl(
      'https://tenant.autodeskplm360.net/plm/workspaces/57/items/grid?tab=details&view=full&mode=view&itemId=tenant,57,14669'
    )).toBeNull()
  })

  it('detects supported add-item URLs', () => {
    expect(isAddItemPage(
      'https://tenant.autodeskplm360.net/plm/workspaces/57/items/addItem?view=split'
    )).toBe(true)

    expect(isAddItemPage(
      'https://tenant.autodeskplm360.net/plm/workspaces/57/items/addItem?view=compact'
    )).toBe(false)
  })

  it('parses workspace IDs from workspace paths', () => {
    expect(parseWorkspaceIdFromPlmWorkspacePath(
      'https://tenant.autodeskplm360.net/plm/workspaces/57/items/grid'
    )).toBe(57)

    expect(parseWorkspaceIdFromPlmWorkspacePath('https://tenant.autodeskplm360.net/plm/nope')).toBeNull()
  })

  it('normalizes API URL paths relative to the current origin', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'https://tenant.autodeskplm360.net'
      }
    })

    expect(normalizeApiUrlPath('/api/v3/workspaces/57/items')).toBe('/api/v3/workspaces/57/items')
    expect(normalizeApiUrlPath('api/v3/workspaces/57/items')).toBe('/api/v3/workspaces/57/items')
    expect(normalizeApiUrlPath('https://tenant.autodeskplm360.net/api/v3/workspaces/57/items?foo=bar')).toBe('/api/v3/workspaces/57/items?foo=bar')
    expect(normalizeApiUrlPath('https://example.com/api/v3/workspaces/57/items')).toBe('')
    expect(normalizeApiUrlPath('//example.com/api/v3/workspaces/57/items')).toBe('')
  })
})
