import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createItemSelectorSession } from '../session'
import type {
  ItemSelectorAttachment,
  ItemSelectorContext,
  ItemSelectorDetailSection,
  ItemSelectorSearchField,
  ItemSelectorSearchFilterGroup,
  ItemSelectorSearchResult
} from '../types'

type SessionDeps = Parameters<typeof createItemSelectorSession>[0]
type SessionStatePort = SessionDeps['state']
type SessionService = SessionDeps['service']
type MockedSessionService = {
  fetchWorkspaceFields: ReturnType<typeof vi.fn>
  searchItems: ReturnType<typeof vi.fn>
  fetchItemDetails: ReturnType<typeof vi.fn>
  fetchItemAttachments: ReturnType<typeof vi.fn>
}

type Snapshot = {
  advancedMode: boolean
  searchQuery: string
  groupLogicExpression: string
  appliedSearchFilterGroups: ItemSelectorSearchFilterGroup[]
  availableSearchFields: ItemSelectorSearchField[]
  searchResults: ItemSelectorSearchResult[]
  detailsItemId: number | null
  detailsLoading: boolean
  detailsSections: ItemSelectorDetailSection[]
  loading: boolean
  limit: number
  totalResults: number
}

function createStatePort(snapshot: Snapshot): SessionStatePort {
  return {
    getSnapshot: () => snapshot,
    setAdvancedMode: (value: boolean) => { snapshot.advancedMode = value },
    setSearchQuery: (value: string) => { snapshot.searchQuery = value },
    setGroupLogicExpression: (value: string) => { snapshot.groupLogicExpression = value },
    setAvailableSearchFields: (fields: ItemSelectorSearchField[]) => { snapshot.availableSearchFields = fields },
    setAppliedSearchFilterGroups: (groups: ItemSelectorSearchFilterGroup[]) => { snapshot.appliedSearchFilterGroups = groups },
    setSearchQueryPreview: vi.fn(),
    setSearchResults: (items: ItemSelectorSearchResult[], totalResults: number) => {
      snapshot.searchResults = items
      snapshot.totalResults = totalResults
    },
    appendSearchResults: (items: ItemSelectorSearchResult[], totalResults: number) => {
      snapshot.searchResults = [...snapshot.searchResults, ...items]
      snapshot.totalResults = totalResults
    },
    setDetailsItem: vi.fn((itemId: number | null) => { snapshot.detailsItemId = itemId }),
    setDetailsSections: (sections: ItemSelectorDetailSection[]) => { snapshot.detailsSections = sections },
    setDetailsLoading: (loading: boolean) => { snapshot.detailsLoading = loading },
    setDetailsError: vi.fn(),
    setAttachments: vi.fn((_: ItemSelectorAttachment[]) => undefined),
    setAttachmentsLoading: vi.fn(),
    setAttachmentsError: vi.fn(),
    setPagination: vi.fn(),
    setErrorMessage: vi.fn(),
    setLoading: (loading: boolean) => { snapshot.loading = loading }
  }
}

function createContext(): ItemSelectorContext & { currentItemId: number } {
  return {
    tenant: 'test',
    workspaceId: 57,
    currentItemId: 999
  }
}

