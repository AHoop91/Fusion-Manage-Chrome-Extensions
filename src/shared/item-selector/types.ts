// Search domain results shared across feature consumers.
export type ItemSelectorSearchResult = {
  id: number
  dmsId: number
  workspaceId: number
  descriptor: string
  revision: string
  title: string
  itemUrn?: string
}

// Normalized details row/section model for side-panel rendering.
export type ItemSelectorDetailRow = {
  label: string
  value: string
  isRichHtml?: boolean
  imageLink?: string
  imageDataUrl?: string
}

export type ItemSelectorDetailSection = {
  title: string
  rows: ItemSelectorDetailRow[]
  expandedByDefault?: boolean
}

// Normalized attachment model used by the horizontal attachment rail.
export type ItemSelectorAttachment = {
  id: string
  name: string
  resourceName: string
  extension: string
  size: number | null
  version: string
  link?: string
  viewerUrl?: string
}

// Field/filter models used by basic + advanced search modes.
export type ItemSelectorSearchField = {
  id: string
  label: string
  sectionLabel: string
}

export type ItemSelectorSearchFilter = {
  filterId: string
  fieldId: string
  fieldLabel: string
  value: string
  operator: ItemSelectorSearchFilterOperator
  joinWithNext: ItemSelectorSearchJoin
}

export type ItemSelectorSearchFilterGroup = {
  groupId: string
  joinWithNext: ItemSelectorSearchJoin
  filters: ItemSelectorSearchFilter[]
}

export type ItemSelectorSearchFilterOperator = 'contains' | 'equals'

export type ItemSelectorSearchJoin = 'AND' | 'OR'

export type ItemSelectorSearchFilterPatch = Partial<{
  fieldId: string
  value: string
  operator: ItemSelectorSearchFilterOperator
  joinWithNext: ItemSelectorSearchJoin
}>

// Runtime context required to scope the search feature.
export type ItemSelectorContext = {
  tenant: string
  workspaceId: number
  excludedItemId?: number
}
