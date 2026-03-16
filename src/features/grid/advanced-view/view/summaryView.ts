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
 * Builds consistent status/confirm summary chips for staged counters.
 */
export function buildSummaryNode(summary: StagedSummary, className: string): HTMLDivElement {
  const createSummaryChip = (
    label: string,
    count: number,
    tone: 'new' | 'edit' | 'delete'
  ): HTMLSpanElement =>
    el('span')
      .cls('plm-extension-grid-form-status-chip', `is-${tone}`)
      .text(`${label}: ${count}`)
      .title(formatRowCount(count, `${label.toLowerCase()} row`, `${label.toLowerCase()} rows`))
      .build()

  return el('div')
    .cls(className)
    .append(
      createSummaryChip('New', summary.newRows, 'new'),
      createSummaryChip('Edited', summary.editedRows, 'edit'),
      createSummaryChip('Deleted', summary.deletedRows, 'delete')
    )
    .build()
}
