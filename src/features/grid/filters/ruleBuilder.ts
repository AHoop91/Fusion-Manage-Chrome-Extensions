import { getTodayIsoDate, operatorRequiresSecondaryValue, operatorRequiresValue } from './filterEngine'
import { sanitizeMode } from './groupUtils'
import { GRID_RULES_ID } from './constants'
import { normalizeText } from '../../../shared/utils/text'
import type { GridFilterOperator } from '../grid.types'
import type { GridPanelUiDeps } from './panelTypes'

type RuleBuilderDeps = Pick<
  GridPanelUiDeps,
  | 'getActiveColumns'
  | 'getDraftGroups'
  | 'setDraftGroups'
  | 'hasApiMetadataForCurrentGrid'
  | 'getSelectedColumnKeys'
  | 'findColumnByKey'
  | 'ensureConditionOperator'
  | 'getColumnOperators'
  | 'createCondition'
> & {
  updateActionButtons: () => void
}

type TextInputBinding = {
  input: HTMLInputElement
  clampToMaxDate?: boolean
  onInputCommit: (value: string) => void
  onEscapeClear: () => void
  onAfterUpdate: () => void
}

export function createRuleBuilder(deps: RuleBuilderDeps): { renderRuleBuilder: () => void } {
  function hasPopulatedRequiredValues(condition: { operator: GridFilterOperator; value: string; valueTo: string }): boolean {
    if (!operatorRequiresValue(condition.operator)) return true
    if (!String(condition.value || '').trim()) return false
    if (!operatorRequiresSecondaryValue(condition.operator)) return true
    return String(condition.valueTo || '').trim().length > 0
  }

  function clampDateInputToMax(input: HTMLInputElement): void {
    if (!input.max || input.value <= input.max) return
    input.value = input.max
  }

  function bindTextInputHandlers(options: TextInputBinding): void {
    options.input.addEventListener('input', () => {
      if (options.clampToMaxDate) clampDateInputToMax(options.input)
      options.onInputCommit(options.input.value)
      options.onAfterUpdate()
    })

    options.input.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return
      if (!options.input.value) return
      options.input.value = ''
      options.onEscapeClear()
      options.onAfterUpdate()
    })
  }

  function renderRuleBuilder(): void {
    const rulesHost = document.getElementById(GRID_RULES_ID) as HTMLDivElement | null
    if (!rulesHost) return
    rulesHost.textContent = ''

    const activeColumns = deps.getActiveColumns()
    if (activeColumns.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'plm-extension-grid-empty'
      empty.textContent = deps.hasApiMetadataForCurrentGrid()
        ? 'No filterable columns are currently available.'
        : 'Loading filterable fields from API metadata...'
      rulesHost.appendChild(empty)
      deps.updateActionButtons()
      return
    }

    const draftGroups = deps.getDraftGroups()
    if (draftGroups.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'plm-extension-grid-empty'
      empty.textContent = 'No rules added. Use Add Rule to filter records.'
      rulesHost.appendChild(empty)
      deps.updateActionButtons()
      return
    }

    const headerRow = document.createElement('div')
    headerRow.className = 'plm-extension-grid-rule-header'
    for (const label of ['Field Name', 'Condition', 'Filter Type', 'Value']) {
      const cell = document.createElement('div')
      cell.className = 'plm-extension-grid-rule-header-label'
      cell.textContent = label
      headerRow.appendChild(cell)
    }
    for (let index = 0; index < 2; index += 1) {
      const spacer = document.createElement('div')
      spacer.className = 'plm-extension-grid-rule-header-spacer'
      headerRow.appendChild(spacer)
    }
    rulesHost.appendChild(headerRow)

    for (const group of draftGroups) {
      const selectedByOtherGroups = deps.getSelectedColumnKeys(group.id)
      if ((!deps.findColumnByKey(group.columnKey) || selectedByOtherGroups.has(group.columnKey)) && activeColumns[0]) {
        const fallback = activeColumns.find((column) => !selectedByOtherGroups.has(column.key))
        if (fallback) group.columnKey = fallback.key
      }

      group.conditions.forEach((condition, conditionIndex) => {
        deps.ensureConditionOperator(condition, group.columnKey)
        const row = document.createElement('div')
        row.className = 'plm-extension-grid-rule-row'
        const column = deps.findColumnByKey(group.columnKey) || activeColumns[0]
        const columnKind = column?.kind || 'text'

        if (conditionIndex === 0) {
          const fieldSelect = document.createElement('select')
          fieldSelect.setAttribute('aria-label', 'Filter column')
          const selectedByOthers = deps.getSelectedColumnKeys(group.id)
          for (const column of activeColumns) {
            const option = document.createElement('option')
            option.value = column.key
            option.textContent = column.title
            if (selectedByOthers.has(column.key) && column.key !== group.columnKey) {
              option.disabled = true
            }
            fieldSelect.appendChild(option)
          }
          fieldSelect.value = group.columnKey || activeColumns[0].key
          fieldSelect.addEventListener('change', () => {
            const nextColumnKey = fieldSelect.value
            const takenByOthers = deps.getSelectedColumnKeys(group.id)
            if (takenByOthers.has(nextColumnKey)) {
              fieldSelect.value = group.columnKey
              return
            }
            group.columnKey = nextColumnKey
            for (const item of group.conditions) deps.ensureConditionOperator(item, group.columnKey)
            renderRuleBuilder()
            deps.updateActionButtons()
          })

          const modeSelect = document.createElement('select')
          modeSelect.setAttribute('aria-label', 'Column rule mode')
          ;[
            { value: 'and', label: 'AND' },
            { value: 'or', label: 'OR' }
          ].forEach((item) => {
            const option = document.createElement('option')
            option.value = item.value
            option.textContent = item.label
            modeSelect.appendChild(option)
          })
          modeSelect.value = group.mode
          modeSelect.addEventListener('change', () => {
            group.mode = sanitizeMode(modeSelect.value)
            deps.updateActionButtons()
          })

          row.appendChild(fieldSelect)
          row.appendChild(modeSelect)
        } else {
          const fieldPlaceholder = document.createElement('div')
          fieldPlaceholder.className = 'plm-extension-grid-rule-placeholder'
          const modePlaceholder = document.createElement('div')
          modePlaceholder.className = 'plm-extension-grid-rule-placeholder'
          row.appendChild(fieldPlaceholder)
          row.appendChild(modePlaceholder)
        }

        const operatorSelect = document.createElement('select')
        operatorSelect.setAttribute('aria-label', 'Filter operator')
        for (const operator of deps.getColumnOperators(group.columnKey)) {
          const option = document.createElement('option')
          option.value = operator.value
          option.textContent = operator.label
          operatorSelect.appendChild(option)
        }
        operatorSelect.value = condition.operator

        const valueInput = document.createElement('input')
        const isBooleanColumn = columnKind === 'boolean'
        valueInput.type = isBooleanColumn ? 'checkbox' : columnKind === 'date' ? 'date' : columnKind === 'number' ? 'number' : 'search'
        if (columnKind === 'number') valueInput.step = 'any'
        if (columnKind === 'date') valueInput.max = getTodayIsoDate()
        if (!isBooleanColumn) {
          valueInput.placeholder = 'Value...'
          valueInput.autocomplete = 'off'
          valueInput.spellcheck = false
        }
        valueInput.setAttribute('aria-label', 'Filter value')
        if (isBooleanColumn) {
          valueInput.checked = normalizeText(condition.value) === 'true'
          if (!condition.value) condition.value = valueInput.checked ? 'true' : 'false'
        } else {
          valueInput.value = condition.value
        }

        const valueToInput = document.createElement('input')
        valueToInput.type = columnKind === 'date' ? 'date' : columnKind === 'number' ? 'number' : 'search'
        if (columnKind === 'number') valueToInput.step = 'any'
        if (columnKind === 'date') valueToInput.max = getTodayIsoDate()
        valueToInput.placeholder = 'And...'
        valueToInput.autocomplete = 'off'
        valueToInput.spellcheck = false
        valueToInput.setAttribute('aria-label', 'Filter secondary value')
        valueToInput.value = condition.valueTo

        const valueSlot = document.createElement('div')
        valueSlot.className = 'plm-extension-grid-value-slot'
        valueSlot.appendChild(valueInput)
        valueSlot.appendChild(valueToInput)

        function syncValueInputs(): void {
          const needsValue = operatorRequiresValue(condition.operator)
          const needsSecondary = operatorRequiresSecondaryValue(condition.operator)
          valueSlot.classList.toggle('plm-extension-grid-value-slot--between', needsSecondary)
          valueInput.disabled = !needsValue
          if (isBooleanColumn) valueInput.checked = normalizeText(condition.value) === 'true'
          valueToInput.disabled = !needsSecondary
          valueToInput.style.display = needsSecondary ? '' : 'none'
          if (!needsValue) {
            if (isBooleanColumn) {
              valueInput.checked = false
            } else {
              valueInput.value = ''
            }
            condition.value = ''
          }
          if (!needsSecondary) {
            valueToInput.value = ''
            condition.valueTo = ''
          }
        }

        const addSameColumnButton = document.createElement('button')
        addSameColumnButton.type = 'button'
        addSameColumnButton.className = 'plm-extension-grid-rule-add plm-extension-btn plm-extension-btn--primary'
        const addIcon = document.createElement('span')
        addIcon.className = 'zmdi zmdi-plus'
        addIcon.setAttribute('aria-hidden', 'true')
        addSameColumnButton.appendChild(addIcon)
        addSameColumnButton.setAttribute('aria-label', 'Add rule for this column')
        const isLastCondition = conditionIndex === group.conditions.length - 1
        addSameColumnButton.style.visibility = isLastCondition ? '' : 'hidden'
        addSameColumnButton.style.pointerEvents = isLastCondition ? '' : 'none'
        const syncAddButtonState = (): void => {
          if (!isLastCondition) {
            addSameColumnButton.disabled = true
            return
          }
          const canAdd = hasPopulatedRequiredValues(condition)
          addSameColumnButton.disabled = !canAdd
          addSameColumnButton.title = canAdd ? 'Add rule for this column' : 'Enter a value before adding another rule'
        }
        const refreshRowState = (): void => {
          syncAddButtonState()
          deps.updateActionButtons()
        }

        operatorSelect.addEventListener('change', () => {
          condition.operator = operatorSelect.value as GridFilterOperator
          syncValueInputs()
          refreshRowState()
        })
        if (isBooleanColumn) {
          valueInput.addEventListener('change', () => {
            condition.value = valueInput.checked ? 'true' : 'false'
            refreshRowState()
          })
        } else {
          bindTextInputHandlers({
            input: valueInput,
            clampToMaxDate: columnKind === 'date',
            onInputCommit(value) {
              condition.value = value
            },
            onEscapeClear() {
              condition.value = ''
            },
            onAfterUpdate: refreshRowState
          })
        }

        bindTextInputHandlers({
          input: valueToInput,
          clampToMaxDate: columnKind === 'date',
          onInputCommit(value) {
            condition.valueTo = value
          },
          onEscapeClear() {
            condition.valueTo = ''
          },
          onAfterUpdate: refreshRowState
        })

        syncValueInputs()
        addSameColumnButton.addEventListener('click', () => {
          if (addSameColumnButton.disabled) return
          group.conditions.push(deps.createCondition(group.columnKey))
          renderRuleBuilder()
          deps.updateActionButtons()
        })

        const removeButton = document.createElement('button')
        removeButton.type = 'button'
        removeButton.className = 'plm-extension-grid-rule-remove plm-extension-btn plm-extension-btn--secondary'
        const removeIcon = document.createElement('span')
        removeIcon.className = 'zmdi zmdi-close'
        removeIcon.setAttribute('aria-hidden', 'true')
        removeButton.appendChild(removeIcon)
        removeButton.setAttribute('aria-label', 'Remove rule')
        removeButton.addEventListener('click', () => {
          if (group.conditions.length > 1) {
            group.conditions = group.conditions.filter((item) => item.id !== condition.id)
          } else {
            deps.setDraftGroups(deps.getDraftGroups().filter((item) => item.id !== group.id))
          }
          renderRuleBuilder()
          deps.updateActionButtons()
        })

        row.appendChild(operatorSelect)
        row.appendChild(valueSlot)
        row.appendChild(addSameColumnButton)
        row.appendChild(removeButton)
        rulesHost.appendChild(row)
        syncAddButtonState()
      })
    }

    deps.updateActionButtons()
  }

  return { renderRuleBuilder }
}

