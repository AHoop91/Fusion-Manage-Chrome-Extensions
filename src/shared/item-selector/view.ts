import type {
  ItemSelectorAttachment,
  ItemSelectorDetailSection,
  ItemSelectorSearchField,
  ItemSelectorSearchFilterPatch,
  ItemSelectorSearchFilterGroup,
  ItemSelectorSearchResult
} from './types'
import { formatAttachmentSize, groupRefFromIndex, splitDescriptorAndRevision } from './helpers'
import { sanitizeRichHtml } from '../utils/safeRichHtml'

// Shared selector rendering for search + details + attachment panes.
// Consumed by higher-level feature views (for example BOM clone) during their search phase.
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

function clearChildren(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild)
}

function createEl<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options?: {
    className?: string
    textContent?: string
    html?: string
    attrs?: Record<string, string>
  }
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (options?.className) el.className = options.className
  if (typeof options?.textContent === 'string') el.textContent = options.textContent
  if (typeof options?.html === 'string') el.innerHTML = options.html
  if (options?.attrs) {
    for (const [name, value] of Object.entries(options.attrs)) el.setAttribute(name, value)
  }
  return el
}

function button(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const el = createEl('button', {
    className: 'md-button md-default-theme md-button md-ink-ripple plm-extension-bom-clone-btn plm-extension-btn plm-extension-btn--secondary',
    textContent: label
  })
  el.type = 'button'
  el.disabled = disabled
  el.addEventListener('click', onClick)
  return el
}

function createBouncingLoader(label: string): HTMLDivElement {
  const wrap = createEl('div', { className: 'plm-extension-bom-clone-loading-center' })

  const loader = createEl('div', { className: 'generic-loader plm-extension-loader' })
  loader.appendChild(document.createElement('div')).className = 'bounce1'
  loader.appendChild(document.createElement('div')).className = 'bounce2'
  loader.appendChild(document.createElement('div')).className = 'bounce3'

  const text = createEl('div', {
    className: 'plm-extension-bom-clone-loading-text',
    textContent: label
  })

  wrap.appendChild(loader)
  wrap.appendChild(text)
  return wrap
}

function openImagePreviewModal(imageSrc: string, altText: string): void {
  const backdrop = createEl('div', {
    className: 'plm-extension-bom-clone-image-modal-backdrop MuiDialog-container MuiDialog-scrollPaper',
    attrs: { role: 'none presentation' }
  })
  backdrop.tabIndex = -1

  const dialog = createEl('div', {
    className: 'plm-extension-bom-clone-image-modal-dialog MuiPaper-root MuiDialog-paper MuiDialog-paperScrollPaper MuiDialog-paperWidthSm MuiPaper-elevation24 MuiPaper-rounded',
    attrs: { role: 'dialog' }
  })

  const image = createEl('img', { className: 'plm-extension-bom-clone-image-modal-img' })
  image.src = imageSrc
  image.alt = altText

  dialog.appendChild(image)
  backdrop.appendChild(dialog)

  const close = (): void => {
    backdrop.remove()
    document.removeEventListener('keydown', onKeyDown)
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') close()
  }

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) close()
  })
  document.addEventListener('keydown', onKeyDown)
  document.body.appendChild(backdrop)
}

function renderResultsTable(
  container: HTMLElement,
  items: ItemSelectorSearchResult[],
  selectedSourceItemId: number | null,
  detailsItemId: number | null,
  onSelectResult: (itemId: number) => void
): void {
  const table = createEl('table', {
    className: 'plm-extension-bom-clone-table plm-extension-table',
    html: '<thead><tr><th>Descriptor</th></tr></thead>'
  })

  const tbody = document.createElement('tbody')
  for (const item of items) {
    const row = document.createElement('tr')
    const selected = selectedSourceItemId === item.id
    const descriptor = item.descriptor || item.title || `Item ${item.id}`
    const { baseDescriptor, revisionToken } = splitDescriptorAndRevision(descriptor, item.revision || '')
    const descriptorCell = createEl('td')
    const baseText = document.createElement('span')
    baseText.textContent = baseDescriptor
    descriptorCell.appendChild(baseText)
    if (revisionToken) {
      descriptorCell.appendChild(document.createTextNode(' '))
      const revision = createEl('strong', {
        className: 'plm-extension-bom-clone-revision-token',
        textContent: `[${revisionToken}]`
      })
      descriptorCell.appendChild(revision)
    }
    row.appendChild(descriptorCell)

    if (selected) row.classList.add('is-selected')
    if (detailsItemId === item.id) row.classList.add('is-details-active')
    row.style.cursor = 'pointer'
    row.addEventListener('click', () => onSelectResult(item.id))
    tbody.appendChild(row)
  }
  table.appendChild(tbody)

  clearChildren(container)
  container.appendChild(table)
}

