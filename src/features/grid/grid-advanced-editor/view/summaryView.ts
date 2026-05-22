import { el } from './domBuilder'

/**
 * Aggregated staged operation counters displayed in footer and confirms.
 */
export interface StagedSummary {
  newRows: number
  editedRows: number
  deletedRows: number
  total: number
}

/**
 * Computes staged operation summary from individual counters.
 */
export function createStagedSummary(newRows: number, editedRows: number, deletedRows: number): StagedSummary {
  return {
    newRows,
    editedRows,
    deletedRows,
    total: newRows + editedRows + deletedRows
  }
}

/**
 * Formats singular/plural row count strings.
 */
export function formatRowCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`
}

/**
 * Optional clear handlers for footer staged-summary chips (New / Edited / Deleted).
 */
export type StagedSummaryClearHandlers = {
  onClearNew?: () => void
  onClearEdited?: () => void
  onClearDeleted?: () => void
}

/**
 * Builds consistent status/confirm summary chips for staged counters.
 */
export function buildSummaryNode(
  summary: StagedSummary,
  className: string,
  clearHandlers?: StagedSummaryClearHandlers
): HTMLDivElement {
  const createSummaryChip = (
    label: string,
    count: number,
    tone: 'new' | 'edit' | 'delete',
    onClear?: () => void
  ): HTMLElement => {
    const chip = el('span')
      .cls('plm-extension-grid-form-status-chip', `is-${tone}`)
      .title(formatRowCount(count, `${label.toLowerCase()} row`, `${label.toLowerCase()} rows`))
      .build()
    chip.appendChild(document.createTextNode(`${label}: ${count}`))
    if (count > 0 && onClear) {
      const clearBtn = el('button')
        .type('button')
        .cls('plm-extension-grid-form-status-chip-clear')
        .attr('aria-label', `Clear all staged ${label} rows`)
        .title(`Clear staged ${label.toLowerCase()} rows`)
        .text('×')
        .build()
      clearBtn.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        onClear()
      })
      chip.appendChild(clearBtn)
    }
    return chip
  }

  return el('div')
    .cls(className)
    .append(
      createSummaryChip('New', summary.newRows, 'new', clearHandlers?.onClearNew),
      createSummaryChip('Edited', summary.editedRows, 'edit', clearHandlers?.onClearEdited),
      createSummaryChip('Deleted', summary.deletedRows, 'delete', clearHandlers?.onClearDeleted)
    )
    .build()
}
