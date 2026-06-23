// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { extractFusionApiPathFromRecord } from '../lookupOptions'

describe('shared/form/lookupOptions', () => {
  it('extractFusionApiPathFromRecord resolves absolute Fusion API URLs', () => {
    expect(
      extractFusionApiPathFromRecord({
        title: 'Item A',
        link: 'https://test.autodeskplm360.net/api/v3/workspaces/98/items/9849'
      })
    ).toBe('/api/v3/workspaces/98/items/9849')
  })

  it('extractFusionApiPathFromRecord reads nested item.workflowItem link', () => {
    expect(
      extractFusionApiPathFromRecord({
        title: 'Wrapped',
        item: {
          link: 'https://test.autodeskplm360.net/api/v3/workspaces/14/items/100'
        }
      })
    ).toBe('/api/v3/workspaces/14/items/100')
  })

  it('extractFusionApiPathFromRecord prefers __self__ when link missing', () => {
    expect(
      extractFusionApiPathFromRecord({
        title: 'X',
        __self__: 'https://test.autodeskplm360.net/api/v3/lookups/L1/options/2'
      })
    ).toBe('/api/v3/lookups/L1/options/2')
  })

  it('extractFusionApiPathFromRecord returns empty for non-Fusion hosts', () => {
    expect(
      extractFusionApiPathFromRecord({
        title: 'Bad',
        link: 'https://evil.com/api/v3/workspaces/1/items/1'
      })
    ).toBe('')
  })
})
