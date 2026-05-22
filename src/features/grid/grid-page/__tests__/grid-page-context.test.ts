import { describe, expect, it } from 'vitest'
import {
  isGridEditPage,
  isGridPage,
  isStrictGridPage,
  parseGridPageContext,
  parseGridRouteContext
} from '../grid-page-context'

const GRID_BASE = 'https://test.autodeskplm360.net/plm/workspaces/42/items/grid'

function gridUrl(params: Record<string, string>): string {
  const search = new URLSearchParams(params)
  return `${GRID_BASE}?${search.toString()}`
}

describe('grid-page-context', () => {
  it('parseGridRouteContext accepts supported grid routes', () => {
    const url = gridUrl({
      tab: 'grid',
      view: 'full',
      mode: 'view',
      itemId: encodeURIComponent('WS,42,1001')
    })
    expect(parseGridRouteContext(url)).toEqual({
      workspaceId: 42,
      dmsId: 1001,
      mode: 'view'
    })
    expect(isGridPage(url)).toBe(true)
  })

  it('parseGridPageContext requires strict view mode', () => {
    const viewUrl = gridUrl({
      tab: 'grid',
      view: 'full',
      mode: 'view',
      itemId: encodeURIComponent('WS,42,1001')
    })
    const editUrl = gridUrl({
      tab: 'grid',
      view: 'full',
      mode: 'edit',
      itemId: encodeURIComponent('WS,42,1001')
    })

    expect(parseGridPageContext(viewUrl)).toEqual({ workspaceId: 42, dmsId: 1001 })
    expect(isStrictGridPage(viewUrl)).toBe(true)
    expect(parseGridPageContext(editUrl)).toBeNull()
    expect(isStrictGridPage(editUrl)).toBe(false)
    expect(parseGridRouteContext(editUrl)?.mode).toBe('edit')
    expect(isGridEditPage(editUrl)).toBe(true)
  })

  it('rejects mismatched workspace ids and unsupported views', () => {
    const mismatched = gridUrl({
      tab: 'grid',
      view: 'full',
      mode: 'view',
      itemId: encodeURIComponent('WS,99,1001')
    })
    const badView = gridUrl({
      tab: 'grid',
      view: 'list',
      mode: 'view',
      itemId: encodeURIComponent('WS,42,1001')
    })

    expect(parseGridRouteContext(mismatched)).toBeNull()
    expect(parseGridRouteContext(badView)).toBeNull()
    expect(isGridPage(mismatched)).toBe(false)
  })
})
