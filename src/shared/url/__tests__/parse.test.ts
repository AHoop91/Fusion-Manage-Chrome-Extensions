// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  isAddItemPage,
  isFusionHost,
  isItemDetailsPage,
  matchesCwComponentsItemChromeRoute,
  normalizeApiUrlPath,
  normalizeFusionManageApiReferenceToPath,
  parseGridContextFromPageUrl,
  parseItemDetailsContextFromPageUrl,
  parseWorkspaceIdFromPlmWorkspacePath
} from '../parse'

describe('shared/url/parse', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('recognizes Fusion hosts only', () => {
    expect(isFusionHost('https://test.autodeskplm360.net/plm/workspaces/57/items/itemDetails')).toBe(true)
    expect(isFusionHost('https://example.com/plm/workspaces/57/items/itemDetails')).toBe(false)
  })

  it('parses item details context from a valid page URL', () => {
    expect(parseItemDetailsContextFromPageUrl(
      'https://test.autodeskplm360.net/plm/workspaces/57/items/itemDetails?itemId=test,57,14669'
    )).toEqual({ workspaceId: 57, dmsId: 14669 })

    expect(isItemDetailsPage(
      'https://test.autodeskplm360.net/plm/workspaces/57/items/itemDetails?itemId=test,57,14669'
    )).toBe(true)
  })

  it('rejects mismatched workspace IDs in page context', () => {
    expect(parseItemDetailsContextFromPageUrl(
      'https://test.autodeskplm360.net/plm/workspaces/57/items/itemDetails?itemId=test,99,14669'
    )).toBeNull()
  })

  it('parses grid context only for supported grid view URLs', () => {
    expect(parseGridContextFromPageUrl(
      'https://test.autodeskplm360.net/plm/workspaces/57/items/grid?tab=grid&view=full&mode=view&itemId=test,57,14669'
    )).toEqual({ workspaceId: 57, dmsId: 14669 })

    expect(parseGridContextFromPageUrl(
      'https://test.autodeskplm360.net/plm/workspaces/57/items/grid?tab=details&view=full&mode=view&itemId=test,57,14669'
    )).toBeNull()
  })

  it('detects supported add-item URLs', () => {
    expect(isAddItemPage(
      'https://test.autodeskplm360.net/plm/workspaces/57/items/addItem?view=split'
    )).toBe(true)

    expect(isAddItemPage(
      'https://test.autodeskplm360.net/plm/workspaces/57/items/addItem?view=compact'
    )).toBe(false)
  })

  it('matches CW Design item chrome routes (details tab, view mode)', () => {
    const base =
      'https://test.autodeskplm360.net/plm/workspaces/57/items/itemDetails?view=full&tab=details&mode=view'
    expect(matchesCwComponentsItemChromeRoute(`${base}&itemId=urn%60adsk%2Cplm%60tenant%2Cworkspace%2Citem%60TEST%2C57%2C15511`)).toBe(true)
    expect(matchesCwComponentsItemChromeRoute(`${base}&itemId=test,57,15511`)).toBe(true)
    expect(matchesCwComponentsItemChromeRoute(`${base.replace('full', 'split')}&itemId=x`)).toBe(true)

    expect(matchesCwComponentsItemChromeRoute(`${base}`)).toBe(false)
    expect(matchesCwComponentsItemChromeRoute(base.replace('tab=details', 'tab=grid'))).toBe(false)
    expect(
      matchesCwComponentsItemChromeRoute(
        'https://test.autodeskplm360.net/plm/workspaces/57/items/itemDetails?view=compact&tab=details&mode=view&itemId=x'
      )
    ).toBe(false)
  })

  it('parses workspace IDs from workspace paths', () => {
    expect(parseWorkspaceIdFromPlmWorkspacePath(
      'https://test.autodeskplm360.net/plm/workspaces/57/items/grid'
    )).toBe(57)

    expect(parseWorkspaceIdFromPlmWorkspacePath('https://test.autodeskplm360.net/plm/nope')).toBeNull()
  })

  it('normalizes API URL paths relative to the current origin', () => {
    vi.stubGlobal('window', {
      location: {
        origin: 'https://test.autodeskplm360.net'
      }
    })

    expect(normalizeApiUrlPath('/api/v3/workspaces/57/items')).toBe('/api/v3/workspaces/57/items')
    expect(normalizeApiUrlPath('api/v3/workspaces/57/items')).toBe('/api/v3/workspaces/57/items')
    expect(normalizeApiUrlPath('https://test.autodeskplm360.net/api/v3/workspaces/57/items?foo=bar')).toBe('/api/v3/workspaces/57/items?foo=bar')
    expect(normalizeApiUrlPath('https://example.com/api/v3/workspaces/57/items')).toBe('')
    expect(normalizeApiUrlPath('//example.com/api/v3/workspaces/57/items')).toBe('')
  })

  it('normalizes Fusion Manage absolute API references without window', () => {
    expect(
      normalizeFusionManageApiReferenceToPath(
        'https://test.autodeskplm360.net/api/v3/lookups/CUSTOM_LOOKUP/options/1'
      )
    ).toBe('/api/v3/lookups/CUSTOM_LOOKUP/options/1')

    expect(
      normalizeFusionManageApiReferenceToPath('https://test.autodeskplm360.net/api/v3/workspaces/98/items/9849')
    ).toBe('/api/v3/workspaces/98/items/9849')

    expect(normalizeFusionManageApiReferenceToPath('/api/v3/workspaces/57/items')).toBe('/api/v3/workspaces/57/items')
    expect(normalizeFusionManageApiReferenceToPath('api/v3/workspaces/57/items')).toBe('/api/v3/workspaces/57/items')
    expect(normalizeFusionManageApiReferenceToPath('')).toBe('')
    expect(normalizeFusionManageApiReferenceToPath('https://example.com/api/v3/workspaces/57/items')).toBe('')
    expect(normalizeFusionManageApiReferenceToPath('//evil.com/api/v3/workspaces/57/items')).toBe('')
    expect(normalizeFusionManageApiReferenceToPath('https://test.autodeskplm360.net/plm/workspaces/57')).toBe('')
  })
})
