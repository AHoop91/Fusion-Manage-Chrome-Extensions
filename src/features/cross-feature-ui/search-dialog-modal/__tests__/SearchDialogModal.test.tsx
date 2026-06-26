// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { SearchDialogModal } from '../SearchDialogModal'
import type { ItemSelectorSearchHandlers } from '../../../../shared/item-selector/view'

function createHandlers(): ItemSelectorSearchHandlers {
  return {
    onSearchInput: vi.fn(),
    onToggleAdvancedMode: vi.fn(),
    onGroupLogicExpressionChange: vi.fn(),
    onSearchSubmit: vi.fn(),
    onSelectResult: vi.fn(),
    onLoadItemDetails: vi.fn(),
    onCloseDetails: vi.fn(),
    onLoadMoreResults: vi.fn(),
    onChangeSearchFilter: vi.fn(),
    onAddGroup: vi.fn(),
    onRemoveGroup: vi.fn(),
    onAddFilterRow: vi.fn(),
    onRemoveFilterRow: vi.fn()
  }
}

describe('SearchDialogModal', () => {
  it('renders the basic search state and result counts', () => {
    const handlers = createHandlers()

    const { container } = render(
      <SearchDialogModal
        snapshot={{
          advancedMode: false,
          searchQuery: 'Rear Connector',
          groupLogicExpression: '',
          availableSearchFields: [],
          appliedSearchFilterGroups: [],
          searchQueryPreview: 'Rear Connector',
          searchResults: [
            {
              id: 101,
              dmsId: 101,
              workspaceId: 57,
              descriptor: 'Rear Connector [A]',
              revision: 'A',
              title: 'Rear Connector'
            }
          ],
          detailsItemId: null,
          detailsItemLabel: '',
          detailsSections: [],
          detailsLoading: false,
          detailsError: null,
          attachments: [],
          attachmentsLoading: false,
          attachmentsError: null,
          selectedSourceItemId: 101,
          totalResults: 1,
          loading: false
        }}
        handlers={handlers}
      />
    )

    expect(container.textContent).toContain('Item Descriptor Search')
    expect(container.textContent).toContain('Query: Rear Connector')
    expect(container.textContent).toContain('1 of 1 results')
    expect(container.querySelectorAll('table').length).toBeGreaterThan(0)
  })

  it('renders details with sanitized rich html and attachments', () => {
    const handlers = createHandlers()

    const { container } = render(
      <SearchDialogModal
        snapshot={{
          advancedMode: false,
          searchQuery: '',
          groupLogicExpression: '',
          availableSearchFields: [],
          appliedSearchFilterGroups: [],
          searchQueryPreview: '',
          searchResults: [],
          detailsItemId: 101,
          detailsItemLabel: 'Rear Connector',
          detailsSections: [
            {
              title: 'General',
              rows: [
                {
                  label: 'Description',
                  value: '<strong>Safe</strong><script>alert(1)</script>',
                  isRichHtml: true
                }
              ],
              expandedByDefault: true
            }
          ],
          detailsLoading: false,
          detailsError: null,
          attachments: [
            {
              id: '1',
              name: 'drawing.pdf',
              resourceName: 'drawing',
              extension: '.pdf',
              size: 1024,
              version: '3',
              viewerUrl: 'https://viewer.example'
            }
          ],
          attachmentsLoading: false,
          attachmentsError: null,
          selectedSourceItemId: null,
          totalResults: 0,
          loading: false
        }}
        handlers={handlers}
      />
    )

    expect(container.innerHTML).toContain('<strong>Safe</strong>')
    expect(container.innerHTML).not.toContain('<script')
    expect(container.textContent).toContain('Attachments')
    expect(container.textContent).toContain('drawing.pdf')
  })

  it('renders advanced mode groups and wires filter interactions', () => {
    const handlers = createHandlers()

    const { container } = render(
      <SearchDialogModal
        snapshot={{
          advancedMode: true,
          searchQuery: '',
          groupLogicExpression: 'A',
          availableSearchFields: [
            { id: 'DESCRIPTION', label: 'Description', sectionLabel: 'General' },
            { id: 'PART_NUMBER', label: 'Part Number', sectionLabel: 'General' }
          ],
          appliedSearchFilterGroups: [
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
                },
                {
                  filterId: 'filter-2',
                  fieldId: 'PART_NUMBER',
                  fieldLabel: 'General > Part Number',
                  value: '123',
                  operator: 'equals',
                  joinWithNext: 'AND'
                }
              ]
            }
          ],
          searchQueryPreview: 'ITEM_DETAILS:DESCRIPTION=Widget',
          searchResults: [],
          detailsItemId: null,
          detailsItemLabel: '',
          detailsSections: [],
          detailsLoading: false,
          detailsError: null,
          attachments: [],
          attachmentsLoading: false,
          attachmentsError: null,
          selectedSourceItemId: null,
          totalResults: 0,
          loading: false
        }}
        handlers={handlers}
      />
    )

    const groupLogic = container.querySelector('[data-plm-focus-key="group-logic-expression"]') as HTMLInputElement
    fireEvent.change(groupLogic, { target: { value: '(A OR B)' } })

    const inputs = Array.from(container.querySelectorAll('input.plm-extension-search-dialog-input')) as HTMLInputElement[]
    const valueInput = inputs.find((input) => input.value === 'Widget') as HTMLInputElement
    fireEvent.change(valueInput, { target: { value: 'Updated' } })

    fireEvent.click(container.querySelector('.plm-extension-search-dialog-group-pill-remove') as HTMLButtonElement)
    const actionButtons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[]
    actionButtons.find((button) => button.textContent === 'Add Condition')?.click()
    actionButtons.find((button) => button.textContent === 'Add Group')?.click()
    actionButtons.find((button) => button.textContent === 'Search')?.click()

    expect(handlers.onGroupLogicExpressionChange).toHaveBeenCalledWith('(A OR B)')
    expect(handlers.onChangeSearchFilter).toHaveBeenCalledWith('group-1', 'filter-1', { value: 'Updated' })
    expect(handlers.onRemoveGroup).toHaveBeenCalledWith('group-1')
    expect(handlers.onAddFilterRow).toHaveBeenCalledWith('group-1')
    expect(handlers.onAddGroup).toHaveBeenCalledTimes(1)
    expect(handlers.onSearchSubmit).toHaveBeenCalledTimes(1)
  })

  it('loads more on scroll and closes the details pane from the header button', () => {
    const handlers = createHandlers()

    const { container } = render(
      <SearchDialogModal
        snapshot={{
          advancedMode: false,
          searchQuery: '',
          groupLogicExpression: '',
          availableSearchFields: [],
          appliedSearchFilterGroups: [],
          searchQueryPreview: '',
          searchResults: [
            {
              id: 101,
              dmsId: 101,
              workspaceId: 57,
              descriptor: 'Rear Connector',
              revision: 'A',
              title: 'Rear Connector'
            }
          ],
          detailsItemId: 101,
          detailsItemLabel: 'Rear Connector',
          detailsSections: [
            {
              title: 'General',
              rows: [{ label: 'Description', value: 'Plain text' }],
              expandedByDefault: true
            }
          ],
          detailsLoading: false,
          detailsError: null,
          attachments: [],
          attachmentsLoading: false,
          attachmentsError: null,
          selectedSourceItemId: null,
          totalResults: 3,
          loading: false
        }}
        handlers={handlers}
      />
    )

    const resultsBody = container.querySelector('.plm-extension-search-dialog-results-body') as HTMLDivElement
    Object.defineProperty(resultsBody, 'scrollHeight', { configurable: true, value: 300 })
    Object.defineProperty(resultsBody, 'clientHeight', { configurable: true, value: 100 })
    Object.defineProperty(resultsBody, 'scrollTop', { configurable: true, value: 170 })
    fireEvent.scroll(resultsBody)

    fireEvent.click(container.querySelector('.plm-extension-search-dialog-details-close') as HTMLButtonElement)

    expect(handlers.onLoadMoreResults).toHaveBeenCalledTimes(1)
    expect(handlers.onCloseDetails).toHaveBeenCalledTimes(1)
  })
})
