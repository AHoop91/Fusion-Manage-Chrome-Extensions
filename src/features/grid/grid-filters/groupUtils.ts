import { operatorRequiresSecondaryValue, operatorRequiresValue } from './filterEngine'
import type { ColumnCondition, ColumnFilterGroup } from './model'
import type { GridFilterJoinMode } from '../grid.types'
import { normalizeText } from '../../../shared/utils/text'

/**
 * Create a deep clone so draft/applied state can diverge safely.
 */
export function cloneGroups(groups: ColumnFilterGroup[]): ColumnFilterGroup[] {
  return groups.map((group) => ({
    id: group.id,
    columnKey: group.columnKey,
    mode: group.mode,
    conditions: group.conditions.map((condition) => ({
      id: condition.id,
      operator: condition.operator,
      value: condition.value,
      valueTo: condition.valueTo
    }))
  }))
}

export function sanitizeMode(mode: string): GridFilterJoinMode {
  return mode === 'and' ? 'and' : 'or'
}

export function getActiveConditions(group: ColumnFilterGroup): ColumnCondition[] {
  return group.conditions.filter((condition) => {
    if (!operatorRequiresValue(condition.operator)) return true
    if (operatorRequiresSecondaryValue(condition.operator)) {
      return normalizeText(condition.value).length > 0 && normalizeText(condition.valueTo).length > 0
    }
    return normalizeText(condition.value).length > 0
  })
}

export function getActiveGroups(groups: ColumnFilterGroup[]): ColumnFilterGroup[] {
  return groups
    .map((group) => {
      const activeConditions = getActiveConditions(group)
      return {
        ...group,
        conditions: activeConditions
      }
    })
    .filter((group) => group.conditions.length > 0)
}

export function serializeGroups(groups: ColumnFilterGroup[]): string {
  return JSON.stringify(
    groups.map((group) => ({
      columnKey: group.columnKey,
      mode: group.mode,
      conditions: group.conditions.map((condition) => ({
        operator: condition.operator,
        value: normalizeText(condition.value),
        valueTo: normalizeText(condition.valueTo || '')
      }))
    }))
  )
}

export function removeConditionFromGroups(
  groups: ColumnFilterGroup[],
  groupId: string,
  conditionId: string
): ColumnFilterGroup[] {
  return groups
    .map((group) => {
      if (group.id !== groupId) {
        return {
          ...group,
          conditions: group.conditions.map((condition) => ({ ...condition }))
        }
      }

      return {
        ...group,
        conditions: group.conditions
          .filter((condition) => condition.id !== conditionId)
          .map((condition) => ({ ...condition }))
      }
    })
    .filter((group) => group.conditions.length > 0)
}