describe('item selector session', () => {
  let fields: ItemSelectorSearchField[]
  let snapshot: Snapshot
  let state: SessionStatePort
  let service: MockedSessionService
  let deps: SessionDeps

  beforeEach(() => {
    fields = [
      { id: 'DESCRIPTION', label: 'Description', sectionLabel: 'General' }
    ]
    snapshot = {
      advancedMode: false,
      searchQuery: '',
      groupLogicExpression: '',
      appliedSearchFilterGroups: [],
      availableSearchFields: [],
      searchResults: [],
      detailsItemId: null,
      detailsLoading: false,
      detailsSections: [],
      loading: false,
      limit: 25,
      totalResults: 0
    }
    state = createStatePort(snapshot)
    service = {
      fetchWorkspaceFields: vi.fn(),
      searchItems: vi.fn(),
      fetchItemDetails: vi.fn(),
      fetchItemAttachments: vi.fn()
    }
    deps = {
      service: service as unknown as SessionService,
      state,
      getContext: () => createContext(),
      nextGroupId: vi.fn(() => 'group-1'),
      nextFilterId: vi.fn(() => 'filter-1'),
      render: vi.fn(),
      onSearchFailure: vi.fn(),
      onFieldLoadFailure: vi.fn(),
      onEnabled: vi.fn()
    }
  })

  it('initializes workspace fields and creates a default advanced filter group', async () => {
    service.fetchWorkspaceFields.mockResolvedValue(fields)

    const session = createItemSelectorSession(deps)
    await session.initialize()

    expect(service.fetchWorkspaceFields).toHaveBeenCalledWith({
      tenant: 'test',
      workspaceId: 57
    })
    expect(snapshot.availableSearchFields).toEqual(fields)
    expect(snapshot.appliedSearchFilterGroups).toEqual([
      {
        groupId: 'group-1',
        joinWithNext: 'AND',
        filters: [
          {
            filterId: 'filter-1',
            fieldId: 'DESCRIPTION',
            fieldLabel: 'General > Description',
            value: '',
            operator: 'contains',
            joinWithNext: 'AND'
          }
        ]
      }
    ])
    expect(snapshot.groupLogicExpression).toBe('A')
    expect(deps.onEnabled).toHaveBeenCalledTimes(1)
    expect(deps.render).toHaveBeenCalledTimes(1)
  })

  it('falls back to basic mode when workspace fields fail to load', async () => {
    service.fetchWorkspaceFields.mockRejectedValue(new Error('boom'))
    snapshot.advancedMode = true

    const session = createItemSelectorSession(deps)
    await session.initialize()

    expect(snapshot.advancedMode).toBe(false)
    expect(snapshot.availableSearchFields).toEqual([])
    expect(snapshot.appliedSearchFilterGroups).toEqual([])
    expect(snapshot.groupLogicExpression).toBe('')
    expect(deps.onFieldLoadFailure).toHaveBeenCalledTimes(1)
    expect(deps.onEnabled).toHaveBeenCalledTimes(1)
  })

  it('blocks empty basic searches and surfaces an error', async () => {
    const session = createItemSelectorSession(deps)
    await session.runSearch(0, false)

    expect(service.searchItems).not.toHaveBeenCalled()
    expect(state.setErrorMessage).toHaveBeenCalledWith('Enter a value to search by Item Descriptor.')
  })

  it('runs a basic search and stores normalized results', async () => {
    snapshot.searchQuery = ' Rear Connector '
    service.searchItems.mockResolvedValue({
      items: [
        {
          id: 101,
          dmsId: 101,
          workspaceId: 57,
          descriptor: 'Rear Connector',
          revision: 'A',
          title: 'Rear Connector'
        }
      ],
      totalResults: 1
    })

    const session = createItemSelectorSession(deps)
    await session.runSearch(0, false)

    expect(service.searchItems).toHaveBeenCalledWith(
      {
        tenant: 'test',
        workspaceId: 57,
        excludedItemId: 999
      },
      [
        {
          groupId: 'basic',
          joinWithNext: 'AND',
          filters: [
            {
              filterId: 'basic-filter',
              fieldId: 'itemDescriptor',
              fieldLabel: 'Item Descriptor',
              value: 'Rear Connector',
              operator: 'contains',
              joinWithNext: 'AND'
            }
          ]
        }
      ],
      0,
      25,
      'Rear Connector'
    )
    expect(snapshot.searchResults).toHaveLength(1)
    expect(snapshot.totalResults).toBe(1)
    expect(deps.onEnabled).toHaveBeenCalledTimes(1)
  })

  it('loads details and attachments for a selected result', async () => {
    snapshot.searchResults = [
      {
        id: 101,
        dmsId: 5001,
        workspaceId: 57,
        descriptor: 'Rear Connector',
        revision: 'A',
        title: 'Rear Connector'
      }
    ]
    service.fetchItemDetails.mockResolvedValue([{ title: 'Details', rows: [] }])
    service.fetchItemAttachments.mockResolvedValue([{ id: '1', name: 'file', resourceName: 'file', extension: '', size: null, version: '-' }])

    const session = createItemSelectorSession(deps)
    await session.loadItemDetails(101)

    expect(service.fetchItemDetails).toHaveBeenCalledWith({ tenant: 'test', workspaceId: 57 }, 5001)
    expect(service.fetchItemAttachments).toHaveBeenCalledWith({ tenant: 'test', workspaceId: 57 }, 5001)
    expect(snapshot.detailsItemId).toBe(101)
    expect(snapshot.detailsSections).toEqual([{ title: 'Details', rows: [] }])
  })

  it('runs advanced searches, composes group expressions, and stops loading more at the end', async () => {
    snapshot.advancedMode = true
    snapshot.groupLogicExpression = 'A'
    snapshot.availableSearchFields = fields
    snapshot.appliedSearchFilterGroups = [
      {
        groupId: 'group-1',
        joinWithNext: 'AND',
        filters: [
          {
            filterId: 'filter-1',
            fieldId: 'DESCRIPTION',
            fieldLabel: 'General > Description',
            value: 'Widget',
            operator: 'contains',
            joinWithNext: 'AND'
          }
        ]
      }
    ]
    snapshot.searchResults = [
      {
        id: 50,
        dmsId: 50,
        workspaceId: 57,
        descriptor: 'Existing',
        revision: 'A',
        title: 'Existing'
      }
    ]
    snapshot.totalResults = 5
    service.searchItems.mockResolvedValueOnce({
      items: [
        {
          id: 60,
          dmsId: 60,
          workspaceId: 57,
          descriptor: 'Widget',
          revision: 'A',
          title: 'Widget'
        }
      ],
      totalResults: 2
    }).mockResolvedValueOnce({
      items: [],
      totalResults: 2
    })

    const session = createItemSelectorSession(deps)
    await session.runSearch(0, false)
    await session.runSearch(25, true)

    expect(service.searchItems).toHaveBeenNthCalledWith(
      1,
      {
        tenant: 'test',
        workspaceId: 57,
        excludedItemId: 999
      },
      snapshot.appliedSearchFilterGroups,
      0,
      25,
      'ITEM_DETAILS:DESCRIPTION=Widget'
    )
    expect(snapshot.searchResults).toEqual([
      {
        id: 60,
        dmsId: 60,
        workspaceId: 57,
        descriptor: 'Widget',
        revision: 'A',
        title: 'Widget'
      }
    ])
    expect(session.canLoadMore()).toBe(false)
  })

  it('blocks advanced searches with no populated filter values', async () => {
    snapshot.advancedMode = true
    snapshot.groupLogicExpression = 'A'
    snapshot.availableSearchFields = fields
    snapshot.appliedSearchFilterGroups = [
      {
        groupId: 'group-1',
        joinWithNext: 'AND',
        filters: [
          {
            filterId: 'filter-1',
            fieldId: 'DESCRIPTION',
            fieldLabel: 'General > Description',
            value: '   ',
            operator: 'contains',
            joinWithNext: 'AND'
          }
        ]
      }
    ]

    const session = createItemSelectorSession(deps)
    await session.runSearch(0, false)

    expect(service.searchItems).not.toHaveBeenCalled()
    expect(state.setErrorMessage).toHaveBeenCalledWith('Add at least one filter value before searching.')
  })

  it('surfaces partial details and attachment failures independently and can close details', async () => {
    snapshot.searchResults = [
      {
        id: 101,
        dmsId: 5001,
        workspaceId: 57,
        descriptor: 'Rear Connector',
        revision: 'A',
        title: 'Rear Connector'
      }
    ]
    service.fetchItemDetails.mockRejectedValue(new Error('details boom'))
    service.fetchItemAttachments.mockResolvedValue([])

    const session = createItemSelectorSession(deps)
    await session.loadItemDetails(101)

    expect(state.setDetailsError).toHaveBeenCalledWith('Failed to load item details: Error: details boom')
    expect(state.setAttachments).toHaveBeenCalledWith([])

    session.closeDetails()
    expect(state.setDetailsItem).toHaveBeenLastCalledWith(null, '')
    expect(state.setAttachments).toHaveBeenLastCalledWith([])
  })

  it('updates advanced-mode groups and renders after each structural change', () => {
    snapshot.availableSearchFields = fields
    snapshot.appliedSearchFilterGroups = [
      {
        groupId: 'group-1',
        joinWithNext: 'AND',
        filters: [
          {
            filterId: 'filter-1',
            fieldId: 'DESCRIPTION',
            fieldLabel: 'General > Description',
            value: '',
            operator: 'contains',
            joinWithNext: 'AND'
          }
        ]
      }
    ]

    const session = createItemSelectorSession(deps)
    session.onToggleAdvancedMode(true)
    session.onAddGroup()
    session.onAddFilterRow('group-1')
    session.onChangeSearchFilter('group-1', 'filter-1', { value: 'Widget', fieldId: 'DESCRIPTION' })
    session.onRemoveFilterRow('group-1', 'filter-1')
    session.onRemoveGroup('group-1')

    expect(snapshot.advancedMode).toBe(true)
    expect(snapshot.groupLogicExpression).toBe('')
    expect(deps.render).toHaveBeenCalled()
    expect(state.setSearchQueryPreview).toHaveBeenCalled()
  })

  it('fails advanced searches with invalid group expressions and reports the error', async () => {
    snapshot.advancedMode = true
    snapshot.groupLogicExpression = '(A OR'
    snapshot.availableSearchFields = fields
    snapshot.appliedSearchFilterGroups = [
      {
        groupId: 'group-1',
        joinWithNext: 'AND',
        filters: [
          {
            filterId: 'filter-1',
            fieldId: 'DESCRIPTION',
            fieldLabel: 'General > Description',
            value: 'Widget',
            operator: 'contains',
            joinWithNext: 'AND'
          }
        ]
      }
    ]

    const session = createItemSelectorSession(deps)
    await session.runSearch(0, false)

    expect(state.setErrorMessage).toHaveBeenCalledWith('Search failed. Please retry.')
    expect(deps.onSearchFailure).toHaveBeenCalledTimes(1)
    expect(service.searchItems).not.toHaveBeenCalled()
  })
})
