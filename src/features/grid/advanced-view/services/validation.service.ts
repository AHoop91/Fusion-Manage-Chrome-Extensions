import type { ModalState } from '../controller/modalState'
import type { SelectedRowModel } from '../types'
import type { StagingManager } from './staging.service'
import type { GridService } from './gridService'

/**
 * Required field violation emitted for row + field title pair.
 */
export interface RequiredValidationIssue {
  rowLabel: string
  fieldTitle: string
}

/**
 * Validation manager contract for required-field checks.
 */
export interface ValidationManager {
  getRequiredValidationIssues: (modelByDomRowIndex: Map<number, SelectedRowModel>) => RequiredValidationIssue[]
  getUniqueRequiredFieldTitles: (issues: RequiredValidationIssue[]) => string[]
}

/**
 * Validation manager creation dependencies.
 */
export interface ValidationManagerDeps {
  state: ModalState
  stagingManager: StagingManager
  gridService: GridService
}

/**
 * Creates required-validation manager with integrated required-rules evaluation.
 */
export function createValidationManager(deps: ValidationManagerDeps): ValidationManager {
  function getRequiredValidationIssues(modelByDomRowIndex: Map<number, SelectedRowModel>): RequiredValidationIssue[] {
    const metadata = deps.state.getMetadata()
    const stagingSnapshot = deps.stagingManager.getSnapshot()
    const pendingChangesByDomRowIndex = deps.stagingManager.getPendingChangesMap()
    const pendingDisplayByDomRowIndex = deps.stagingManager.getPendingDisplayMap()
    const pendingRemovalRowIndexes = deps.stagingManager.getPendingRemovalSet()
    const pendingInsertDrafts = stagingSnapshot.inserts.map((draft) => ({
      payload: new Map(draft.payload.map((value) => [value.fieldId, value.value])),
      display: new Map(draft.display.map((value) => [value.fieldId, value.value]))
    }))

    const requiredColumns = metadata.apiTableColumns.filter((column) => column.field.required)
    if (requiredColumns.length === 0) return []

    const issues: RequiredValidationIssue[] = []
    const seen = new Set<string>()
    const pushIssue = (rowLabel: string, fieldTitle: string): void => {
      const key = `${rowLabel}::${fieldTitle}`
      if (seen.has(key)) return
      seen.add(key)
      issues.push({ rowLabel, fieldTitle })
    }

    const isRequiredFieldValuePresent = (value: string | null | undefined): boolean => {
      const normalized = String(value || '').trim()
      if (!normalized) return false
      if (/^(?:-|â€“|â€”)+$/.test(normalized)) return false
      return true
    }

    const validateRowFields = (
      rowLabel: string,
      resolveValue: (column: typeof requiredColumns[number]) => string | null | undefined
    ): void => {
      for (const column of requiredColumns) {
        const effectiveValue = resolveValue(column) || column.field.defaultValue
        if (!isRequiredFieldValuePresent(effectiveValue)) {
          pushIssue(rowLabel, column.field.title)
        }
      }
    }

    const domRowIndexByApiRowIndex = new Map<number, number>()
    const domRowIndexByApiRowId = new Map<string, number>()
    for (const model of metadata.selectedRowModels) {
      if (!model.apiRow) continue
      domRowIndexByApiRowIndex.set(model.apiRow.index, model.domRowIndex)
      if (model.apiRow.rowId) domRowIndexByApiRowId.set(model.apiRow.rowId, model.domRowIndex)
    }

    const resolveDomRowIndexForApiRow = (apiRow: (typeof metadata.apiRows)[number]): number | null => {
      if (apiRow.rowId) {
        const byId = domRowIndexByApiRowId.get(apiRow.rowId)
        if (typeof byId === 'number' && Number.isFinite(byId)) return byId
      }
      const byIndex = domRowIndexByApiRowIndex.get(apiRow.index)
      if (typeof byIndex === 'number' && Number.isFinite(byIndex)) return byIndex
      return null
    }

    if (metadata.apiRows.length > 0) {
      for (const apiRow of metadata.apiRows) {
        const domRowIndex = resolveDomRowIndexForApiRow(apiRow)
        if (domRowIndex !== null && pendingRemovalRowIndexes.has(domRowIndex)) continue

        const rowModel = domRowIndex !== null ? modelByDomRowIndex.get(domRowIndex) || null : null
        const rowChanges = domRowIndex !== null ? pendingChangesByDomRowIndex.get(domRowIndex) : null
        validateRowFields(`Row ${apiRow.rowId || String(apiRow.index + 1)}`, (column) => {
          const fieldId = column.field.fieldId
          const pendingDisplay = domRowIndex !== null ? pendingDisplayByDomRowIndex.get(domRowIndex)?.get(fieldId) : undefined
          if (typeof pendingDisplay === 'string') return pendingDisplay
          if (rowChanges?.has(fieldId)) return rowChanges.get(fieldId)
          if (rowModel) return deps.gridService.getApiTableValueForRow(rowModel, column, pendingChangesByDomRowIndex)
          return apiRow.byFieldId.get(fieldId) || ''
        })
      }
    } else {
      const existingRowIndexesToValidate = new Set<number>()
      for (const model of metadata.selectedRowModels) existingRowIndexesToValidate.add(model.domRowIndex)
      for (const domRowIndex of pendingChangesByDomRowIndex.keys()) existingRowIndexesToValidate.add(domRowIndex)

      for (const domRowIndex of existingRowIndexesToValidate) {
        if (pendingRemovalRowIndexes.has(domRowIndex)) continue
        const model = modelByDomRowIndex.get(domRowIndex)
        if (!model) continue
        const rowChanges = pendingChangesByDomRowIndex.get(domRowIndex) || new Map<string, string>()
        validateRowFields(`Row ${domRowIndex + 1}`, (column) => {
          const fieldId = column.field.fieldId
          const pendingDisplay = pendingDisplayByDomRowIndex.get(domRowIndex)?.get(fieldId)
          if (typeof pendingDisplay === 'string') return pendingDisplay
          if (rowChanges.has(fieldId)) return rowChanges.get(fieldId)
          return deps.gridService.getApiTableValueForRow(model, column, pendingChangesByDomRowIndex)
        })
      }
    }

    for (let insertIndex = 0; insertIndex < pendingInsertDrafts.length; insertIndex += 1) {
      const draft = pendingInsertDrafts[insertIndex]
      validateRowFields(`New Row ${insertIndex + 1}`, (column) => {
        const fieldId = column.field.fieldId
        return draft.display.get(fieldId) || draft.payload.get(fieldId) || column.field.defaultValue || null
      })
    }

    return issues
  }

  function getUniqueRequiredFieldTitles(issues: RequiredValidationIssue[]): string[] {
    const unique = new Set<string>()
    for (const issue of issues) {
      const normalized = issue.fieldTitle.trim()
      if (!normalized) continue
      unique.add(normalized)
    }
    return Array.from(unique)
  }

  return {
    getRequiredValidationIssues,
    getUniqueRequiredFieldTitles
  }
}
