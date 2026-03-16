import type {
  ItemSelectorAttachment,
  ItemSelectorContext,
  ItemSelectorDetailSection,
  ItemSelectorSearchField,
  ItemSelectorSearchFilter,
  ItemSelectorSearchFilterPatch,
  ItemSelectorSearchResult,
  ItemSelectorSearchFilterGroup
} from './types'
import type { ItemSelectorService } from './service'
import { groupRefFromIndex, normalizeItemDetailsFieldId } from './helpers'

// Session orchestrates search state transitions and delegates data access to the service.
// It keeps workflow-independent selector behavior out of feature-specific controllers.
type ItemSelectorSnapshot = {
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

type ItemSelectorStatePort = {
  getSnapshot: () => ItemSelectorSnapshot
  setAdvancedMode: (value: boolean) => void
  setSearchQuery: (value: string) => void
  setGroupLogicExpression: (value: string) => void
  setAvailableSearchFields: (fields: ItemSelectorSearchField[]) => void
  setAppliedSearchFilterGroups: (groups: ItemSelectorSearchFilterGroup[]) => void
  setSearchQueryPreview: (preview: string) => void
  setSearchResults: (items: ItemSelectorSnapshot['searchResults'], totalResults: number) => void
  appendSearchResults: (items: ItemSelectorSnapshot['searchResults'], totalResults: number) => void
  setDetailsItem: (itemId: number | null, itemLabel: string) => void
  setDetailsSections: (sections: ItemSelectorDetailSection[]) => void
  setDetailsLoading: (loading: boolean) => void
  setDetailsError: (message: string | null) => void
  setAttachments: (attachments: ItemSelectorAttachment[]) => void
  setAttachmentsLoading: (loading: boolean) => void
  setAttachmentsError: (message: string | null) => void
  setPagination: (offset: number, limit: number) => void
  setErrorMessage: (message: string | null) => void
  setLoading: (loading: boolean) => void
}

type ItemSelectorSessionDeps = {
  service: ItemSelectorService
  state: ItemSelectorStatePort
  getContext: () => (ItemSelectorContext & { currentItemId: number }) | null
  nextGroupId: () => string
  nextFilterId: () => string
  render: () => void
  onSearchFailure: (error: unknown) => void
  onFieldLoadFailure: (error: unknown) => void
  onEnabled: () => void
}

type ItemSelectorSession = {
  initialize: () => Promise<void>
  onSearchInput: (value: string) => void
  onToggleAdvancedMode: (nextAdvancedMode: boolean) => void
  onGroupLogicExpressionChange: (value: string) => void
  onChangeSearchFilter: (
    groupId: string,
    filterId: string,
    patch: ItemSelectorSearchFilterPatch
  ) => void
  onAddGroup: () => void
  onRemoveGroup: (groupId: string) => void
  onAddFilterRow: (groupId: string) => void
  onRemoveFilterRow: (groupId: string, filterId: string) => void
  runSearch: (offset: number, append: boolean) => Promise<void>
  loadItemDetails: (itemId: number) => Promise<void>
  closeDetails: () => void
  canLoadMore: () => boolean
}

function sanitizeQueryValue(raw: string): string {
  return raw.replace(/[`():<>=\\/\]\[\{\}]/g, '').trim()
}

function buildDefaultGroupLogicExpression(groupCount: number): string {
  if (groupCount <= 0) return ''
  const refs: string[] = []
  for (let index = 0; index < groupCount; index += 1) refs.push(groupRefFromIndex(index))
  return refs.join(' AND ')
}

function parseLogicExpression(expression: string): string[] {
  const source = expression.trim().toUpperCase()
  if (!source) return []

  const tokens: string[] = []
  let index = 0
  while (index < source.length) {
    const char = source[index]
    if (char === ' ') {
      index += 1
      continue
    }
    if (char === '(' || char === ')') {
      tokens.push(char)
      index += 1
      continue
    }
    if (!/[A-Z]/.test(char)) throw new Error('Unsupported character in group logic expression.')

    let word = ''
    while (index < source.length && /[A-Z]/.test(source[index])) {
      word += source[index]
      index += 1
    }

    if (word === 'GROUP') {
      while (index < source.length && source[index] === ' ') index += 1
      let groupRef = ''
      while (index < source.length && /[A-Z]/.test(source[index])) {
        groupRef += source[index]
        index += 1
      }
      if (!groupRef) throw new Error('Expected group reference after GROUP keyword.')
      tokens.push(groupRef)
      continue
    }

    tokens.push(word)
  }
  return tokens
}

function composeGroupExpression(
  expression: string,
  groupClauses: Map<string, string>,
  format: 'preview' | 'query'
): string {
  const orderedRefs = Array.from(groupClauses.keys())
  if (orderedRefs.length === 0) return ''

  const defaultExpression = buildDefaultGroupLogicExpression(orderedRefs.length)
  const source = expression.trim() || defaultExpression
  const tokens = parseLogicExpression(source)
  if (tokens.length === 0) return ''

  let cursor = 0
  const andToken = format === 'query' ? '+AND+' : ' AND '
  const orToken = format === 'query' ? '+OR+' : ' OR '

  function parseExpressionNode(): string {
    let node = parseTermNode()
    while (cursor < tokens.length && tokens[cursor] === 'OR') {
      cursor += 1
      const rhs = parseTermNode()
      node = `(${node}${orToken}${rhs})`
    }
    return node
  }

  function parseTermNode(): string {
    let node = parseFactorNode()
    while (cursor < tokens.length && tokens[cursor] === 'AND') {
      cursor += 1
      const rhs = parseFactorNode()
      node = `(${node}${andToken}${rhs})`
    }
    return node
  }

  function parseFactorNode(): string {
    if (cursor >= tokens.length) throw new Error('Unexpected end of group logic expression.')
    const token = tokens[cursor]

    if (token === '(') {
      cursor += 1
      const nested = parseExpressionNode()
      if (tokens[cursor] !== ')') throw new Error('Missing closing parenthesis in group logic expression.')
      cursor += 1
      return `(${nested})`
    }

    if (token === ')' || token === 'AND' || token === 'OR') {
      throw new Error(`Unexpected token "${token}" in group logic expression.`)
    }

    const clause = groupClauses.get(token)
    if (!clause) throw new Error(`Unknown group reference "${token}" in group logic expression.`)
    cursor += 1
    return clause
  }

  const result = parseExpressionNode()
  if (cursor < tokens.length) throw new Error(`Unexpected token "${tokens[cursor]}" in group logic expression.`)
  return result
}

function buildGroupClauseMaps(groups: ItemSelectorSearchFilterGroup[]): {
  preview: Map<string, string>
  query: Map<string, string>
} {
  const preview = new Map<string, string>()
  const query = new Map<string, string>()

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex]
    const active = group.filters.filter((filter) => filter.value.trim().length > 0)
    if (active.length === 0) continue
    const ref = groupRefFromIndex(groupIndex)

    let previewClause = ''
    let queryClause = ''
    for (let index = 0; index < active.length; index += 1) {
      const filter = active[index]
      const value = sanitizeQueryValue(filter.value.trim())
      if (!value) continue
      const fieldId = normalizeItemDetailsFieldId(filter.fieldId)
      const previewPiece = `ITEM_DETAILS:${fieldId}=${value}`
      const queryPiece = `ITEM_DETAILS:${fieldId}=${value}`

      previewClause += previewPiece
      queryClause += queryPiece
      if (index < active.length - 1) {
        previewClause += filter.joinWithNext === 'OR' ? ' OR ' : ' AND '
        queryClause += filter.joinWithNext === 'OR' ? '+OR+' : '+AND+'
      }
    }

    preview.set(ref, active.length > 1 ? `(${previewClause})` : previewClause)
    query.set(ref, active.length > 1 ? `(${queryClause})` : queryClause)
  }

  return { preview, query }
}

export function createItemSelectorSession(deps: ItemSelectorSessionDeps): ItemSelectorSession {
  let reachedEndOfResults = false

  function clearDetailsAndAttachments(): void {
    deps.state.setDetailsItem(null, '')
    deps.state.setDetailsSections([])
    deps.state.setDetailsError(null)
    deps.state.setDetailsLoading(false)
    deps.state.setAttachments([])
    deps.state.setAttachmentsError(null)
    deps.state.setAttachmentsLoading(false)
  }

  function resolveFieldById(fieldId: string): ItemSelectorSearchField | null {
    const snapshot = deps.state.getSnapshot()
    return snapshot.availableSearchFields.find((field) => field.id === fieldId) || null
  }

  function toDefaultFilter(field: ItemSelectorSearchField): ItemSelectorSearchFilter {
    return {
      filterId: deps.nextFilterId(),
      fieldId: field.id,
      fieldLabel: field.sectionLabel ? `${field.sectionLabel} > ${field.label}` : field.label,
      value: '',
      operator: 'contains',
      joinWithNext: 'AND'
    }
  }

  function syncSearchQueryPreview(): void {
    const snapshot = deps.state.getSnapshot()
    if (!snapshot.advancedMode) {
      const basicValue = sanitizeQueryValue(snapshot.searchQuery.trim()) || '{value}'
      deps.state.setSearchQueryPreview(`${basicValue}`)
      return
    }
    try {
      const clauses = buildGroupClauseMaps(snapshot.appliedSearchFilterGroups)
      const preview = composeGroupExpression(snapshot.groupLogicExpression, clauses.preview, 'preview')
      deps.state.setSearchQueryPreview(preview || '{set field values to build query}')
    } catch {
      deps.state.setSearchQueryPreview('{invalid group logic expression}')
    }
  }

  function maybeEnsureDefaultGroupLogicExpression(): void {
    const snapshot = deps.state.getSnapshot()
    if (snapshot.groupLogicExpression.trim().length > 0) return
    deps.state.setGroupLogicExpression(buildDefaultGroupLogicExpression(snapshot.appliedSearchFilterGroups.length))
  }

  return {
    async initialize() {
      const context = deps.getContext()
      if (!context) return

      try {
        const fields = await deps.service.fetchWorkspaceFields({
          tenant: context.tenant,
          workspaceId: context.workspaceId
        })
        deps.state.setAvailableSearchFields(fields)
        const fallbackField = fields[0] || null
        deps.state.setAppliedSearchFilterGroups(
          fallbackField
            ? [{ groupId: deps.nextGroupId(), joinWithNext: 'AND', filters: [toDefaultFilter(fallbackField)] }]
            : []
        )
        deps.state.setGroupLogicExpression(buildDefaultGroupLogicExpression(fallbackField ? 1 : 0))
        syncSearchQueryPreview()
        deps.onEnabled()
        deps.render()
      } catch (error) {
        // Workspace field metadata should not block the selector.
        // Fallback to basic/direct search mode when metadata fetch fails.
        deps.state.setAdvancedMode(false)
        deps.state.setAvailableSearchFields([])
        deps.state.setAppliedSearchFilterGroups([])
        deps.state.setGroupLogicExpression('')
        deps.state.setErrorMessage(null)
        syncSearchQueryPreview()
        deps.onEnabled()
        deps.onFieldLoadFailure(error)
        deps.render()
      }
    },
    onSearchInput(value) {
      deps.state.setSearchQuery(value)
      syncSearchQueryPreview()
      deps.render()
    },
    onToggleAdvancedMode(nextAdvancedMode) {
      deps.state.setAdvancedMode(nextAdvancedMode)
      if (nextAdvancedMode) maybeEnsureDefaultGroupLogicExpression()
      syncSearchQueryPreview()
      deps.render()
    },
    onGroupLogicExpressionChange(value) {
      deps.state.setGroupLogicExpression(value)
      syncSearchQueryPreview()
      deps.render()
    },
    onChangeSearchFilter(groupId, filterId, patch) {
      const snapshot = deps.state.getSnapshot()
      const nextGroups = snapshot.appliedSearchFilterGroups.map((group) => {
        if (group.groupId !== groupId) return group
        return {
          ...group,
          filters: group.filters.map((filter) => {
            if (filter.filterId !== filterId) return filter
            const nextFieldId = patch.fieldId || filter.fieldId
            const resolvedField = resolveFieldById(nextFieldId)
            return {
              ...filter,
              ...patch,
              fieldId: nextFieldId,
              fieldLabel: resolvedField
                ? (resolvedField.sectionLabel ? `${resolvedField.sectionLabel} > ${resolvedField.label}` : resolvedField.label)
                : filter.fieldLabel
            }
          })
        }
      })
      deps.state.setAppliedSearchFilterGroups(nextGroups)
      syncSearchQueryPreview()
      deps.render()
    },
    onAddGroup() {
      const fallbackField = deps.state.getSnapshot().availableSearchFields[0]
      if (!fallbackField) return
      const nextGroups = [
        ...deps.state.getSnapshot().appliedSearchFilterGroups,
        {
          groupId: deps.nextGroupId(),
          joinWithNext: 'OR' as const,
          filters: [toDefaultFilter(fallbackField)]
        }
      ]
      deps.state.setAppliedSearchFilterGroups(nextGroups)
      deps.state.setGroupLogicExpression(buildDefaultGroupLogicExpression(nextGroups.length))
      syncSearchQueryPreview()
      deps.render()
    },
    onRemoveGroup(groupId) {
      const nextGroups = deps.state.getSnapshot().appliedSearchFilterGroups.filter((group) => group.groupId !== groupId)
      deps.state.setAppliedSearchFilterGroups(nextGroups)
      deps.state.setGroupLogicExpression(buildDefaultGroupLogicExpression(nextGroups.length))
      syncSearchQueryPreview()
      deps.render()
    },
    onAddFilterRow(groupId) {
      const fallbackField = deps.state.getSnapshot().availableSearchFields[0]
      if (!fallbackField) return
      deps.state.setAppliedSearchFilterGroups(
        deps.state.getSnapshot().appliedSearchFilterGroups.map((group) => (
          group.groupId === groupId
            ? { ...group, filters: [...group.filters, toDefaultFilter(fallbackField)] }
            : group
        ))
      )
      syncSearchQueryPreview()
      deps.render()
    },
    onRemoveFilterRow(groupId, filterId) {
      deps.state.setAppliedSearchFilterGroups(
        deps.state.getSnapshot().appliedSearchFilterGroups.map((group) => (
          group.groupId === groupId
            ? { ...group, filters: group.filters.filter((filter) => filter.filterId !== filterId) }
            : group
        ))
      )
      syncSearchQueryPreview()
      deps.render()
    },
    async runSearch(offset, append) {
      const context = deps.getContext()
      if (!context) return
      const snapshot = deps.state.getSnapshot()
      if (!append) reachedEndOfResults = false
      deps.state.setLoading(true)
      deps.state.setPagination(offset, snapshot.limit)
      if (!append) {
        deps.state.setErrorMessage(null)
        clearDetailsAndAttachments()
      }
      deps.render()

      try {
        let searchGroups: ItemSelectorSearchFilterGroup[] = []
        let searchQuery = ''

        if (snapshot.advancedMode) {
          const clauseMaps = buildGroupClauseMaps(snapshot.appliedSearchFilterGroups)
          if (clauseMaps.query.size === 0) {
            deps.state.setErrorMessage('Add at least one filter value before searching.')
            deps.state.setLoading(false)
            deps.render()
            return
          }
          searchGroups = snapshot.appliedSearchFilterGroups
          searchQuery = composeGroupExpression(snapshot.groupLogicExpression, clauseMaps.query, 'query')
        } else {
          const basicValue = snapshot.searchQuery.trim()
          const sanitizedBasicValue = sanitizeQueryValue(basicValue)
          if (!sanitizedBasicValue) {
            deps.state.setErrorMessage('Enter a value to search by Item Descriptor.')
            deps.state.setLoading(false)
            deps.render()
            return
          }
          searchGroups = [{
            groupId: 'basic',
            joinWithNext: 'AND',
            filters: [{
              filterId: 'basic-filter',
              fieldId: 'itemDescriptor',
              fieldLabel: 'Item Descriptor',
              value: sanitizedBasicValue,
              operator: 'contains',
              joinWithNext: 'AND'
            }]
          }]
          searchQuery = sanitizedBasicValue
        }

        const result = await deps.service.searchItems(
          {
            tenant: context.tenant,
            workspaceId: context.workspaceId,
            excludedItemId: context.currentItemId
          },
          searchGroups,
          offset,
          snapshot.limit,
          searchQuery
        )
        if (append) {
          if (result.items.length === 0) {
            reachedEndOfResults = true
            deps.state.setSearchResults(snapshot.searchResults, Math.max(snapshot.totalResults, result.totalResults))
          } else {
            const mergedCount = snapshot.searchResults.length + result.items.length
            if (mergedCount >= result.totalResults) reachedEndOfResults = true
            deps.state.appendSearchResults(result.items, result.totalResults)
          }
        } else {
          deps.state.setSearchResults(result.items, result.totalResults)
        }
        deps.onEnabled()
      } catch (error) {
        deps.state.setErrorMessage('Search failed. Please retry.')
        deps.onSearchFailure(error)
      } finally {
        deps.state.setLoading(false)
        deps.render()
      }
    },
    async loadItemDetails(itemId) {
      const context = deps.getContext()
      if (!context) return
      const snapshot = deps.state.getSnapshot()
      if (
        snapshot.detailsItemId === itemId &&
        (snapshot.detailsLoading || snapshot.detailsSections.length > 0)
      ) {
        return
      }
      const target = snapshot.searchResults.find((item) => item.id === itemId)
      if (!target) return

      const label = target.descriptor || target.title || `Item ${target.id}`
      deps.state.setDetailsItem(itemId, label)
      deps.state.setDetailsLoading(true)
      deps.state.setDetailsError(null)
      deps.state.setAttachmentsLoading(true)
      deps.state.setAttachmentsError(null)
      deps.render()

      try {
        const [sectionsResult, attachmentsResult] = await Promise.allSettled([
          deps.service.fetchItemDetails(
            {
              tenant: context.tenant,
              workspaceId: context.workspaceId
            },
            target.dmsId || target.id
          ),
          deps.service.fetchItemAttachments(
            {
              tenant: context.tenant,
              workspaceId: context.workspaceId
            },
            target.dmsId || target.id
          )
        ])

        if (sectionsResult.status === 'fulfilled') {
          deps.state.setDetailsSections(sectionsResult.value)
          deps.state.setDetailsError(null)
        } else {
          deps.state.setDetailsSections([])
          deps.state.setDetailsError(`Failed to load item details: ${String(sectionsResult.reason)}`)
        }

        if (attachmentsResult.status === 'fulfilled') {
          deps.state.setAttachments(attachmentsResult.value)
          deps.state.setAttachmentsError(null)
        } else {
          deps.state.setAttachments([])
          deps.state.setAttachmentsError(`Failed to load attachments: ${String(attachmentsResult.reason)}`)
        }
      } finally {
        deps.state.setDetailsLoading(false)
        deps.state.setAttachmentsLoading(false)
        deps.render()
      }
    },
    closeDetails() {
      clearDetailsAndAttachments()
      deps.render()
    },
    canLoadMore() {
      const snapshot = deps.state.getSnapshot()
      if (snapshot.loading) return false
      if (reachedEndOfResults) return false
      if (snapshot.searchResults.length >= snapshot.totalResults && snapshot.totalResults > 0) return false
      return true
    }
  }
}
