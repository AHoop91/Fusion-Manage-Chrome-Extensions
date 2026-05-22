import type {
  ItemSelectorAttachment,
  ItemSelectorDetailSection,
  ItemSelectorSearchField,
  ItemSelectorSearchFilterPatch,
  ItemSelectorSearchFilterGroup,
  ItemSelectorSearchResult
} from './types'

/**
 * Shared contract between item-selector session/controller and the search UI (`SearchDialogModal`).
 */
export type ItemSelectorSearchSnapshot = {
  advancedMode: boolean
  searchQuery: string
  groupLogicExpression: string
  availableSearchFields: ItemSelectorSearchField[]
  appliedSearchFilterGroups: ItemSelectorSearchFilterGroup[]
  searchQueryPreview: string
  searchResults: ItemSelectorSearchResult[]
  detailsItemId: number | null
  detailsItemLabel: string
  detailsSections: ItemSelectorDetailSection[]
  detailsLoading: boolean
  detailsError: string | null
  attachments: ItemSelectorAttachment[]
  attachmentsLoading: boolean
  attachmentsError: string | null
  selectedSourceItemId: number | null
  totalResults: number
  loading: boolean
}

export type ItemSelectorSearchHandlers = {
  onSearchInput: (value: string) => void
  onToggleAdvancedMode: (nextAdvancedMode: boolean) => void
  onGroupLogicExpressionChange: (value: string) => void
  onSearchSubmit: () => void
  onSelectResult: (itemId: number) => void
  onLoadItemDetails: (itemId: number) => void
  onCloseDetails: () => void
  onLoadMoreResults: () => void
  onChangeSearchFilter: (
    groupId: string,
    filterId: string,
    patch: ItemSelectorSearchFilterPatch
  ) => void
  onAddGroup: () => void
  onRemoveGroup: (groupId: string) => void
  onAddFilterRow: (groupId: string) => void
  onRemoveFilterRow: (groupId: string, filterId: string) => void
}
