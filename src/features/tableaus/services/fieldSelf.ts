import type { TableauExport, TableauListMetaResponse } from '../tableaus.types'

/**
 * Stable field identifier from a PLM field `__self__` URL: last path segment after
 * `/fields/`, URL-decoded and uppercased. Works for both `/workspaces/.../fields/X` and
 * `/workspaces/.../views/{anyViewId}/fields/X` — the view id is not part of the key.
 */
export function fieldIdFromSelfUrl(self: string): string {
  const match = /\/fields\/([^/?#]+)$/i.exec(String(self || '').trim())
  if (!match?.[1]) return ''
  let segment = match[1]
  try {
    segment = decodeURIComponent(segment)
  } catch {
    // keep encoded segment
  }
  return segment.trim().toUpperCase()
}

function extractColumnCandidatesFromMeta(response: unknown): Array<Record<string, unknown>> {
  const cols: Array<Record<string, unknown>> = []
  const pushCols = (value: unknown): void => {
    if (!Array.isArray(value)) return
    for (const entry of value) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
      cols.push(entry as Record<string, unknown>)
    }
  }

  if (Array.isArray(response)) {
    // Some tenants return columns directly from /tableaus meta.
    pushCols(response)
    return cols
  }
  if (!response || typeof response !== 'object') return cols

  const obj = response as Record<string, unknown>
  // Common shape: { tableaus: [{ columns: [...] }, ...] }
  if (Array.isArray(obj.tableaus)) {
    for (const tableau of obj.tableaus) {
      if (!tableau || typeof tableau !== 'object' || Array.isArray(tableau)) continue
      const t = tableau as Record<string, unknown>
      if (t.deleted === true) continue
      pushCols(t.columns)
    }
  }
  // Alternate shape: { columns: [...] }
  pushCols(obj.columns)
  // Single-column object fallback
  if (obj.field && typeof obj.field === 'object' && !Array.isArray(obj.field)) {
    cols.push(obj)
  }
  return cols
}

/**
 * Builds a set of valid import field ids from tableau metadata.
 *
 * Source: GET `/api/v3/workspaces/{wsId}/tableaus` with
 * `Accept: application/vnd.autodesk.plm.meta+json`.
 *
 * Handles multiple payload shapes seen across tenants:
 * - `{ tableaus: [{ columns: [...] }] }`
 * - `{ columns: [...] }`
 * - direct array of column objects
 */
export function buildAllowedFieldIdSetFromTableauMeta(response: TableauListMetaResponse | unknown): Set<string> {
  const set = new Set<string>()
  for (const col of extractColumnCandidatesFromMeta(response)) {
    const field = col.field
    const self = (field && typeof field === 'object' && !Array.isArray(field))
      ? String((field as Record<string, unknown>).__self__ || '')
      : ''
    const id = fieldIdFromSelfUrl(self)
    if (!id) continue
    set.add(id)
  }
  return set
}

export type TableauFieldImportIssueKind = 'missing_self' | 'invalid_url' | 'not_in_workspace'

export type TableauFieldImportIssue = {
  columnNumber: number
  fieldReference: string
  kind: TableauFieldImportIssueKind
  resolvedFieldId: string | null
  detail: string
}

/**
 * Per-column import check:
 *
 * 1. Resolve each `columns[i].field.__self__` to a field id (last `/fields/` segment,
 *    URL-decoded, uppercased). `/views/{n}/fields/X` and `/fields/X` both resolve to `X`.
 * 2. Require that field id to exist in `metaFieldIds`.
 *
 * This set is built from tableau metadata columns (meta list API), not workspace fields API.
 */
export function collectTableauFieldImportIssues(
  tableau: TableauExport,
  metaFieldIds: Set<string>
): TableauFieldImportIssue[] {
  const issues: TableauFieldImportIssue[] = []
  for (let i = 0; i < tableau.columns.length; i++) {
    const col = tableau.columns[i]
    const colNum = i + 1
    const fieldObj = col?.field
    const selfRaw = fieldObj?.__self__
    if (typeof selfRaw !== 'string' || !selfRaw.trim()) {
      issues.push({
        columnNumber: colNum,
        fieldReference: '—',
        kind: 'missing_self',
        resolvedFieldId: null,
        detail: 'This column does not reference a field.'
      })
      continue
    }
    const self = selfRaw.trim()
    const id = fieldIdFromSelfUrl(self)
    if (!id) {
      issues.push({
        columnNumber: colNum,
        fieldReference: self,
        kind: 'invalid_url',
        resolvedFieldId: null,
        detail: 'The field URL could not be parsed.'
      })
      continue
    }
    if (!metaFieldIds.has(id)) {
      issues.push({
        columnNumber: colNum,
        fieldReference: self,
        kind: 'not_in_workspace',
        resolvedFieldId: id,
        detail: `No matching workspace field found for "${id}".`
      })
    }
  }
  return issues
}

/**
 * Deduped tokens for simple checks (tests and summaries).
 */
export function findMissingTableauColumnFieldIds(
  tableau: TableauExport,
  metaFieldIds: Set<string>
): string[] {
  const issues = collectTableauFieldImportIssues(tableau, metaFieldIds)
  const missing: string[] = []
  const seen = new Set<string>()
  for (const issue of issues) {
    if (issue.kind === 'invalid_url') {
      const token = 'invalid field URL'
      if (!seen.has(token)) {
        seen.add(token)
        missing.push(token)
      }
      continue
    }
    if (issue.kind === 'not_in_workspace' && issue.resolvedFieldId && !seen.has(issue.resolvedFieldId)) {
      seen.add(issue.resolvedFieldId)
      missing.push(issue.resolvedFieldId)
    }
  }
  return missing
}
