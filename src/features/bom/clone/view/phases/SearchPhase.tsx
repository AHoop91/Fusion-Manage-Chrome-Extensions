import React, { useMemo, useRef, useState } from 'react'
import type { BomCloneStateSnapshot } from '../../clone.types'
import type { ItemSelectorSearchFilterPatch } from '../../../../../shared/item-selector/types'
import { formatAttachmentSize, groupRefFromIndex, splitDescriptorAndRevision } from '../../../../../shared/item-selector/helpers'
import { sanitizeRichHtml } from '../../../../../shared/utils/safeRichHtml'

export type CloneSearchViewHandlers = {
  onSearchInput: (value: string) => void
  onToggleAdvancedMode: (nextAdvancedMode: boolean) => void
  onGroupLogicExpressionChange: (value: string) => void
  onSearchSubmit: () => void
  onSelectResult: (itemId: number) => void
  onLoadItemDetails: (itemId: number) => void
  onCloseDetails: () => void
  onLoadMoreResults: () => void
  onValidateSelection: () => void
  onToggleSearchField: (fieldId: string, selected: boolean) => void
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

function CloneLoader(props: { label: string; compact?: boolean }): React.JSX.Element {
  const { label, compact = false } = props
  return (
    <div className={`plm-extension-bom-clone-loading-center${compact ? ' plm-extension-bom-clone-loading-center--compact' : ''}`}>
      <div className="generic-loader plm-extension-loader">
        <div className="bounce1" />
        <div className="bounce2" />
        <div className="bounce3" />
      </div>
      <div className="plm-extension-bom-clone-loading-text">{label}</div>
    </div>
  )
}

function ImagePreviewModal(props: { imageSrc: string; altText: string; onClose: () => void }): React.JSX.Element {
  const { imageSrc, altText, onClose } = props
  return (
    <div
      className="plm-extension-bom-clone-image-modal-backdrop MuiDialog-container MuiDialog-scrollPaper"
      role="none presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="plm-extension-bom-clone-image-modal-dialog MuiPaper-root MuiDialog-paper MuiDialog-paperScrollPaper MuiDialog-paperWidthSm MuiPaper-elevation24 MuiPaper-rounded" role="dialog">
        <img className="plm-extension-bom-clone-image-modal-img" src={imageSrc} alt={altText} />
      </div>
    </div>
  )
}

export function CloneSearchPhaseContent(props: {
  snapshot: BomCloneStateSnapshot
  handlers: CloneSearchViewHandlers
}): React.JSX.Element {
  const { snapshot, handlers } = props
  const [previewImage, setPreviewImage] = useState<{ src: string; alt: string } | null>(null)
  const attachmentsTrackRef = useRef<HTMLDivElement | null>(null)
  const hasDetailsPanel =
    snapshot.detailsLoading ||
    Boolean(snapshot.detailsError) ||
    snapshot.detailsSections.length > 0 ||
    snapshot.detailsItemId !== null ||
    snapshot.attachmentsLoading ||
    Boolean(snapshot.attachmentsError) ||
    snapshot.attachments.length > 0

  const fieldsBySection = useMemo(() => {
    const grouped = new Map<string, Array<{ id: string; label: string }>>()
    for (const field of snapshot.availableSearchFields) {
      const section = field.sectionLabel || 'General'
      if (!grouped.has(section)) grouped.set(section, [])
      grouped.get(section)?.push({ id: field.id, label: field.label })
    }
    return Array.from(grouped.entries())
  }, [snapshot.availableSearchFields])

  return (
    <>
      <div className={`plm-extension-bom-clone-search-layout${hasDetailsPanel ? ' has-details' : ''}`}>
        <div className="plm-extension-bom-clone-fields">
          <div className="plm-extension-bom-clone-info-note">
            {snapshot.advancedMode
              ? 'Advanced Mode supports multi-group filters with custom logic like (A AND B) OR C.'
              : 'Basic Mode searches Item Descriptor only. Use Advanced Mode for grouped field conditions.'}
          </div>

          <h4 className="plm-extension-bom-clone-fields-title">
            {snapshot.advancedMode ? 'Filters' : 'Item Descriptor Search'}
          </h4>

          {!snapshot.advancedMode ? (
            <>
              <input
                className="plm-extension-bom-clone-input"
                data-plm-focus-key="basic-search-input"
                placeholder="Enter item descriptor value..."
                value={snapshot.searchQuery}
                onChange={(event) => handlers.onSearchInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handlers.onSearchSubmit()
                }}
              />
              <div className="plm-extension-bom-clone-toolbar">
                <button
                  type="button"
                  className="md-button md-default-theme md-button md-ink-ripple plm-extension-bom-clone-btn plm-extension-btn plm-extension-btn--secondary"
                  disabled={snapshot.loading}
                  onClick={handlers.onSearchSubmit}
                >
                  Search
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="plm-extension-bom-clone-group-join">
                <span className="plm-extension-bom-clone-filter-label">Group logic</span>
                <input
                  className="plm-extension-bom-clone-input"
                  data-plm-focus-key="group-logic-expression"
                  placeholder="Example: (A AND B) OR D"
                  value={snapshot.groupLogicExpression}
                  onChange={(event) => handlers.onGroupLogicExpressionChange(event.target.value)}
                />
              </div>

              <div className="plm-extension-bom-clone-applied">
                {snapshot.appliedSearchFilterGroups.map((group, groupIndex) => (
                  <div key={group.groupId} className="plm-extension-bom-clone-group">
                    <div className="plm-extension-bom-clone-group-header">
                      <div className="plm-extension-bom-clone-group-pill">
                        <span>{`Group ${groupRefFromIndex(groupIndex)}`}</span>
                        <button
                          type="button"
                          className="plm-extension-bom-clone-group-pill-remove"
                          aria-label={`Remove Group ${groupRefFromIndex(groupIndex)}`}
                          title="Remove group"
                          onClick={() => handlers.onRemoveGroup(group.groupId)}
                        >
                          x
                        </button>
                      </div>
                    </div>

                    {group.filters.map((filter, filterIndex) => (
                      <div key={filter.filterId} className="plm-extension-bom-clone-filter-row">
                        <select
                          className="plm-extension-bom-clone-select"
                          value={filter.fieldId}
                          onChange={(event) => handlers.onChangeSearchFilter(group.groupId, filter.filterId, { fieldId: event.target.value })}
                        >
                          {fieldsBySection.map(([section, options]) => (
                            <optgroup key={section} label={section}>
                              {options.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>

                        <select
                          className="plm-extension-bom-clone-select"
                          value={filter.operator}
                          onChange={(event) => handlers.onChangeSearchFilter(group.groupId, filter.filterId, { operator: event.target.value as 'contains' | 'equals' })}
                        >
                          <option value="contains">Contains</option>
                          <option value="equals">Equals</option>
                        </select>

                        <input
                          className="plm-extension-bom-clone-input"
                          data-plm-focus-key={`filter-value-${group.groupId}-${filter.filterId}`}
                          placeholder="Value"
                          value={filter.value}
                          onChange={(event) => handlers.onChangeSearchFilter(group.groupId, filter.filterId, { value: event.target.value })}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') handlers.onSearchSubmit()
                          }}
                        />

                        {filterIndex < group.filters.length - 1 ? (
                          <div className="plm-extension-bom-clone-row-action">
                            <span className="plm-extension-bom-clone-join-label">Then</span>
                            <select
                              className="plm-extension-bom-clone-select plm-extension-bom-clone-join-select"
                              value={filter.joinWithNext}
                              onChange={(event) => handlers.onChangeSearchFilter(group.groupId, filter.filterId, { joinWithNext: event.target.value as 'AND' | 'OR' })}
                            >
                              <option value="AND">And</option>
                              <option value="OR">Or</option>
                            </select>
                          </div>
                        ) : (
                          <div className="plm-extension-bom-clone-row-action">
                            <button
                              type="button"
                              className="plm-extension-bom-clone-row-remove plm-extension-btn plm-extension-btn--secondary"
                              onClick={() => handlers.onRemoveFilterRow(group.groupId, filter.filterId)}
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      className="md-button md-default-theme md-button md-ink-ripple plm-extension-bom-clone-btn plm-extension-btn plm-extension-btn--secondary"
                      onClick={() => handlers.onAddFilterRow(group.groupId)}
                    >
                      Add Condition
                    </button>
                  </div>
                ))}

                {snapshot.appliedSearchFilterGroups.length === 0 && (
                  <div className="plm-extension-bom-clone-query-preview">
                    No filter groups configured. Click "Add Group" to start.
                  </div>
                )}
              </div>

              <div className="plm-extension-bom-clone-toolbar">
                <button
                  type="button"
                  className="md-button md-default-theme md-button md-ink-ripple plm-extension-bom-clone-btn plm-extension-btn plm-extension-btn--secondary"
                  disabled={snapshot.loading}
                  onClick={handlers.onAddGroup}
                >
                  Add Group
                </button>
                <button
                  type="button"
                  className="md-button md-default-theme md-button md-ink-ripple plm-extension-bom-clone-btn plm-extension-btn plm-extension-btn--secondary"
                  disabled={snapshot.loading}
                  onClick={handlers.onSearchSubmit}
                >
                  Search
                </button>
              </div>
            </>
          )}
        </div>

        <div className="plm-extension-bom-clone-main">
          <div className="plm-extension-bom-clone-query-preview">
            {`Query: ${snapshot.searchQueryPreview || '{set field values to build query}'}`}
          </div>

          <div className="plm-extension-bom-clone-results">
            <div
              className="plm-extension-bom-clone-results-body"
              onScroll={(event) => {
                const resultsBody = event.currentTarget
                const hasMoreResults = snapshot.searchResults.length < snapshot.totalResults
                if (snapshot.loading || !hasMoreResults) return
                const remaining = resultsBody.scrollHeight - resultsBody.scrollTop - resultsBody.clientHeight
                if (remaining <= 40) handlers.onLoadMoreResults()
              }}
            >
              {snapshot.loading && snapshot.searchResults.length === 0 ? (
                <CloneLoader label="Loading search results..." />
              ) : (
                <table className="plm-extension-bom-clone-table plm-extension-table">
                  <thead>
                    <tr><th>Descriptor</th></tr>
                  </thead>
                  <tbody>
                    {snapshot.searchResults.map((item) => {
                      const selected = snapshot.selectedSourceItemId === item.id
                      const descriptor = item.descriptor || item.title || `Item ${item.id}`
                      const { baseDescriptor, revisionToken } = splitDescriptorAndRevision(descriptor, item.revision || '')
                      return (
                        <tr
                          key={item.id}
                          className={[selected ? 'is-selected' : '', snapshot.detailsItemId === item.id ? 'is-details-active' : ''].filter(Boolean).join(' ')}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handlers.onSelectResult(item.id)}
                        >
                          <td>
                            <span>{baseDescriptor}</span>
                            {revisionToken && (
                              <>
                                {' '}
                                <strong className="plm-extension-bom-clone-revision-token">{`[${revisionToken}]`}</strong>
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="plm-extension-bom-clone-results-footer">
              {`${snapshot.searchResults.length} of ${snapshot.totalResults} results`}
            </div>
          </div>
        </div>

        {hasDetailsPanel && (
          <div className="plm-extension-bom-clone-details-column is-visible">
            <div className="plm-extension-bom-clone-details">
              <div className="plm-extension-bom-clone-details-header">
                <h4 className="plm-extension-bom-clone-details-title">
                  {snapshot.detailsItemLabel ? `Item Details: ${snapshot.detailsItemLabel}` : 'Item Details'}
                </h4>
                <button
                  type="button"
                  className="plm-extension-bom-clone-details-close"
                  aria-label="Close details pane"
                  title="Close details pane"
                  onClick={handlers.onCloseDetails}
                >
                  x
                </button>
              </div>
              <div className="plm-extension-bom-clone-details-body">
                {snapshot.detailsLoading ? (
                  <CloneLoader label="Loading item details..." />
                ) : snapshot.detailsError ? (
                  <p className="plm-extension-bom-clone-error">{snapshot.detailsError}</p>
                ) : snapshot.detailsSections.length === 0 ? (
                  <p className="plm-extension-bom-clone-details-note">Select a row to view item details.</p>
                ) : (
                  snapshot.detailsSections.map((section) => (
                    <details
                      key={section.title}
                      className="plm-extension-bom-clone-details-section"
                      open={section.expandedByDefault !== false}
                    >
                      <summary className="plm-extension-bom-clone-details-section-title">{section.title}</summary>
                      <table className="plm-extension-bom-clone-details-table plm-extension-table">
                        <thead>
                          <tr><th>Field</th><th>Value</th></tr>
                        </thead>
                        <tbody>
                          {section.rows.map((row, index) => (
                            <tr key={`${row.label}:${index}`}>
                              <td>{row.label}</td>
                              <td className={row.isRichHtml ? 'plm-extension-bom-clone-rich-html-cell' : ''}>
                                {row.imageDataUrl ? (
                                  <div className="plm-extension-bom-clone-image-preview">
                                    <img
                                      className="plm-extension-bom-clone-image-preview-img"
                                      loading="lazy"
                                      decoding="async"
                                      src={row.imageDataUrl}
                                      alt={row.label}
                                      title="Click to enlarge"
                                      style={{ cursor: 'zoom-in' }}
                                      onClick={() => setPreviewImage({ src: row.imageDataUrl!, alt: row.label })}
                                    />
                                  </div>
                                ) : row.isRichHtml ? (
                                  <span dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(row.value) }} />
                                ) : (
                                  row.value
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  ))
                )}
              </div>
            </div>

            <div className="plm-extension-bom-clone-details plm-extension-bom-clone-attachments">
              <div className="plm-extension-bom-clone-details-header">
                <h4 className="plm-extension-bom-clone-details-title">Attachments</h4>
                <div className="plm-extension-bom-clone-attachments-header-meta">
                  <span className="plm-extension-bom-clone-attachment-count">
                    {`${snapshot.attachments.length} file${snapshot.attachments.length === 1 ? '' : 's'}`}
                  </span>
                  <div className="plm-extension-bom-clone-attachment-controls">
                    <button
                      type="button"
                      className="plm-extension-bom-clone-row-action-btn plm-extension-btn plm-extension-btn--secondary plm-extension-bom-clone-attachment-scroll"
                      aria-label="Scroll attachments left"
                      disabled={snapshot.attachments.length === 0 || snapshot.attachmentsLoading}
                      onClick={() => attachmentsTrackRef.current?.scrollBy({ left: -180, behavior: 'smooth' })}
                    >
                      <span className="zmdi zmdi-chevron-left" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="plm-extension-bom-clone-row-action-btn plm-extension-btn plm-extension-btn--secondary plm-extension-bom-clone-attachment-scroll"
                      aria-label="Scroll attachments right"
                      disabled={snapshot.attachments.length === 0 || snapshot.attachmentsLoading}
                      onClick={() => attachmentsTrackRef.current?.scrollBy({ left: 180, behavior: 'smooth' })}
                    >
                      <span className="zmdi zmdi-chevron-right" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
              <div
                className={`plm-extension-bom-clone-details-body${snapshot.attachmentsLoading ? ' is-loading' : ''}`}
              >
                {snapshot.attachmentsLoading ? (
                  <CloneLoader label="Loading attachments..." compact />
                ) : snapshot.attachmentsError ? (
                  <p className="plm-extension-bom-clone-error">{snapshot.attachmentsError}</p>
                ) : snapshot.attachments.length === 0 ? (
                  <p className="plm-extension-bom-clone-details-note">No attachments found for this item.</p>
                ) : (
                  <div className="plm-extension-bom-clone-attachment-track" ref={attachmentsTrackRef}>
                    <div className="plm-extension-bom-clone-attachment-rail">
                      {snapshot.attachments.map((attachment) => {
                        const extLabel = (attachment.extension || '').replace('.', '').toUpperCase().slice(0, 4) || 'FILE'
                        return (
                          <div key={attachment.id} className="plm-extension-bom-clone-attachment-card">
                            <div className="plm-extension-bom-clone-attachment-icon">{extLabel}</div>
                            <div className="plm-extension-bom-clone-attachment-name">
                              <a
                                className="plm-extension-bom-clone-attachment-name-link"
                                title={attachment.name}
                                href={attachment.viewerUrl || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {attachment.name}
                              </a>
                            </div>
                            <div className="plm-extension-bom-clone-attachment-meta">
                              {`v${attachment.version} - ${formatAttachmentSize(attachment.size)}`}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {previewImage && (
        <ImagePreviewModal
          imageSrc={previewImage.src}
          altText={previewImage.alt}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </>
  )
}