export function renderItemSelectorSearchPhase(
  container: HTMLElement,
  snapshot: ItemSelectorSearchSnapshot,
  handlers: ItemSelectorSearchHandlers
): void {
  const twoPane = document.createElement('div')
  const hasDetailsPanel =
    snapshot.detailsLoading ||
    Boolean(snapshot.detailsError) ||
    snapshot.detailsSections.length > 0 ||
    snapshot.detailsItemId !== null ||
    snapshot.attachmentsLoading ||
    Boolean(snapshot.attachmentsError) ||
    snapshot.attachments.length > 0
  twoPane.className = `plm-extension-bom-clone-search-layout${hasDetailsPanel ? ' has-details' : ''}`

  const leftPane = document.createElement('div')
  leftPane.className = 'plm-extension-bom-clone-fields'
  const modeNote = createEl('div', {
    className: 'plm-extension-bom-clone-info-note',
    textContent: snapshot.advancedMode
      ? 'Advanced Mode supports multi-group filters with custom logic like (A AND B) OR C.'
      : 'Basic Mode searches Item Descriptor only. Use Advanced Mode for grouped field conditions.'
  })
  leftPane.appendChild(modeNote)

  const leftTitle = createEl('h4', {
    className: 'plm-extension-bom-clone-fields-title',
    textContent: snapshot.advancedMode ? 'Filters' : 'Item Descriptor Search'
  })
  leftPane.appendChild(leftTitle)
  if (!snapshot.advancedMode) {
    const basicInput = document.createElement('input')
    basicInput.className = 'plm-extension-bom-clone-input'
    basicInput.setAttribute('data-plm-focus-key', 'basic-search-input')
    basicInput.placeholder = 'Enter item descriptor value...'
    basicInput.value = snapshot.searchQuery
    basicInput.addEventListener('input', () => handlers.onSearchInput(basicInput.value))
    basicInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') handlers.onSearchSubmit()
    })
    leftPane.appendChild(basicInput)

    const basicActions = document.createElement('div')
    basicActions.className = 'plm-extension-bom-clone-toolbar'
    basicActions.appendChild(button('Search', handlers.onSearchSubmit, snapshot.loading))
    leftPane.appendChild(basicActions)
  } else {
    const logicRow = document.createElement('div')
    logicRow.className = 'plm-extension-bom-clone-group-join'
    const logicLabel = createEl('span', {
      className: 'plm-extension-bom-clone-filter-label',
      textContent: 'Group logic'
    })
    const logicInput = document.createElement('input')
    logicInput.className = 'plm-extension-bom-clone-input'
    logicInput.setAttribute('data-plm-focus-key', 'group-logic-expression')
    logicInput.placeholder = 'Example: (A AND B) OR D'
    logicInput.value = snapshot.groupLogicExpression
    logicInput.addEventListener('input', () => handlers.onGroupLogicExpressionChange(logicInput.value))
    logicRow.appendChild(logicLabel)
    logicRow.appendChild(logicInput)
    leftPane.appendChild(logicRow)

    const fieldsBySection = new Map<string, Array<{ id: string; label: string }>>()
    for (const field of snapshot.availableSearchFields) {
      const section = field.sectionLabel || 'General'
      if (!fieldsBySection.has(section)) fieldsBySection.set(section, [])
      fieldsBySection.get(section)?.push({ id: field.id, label: field.label })
    }

    const filtersWrap = document.createElement('div')
    filtersWrap.className = 'plm-extension-bom-clone-applied'

    for (let groupIndex = 0; groupIndex < snapshot.appliedSearchFilterGroups.length; groupIndex += 1) {
      const group = snapshot.appliedSearchFilterGroups[groupIndex]
      const groupWrap = document.createElement('div')
      groupWrap.className = 'plm-extension-bom-clone-group'

      const groupHeader = document.createElement('div')
      groupHeader.className = 'plm-extension-bom-clone-group-header'
      const groupPill = document.createElement('div')
      groupPill.className = 'plm-extension-bom-clone-group-pill'
      const groupTitle = createEl('span', { textContent: `Group ${groupRefFromIndex(groupIndex)}` })
      const removeGroupButton = document.createElement('button')
      removeGroupButton.type = 'button'
      removeGroupButton.className = 'plm-extension-bom-clone-group-pill-remove'
      removeGroupButton.textContent = 'x'
      removeGroupButton.setAttribute('aria-label', `Remove Group ${groupRefFromIndex(groupIndex)}`)
      removeGroupButton.title = 'Remove group'
      removeGroupButton.addEventListener('click', () => handlers.onRemoveGroup(group.groupId))
      groupPill.appendChild(groupTitle)
      groupPill.appendChild(removeGroupButton)
      groupHeader.appendChild(groupPill)
      groupWrap.appendChild(groupHeader)

      group.filters.forEach((filter, filterIndex) => {
        const row = document.createElement('div')
        row.className = 'plm-extension-bom-clone-filter-row'

        const fieldSelect = document.createElement('select')
        fieldSelect.className = 'plm-extension-bom-clone-select'
        for (const [section, options] of fieldsBySection.entries()) {
          const optGroup = document.createElement('optgroup')
          optGroup.label = section
          for (const option of options) {
            const opt = document.createElement('option')
            opt.value = option.id
            opt.textContent = option.label
            optGroup.appendChild(opt)
          }
          fieldSelect.appendChild(optGroup)
        }
        fieldSelect.value = filter.fieldId
        fieldSelect.addEventListener('change', () => {
          handlers.onChangeSearchFilter(group.groupId, filter.filterId, { fieldId: fieldSelect.value })
        })

        const operator = document.createElement('select')
        operator.className = 'plm-extension-bom-clone-select'
        operator.innerHTML = '<option value="contains">Contains</option><option value="equals">Equals</option>'
        operator.value = filter.operator
        operator.addEventListener('change', () => {
          handlers.onChangeSearchFilter(group.groupId, filter.filterId, { operator: operator.value as 'contains' | 'equals' })
        })

        const valueInput = document.createElement('input')
        valueInput.className = 'plm-extension-bom-clone-input'
        valueInput.setAttribute('data-plm-focus-key', `filter-value-${group.groupId}-${filter.filterId}`)
        valueInput.placeholder = 'Value'
        valueInput.value = filter.value
        valueInput.addEventListener('input', () => {
          handlers.onChangeSearchFilter(group.groupId, filter.filterId, { value: valueInput.value })
        })
        valueInput.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') handlers.onSearchSubmit()
        })

        row.appendChild(fieldSelect)
        row.appendChild(operator)
        row.appendChild(valueInput)

        if (filterIndex < group.filters.length - 1) {
          const joinWrap = document.createElement('div')
          joinWrap.className = 'plm-extension-bom-clone-row-action'

          const joinLabel = createEl('span', {
            className: 'plm-extension-bom-clone-join-label',
            textContent: 'Then'
          })

          const join = document.createElement('select')
          join.className = 'plm-extension-bom-clone-select plm-extension-bom-clone-join-select'
          join.innerHTML = '<option value="AND">And</option><option value="OR">Or</option>'
          join.value = filter.joinWithNext
          join.addEventListener('change', () => {
            handlers.onChangeSearchFilter(group.groupId, filter.filterId, { joinWithNext: join.value as 'AND' | 'OR' })
          })
          joinWrap.appendChild(joinLabel)
          joinWrap.appendChild(join)
          row.appendChild(joinWrap)
        } else {
          const removeWrap = document.createElement('div')
          removeWrap.className = 'plm-extension-bom-clone-row-action'
          const removeFilterButton = document.createElement('button')
          removeFilterButton.type = 'button'
          removeFilterButton.className = 'plm-extension-bom-clone-row-remove plm-extension-btn plm-extension-btn--secondary'
          removeFilterButton.textContent = 'Remove'
          removeFilterButton.addEventListener('click', () => handlers.onRemoveFilterRow(group.groupId, filter.filterId))
          removeWrap.appendChild(removeFilterButton)
          row.appendChild(removeWrap)
        }

        groupWrap.appendChild(row)
      })

      groupWrap.appendChild(button('Add Condition', () => handlers.onAddFilterRow(group.groupId)))
      filtersWrap.appendChild(groupWrap)
    }

    if (snapshot.appliedSearchFilterGroups.length === 0) {
      const empty = createEl('div', {
        className: 'plm-extension-bom-clone-query-preview',
        textContent: 'No filter groups configured. Click "Add Group" to start.'
      })
      filtersWrap.appendChild(empty)
    }

    leftPane.appendChild(filtersWrap)

    const leftActions = document.createElement('div')
    leftActions.className = 'plm-extension-bom-clone-toolbar'
    leftActions.appendChild(button('Add Group', handlers.onAddGroup, snapshot.loading))
    leftActions.appendChild(button('Search', handlers.onSearchSubmit, snapshot.loading))
    leftPane.appendChild(leftActions)
  }

  const tablePane = document.createElement('div')
  tablePane.className = 'plm-extension-bom-clone-main'

  const queryPreview = createEl('div', {
    className: 'plm-extension-bom-clone-query-preview',
    textContent: `Query: ${snapshot.searchQueryPreview || '{set field values to build query}'}`
  })
  tablePane.appendChild(queryPreview)

  const results = document.createElement('div')
  results.className = 'plm-extension-bom-clone-results'
  const resultsBody = document.createElement('div')
  resultsBody.className = 'plm-extension-bom-clone-results-body'
  if (snapshot.loading && snapshot.searchResults.length === 0) {
    resultsBody.appendChild(createBouncingLoader('Loading search results...'))
  } else {
    renderResultsTable(
      resultsBody,
      snapshot.searchResults,
      snapshot.selectedSourceItemId,
      snapshot.detailsItemId,
      handlers.onSelectResult
    )
  }
  const resultsFooter = createEl('div', {
    className: 'plm-extension-bom-clone-results-footer',
    textContent: `${snapshot.searchResults.length} of ${snapshot.totalResults} results`
  })
  results.appendChild(resultsBody)
  results.appendChild(resultsFooter)
  const hasMoreResults = snapshot.searchResults.length < snapshot.totalResults
  resultsBody.addEventListener('scroll', () => {
    if (snapshot.loading || !hasMoreResults) return
    const remaining = resultsBody.scrollHeight - resultsBody.scrollTop - resultsBody.clientHeight
    if (remaining <= 40) handlers.onLoadMoreResults()
  })
  tablePane.appendChild(results)

  const detailsColumn = document.createElement('div')
  detailsColumn.className = `plm-extension-bom-clone-details-column${hasDetailsPanel ? ' is-visible' : ''}`

  const detailsPane = document.createElement('div')
  detailsPane.className = 'plm-extension-bom-clone-details'

  const detailsHeader = document.createElement('div')
  detailsHeader.className = 'plm-extension-bom-clone-details-header'
  const detailsTitle = createEl('h4', {
    className: 'plm-extension-bom-clone-details-title',
    textContent: snapshot.detailsItemLabel
      ? `Item Details: ${snapshot.detailsItemLabel}`
      : 'Item Details'
  })
  const detailsClose = document.createElement('button')
  detailsClose.type = 'button'
  detailsClose.className = 'plm-extension-bom-clone-details-close'
  detailsClose.setAttribute('aria-label', 'Close details pane')
  detailsClose.title = 'Close details pane'
  detailsClose.textContent = 'x'
  detailsClose.addEventListener('click', handlers.onCloseDetails)
  detailsHeader.appendChild(detailsTitle)
  detailsHeader.appendChild(detailsClose)
  detailsPane.appendChild(detailsHeader)

  const detailsBody = document.createElement('div')
  detailsBody.className = 'plm-extension-bom-clone-details-body'
  if (snapshot.detailsLoading) {
    detailsBody.appendChild(createBouncingLoader('Loading item details...'))
  } else if (snapshot.detailsError) {
    const error = createEl('p', {
      className: 'plm-extension-bom-clone-error',
      textContent: snapshot.detailsError
    })
    detailsBody.appendChild(error)
  } else if (snapshot.detailsSections.length === 0) {
    const empty = createEl('p', {
      className: 'plm-extension-bom-clone-details-note',
      textContent: 'Select a row to view item details.'
    })
    detailsBody.appendChild(empty)
  } else {
    for (const section of snapshot.detailsSections) {
      const sectionWrap = document.createElement('details')
      sectionWrap.className = 'plm-extension-bom-clone-details-section'
      sectionWrap.open = section.expandedByDefault !== false

      const summary = createEl('summary', {
        className: 'plm-extension-bom-clone-details-section-title',
        textContent: section.title
      })
      sectionWrap.appendChild(summary)

      const detailsTable = document.createElement('table')
      detailsTable.className = 'plm-extension-bom-clone-details-table plm-extension-table'
      detailsTable.innerHTML = '<thead><tr><th>Field</th><th>Value</th></tr></thead>'
      const detailsTbody = document.createElement('tbody')
      for (const row of section.rows) {
        const tr = document.createElement('tr')
        const key = createEl('td', { textContent: row.label })
        const value = document.createElement('td')
        if (row.imageDataUrl) {
          const preview = document.createElement('div')
          preview.className = 'plm-extension-bom-clone-image-preview'

          const image = document.createElement('img')
          image.className = 'plm-extension-bom-clone-image-preview-img'
          image.loading = 'lazy'
          image.decoding = 'async'
          image.src = row.imageDataUrl
          image.alt = row.label
          image.title = 'Click to enlarge'
          image.style.cursor = 'zoom-in'
          image.addEventListener('click', () => {
            openImagePreviewModal(image.src, row.label)
          })
          preview.appendChild(image)

          value.appendChild(preview)
        } else if (row.isRichHtml) {
          value.classList.add('plm-extension-bom-clone-rich-html-cell')
          value.innerHTML = sanitizeRichHtml(row.value)
        } else {
          value.textContent = row.value
        }
        tr.appendChild(key)
        tr.appendChild(value)
        detailsTbody.appendChild(tr)
      }
      detailsTable.appendChild(detailsTbody)
      sectionWrap.appendChild(detailsTable)
      detailsBody.appendChild(sectionWrap)
    }
  }
  detailsPane.appendChild(detailsBody)

  const attachmentsPane = document.createElement('div')
  attachmentsPane.className = 'plm-extension-bom-clone-details plm-extension-bom-clone-attachments'

  const attachmentsHeader = document.createElement('div')
  attachmentsHeader.className = 'plm-extension-bom-clone-details-header'
  const attachmentsTitle = createEl('h4', {
    className: 'plm-extension-bom-clone-details-title',
    textContent: 'Attachments'
  })
  attachmentsHeader.appendChild(attachmentsTitle)
  const attachmentsHeaderMeta = document.createElement('div')
  attachmentsHeaderMeta.className = 'plm-extension-bom-clone-attachments-header-meta'
  const headerCount = createEl('span', {
    className: 'plm-extension-bom-clone-attachment-count',
    textContent: `${snapshot.attachments.length} file${snapshot.attachments.length === 1 ? '' : 's'}`
  })
  attachmentsHeaderMeta.appendChild(headerCount)
  const headerControls = document.createElement('div')
  headerControls.className = 'plm-extension-bom-clone-attachment-controls'
  const scrollLeftBtn = createEl('button', {
    className: 'plm-extension-bom-clone-row-action-btn plm-extension-btn plm-extension-btn--secondary plm-extension-bom-clone-attachment-scroll',
    html: '<span class="zmdi zmdi-chevron-left" aria-hidden="true"></span>',
    attrs: { 'aria-label': 'Scroll attachments left' }
  })
  scrollLeftBtn.type = 'button'
  const scrollRightBtn = createEl('button', {
    className: 'plm-extension-bom-clone-row-action-btn plm-extension-btn plm-extension-btn--secondary plm-extension-bom-clone-attachment-scroll',
    html: '<span class="zmdi zmdi-chevron-right" aria-hidden="true"></span>',
    attrs: { 'aria-label': 'Scroll attachments right' }
  })
  scrollRightBtn.type = 'button'
  scrollLeftBtn.disabled = snapshot.attachments.length === 0 || snapshot.attachmentsLoading
  scrollRightBtn.disabled = snapshot.attachments.length === 0 || snapshot.attachmentsLoading
  headerControls.appendChild(scrollLeftBtn)
  headerControls.appendChild(scrollRightBtn)
  attachmentsHeaderMeta.appendChild(headerControls)
  attachmentsHeader.appendChild(attachmentsHeaderMeta)
  attachmentsPane.appendChild(attachmentsHeader)

  const attachmentsBody = document.createElement('div')
  attachmentsBody.className = 'plm-extension-bom-clone-details-body'
  if (snapshot.attachmentsLoading) {
    attachmentsBody.classList.add('is-loading')
    attachmentsBody.style.display = 'flex'
    attachmentsBody.style.flexDirection = 'column'
    attachmentsBody.style.alignItems = 'center'
    attachmentsBody.style.justifyContent = 'center'
    attachmentsBody.style.padding = '0'
    attachmentsBody.style.overflow = 'hidden'
    const loader = createBouncingLoader('Loading attachments...')
    loader.classList.add('plm-extension-bom-clone-loading-center--compact')
    attachmentsBody.appendChild(loader)
  } else if (snapshot.attachmentsError) {
    const error = createEl('p', {
      className: 'plm-extension-bom-clone-error',
      textContent: snapshot.attachmentsError
    })
    attachmentsBody.appendChild(error)
  } else if (snapshot.attachments.length === 0) {
    const empty = createEl('p', {
      className: 'plm-extension-bom-clone-details-note',
      textContent: 'No attachments found for this item.'
    })
    attachmentsBody.appendChild(empty)
  } else {
    const track = document.createElement('div')
    track.className = 'plm-extension-bom-clone-attachment-track'
    const rail = document.createElement('div')
    rail.className = 'plm-extension-bom-clone-attachment-rail'

    for (const attachment of snapshot.attachments) {
      const card = document.createElement('div')
      card.className = 'plm-extension-bom-clone-attachment-card'

      const extLabel = (attachment.extension || '').replace('.', '').toUpperCase().slice(0, 4) || 'FILE'
      const icon = createEl('div', {
        className: 'plm-extension-bom-clone-attachment-icon',
        textContent: extLabel
      })

      const name = document.createElement('div')
      name.className = 'plm-extension-bom-clone-attachment-name'
      const nameLink = document.createElement('a')
      nameLink.className = 'plm-extension-bom-clone-attachment-name-link'
      nameLink.textContent = attachment.name
      nameLink.title = attachment.name
      nameLink.href = attachment.viewerUrl || '#'
      nameLink.target = '_blank'
      nameLink.rel = 'noopener noreferrer'
      name.appendChild(nameLink)

      const meta = createEl('div', {
        className: 'plm-extension-bom-clone-attachment-meta',
        textContent: `v${attachment.version} - ${formatAttachmentSize(attachment.size)}`
      })

      card.appendChild(icon)
      card.appendChild(name)
      card.appendChild(meta)
      rail.appendChild(card)
    }

    track.appendChild(rail)
    attachmentsBody.appendChild(track)

    scrollLeftBtn.addEventListener('click', () => {
      track.scrollBy({ left: -180, behavior: 'smooth' })
    })
    scrollRightBtn.addEventListener('click', () => {
      track.scrollBy({ left: 180, behavior: 'smooth' })
    })
  }
  attachmentsPane.appendChild(attachmentsBody)

  detailsColumn.appendChild(detailsPane)
  detailsColumn.appendChild(attachmentsPane)

  twoPane.appendChild(leftPane)
  twoPane.appendChild(tablePane)
  if (hasDetailsPanel) {
    twoPane.appendChild(detailsColumn)
  }
  container.appendChild(twoPane)
}
