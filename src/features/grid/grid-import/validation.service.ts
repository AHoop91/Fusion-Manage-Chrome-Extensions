import { fetchLookupOptionsByQuery } from '../../../shared/form/lookupOptions'
import { normalizeText } from '../../../shared/utils/text'
import { isBooleanFieldType, isDateFieldType, isIntegerFieldType, isNumericFieldType } from '../grid-advanced-editor/services/fieldTypes'
import { isGridNumericPayloadType, resolveGridNumericBounds, toGridPayloadType } from '../grid-services/gridFieldMetadata'
import type {
  CsvParseResult,
  GridImportField,
  GridImportMappedCell,
  GridImportMapping,
  GridImportRowIssue,
  GridImportRowValidationTone,
  GridImportValidationResult
} from './types'
import { validateImportMapping } from './mapping.service'

type ValidatorRules = {
  required: boolean
  min: number | null
  max: number | null
  pattern: RegExp | null
  patternSource: string | null
}

function collectValidatorRules(source: unknown, rules: ValidatorRules): void {
  if (!source) return
  if (Array.isArray(source)) {
    for (const entry of source) collectValidatorRules(entry, rules)
    return
  }
  if (typeof source !== 'object') {
    const normalized = String(source || '').trim().toLowerCase().replace(/[^a-z]/g, '')
    if (normalized === 'required') rules.required = true
    return
  }

  const record = source as Record<string, unknown>
  const validatorName = String(record.validatorName || record.name || record.type || '').trim().toLowerCase().replace(/[^a-z]/g, '')
  if (validatorName === 'required' || validatorName === 'missing' || validatorName === 'dropdownselection') rules.required = true
  const min = Number(record.min ?? record.minimum ?? record.minValue)
  if (Number.isFinite(min)) rules.min = rules.min === null ? min : Math.max(rules.min, min)
  const max = Number(record.max ?? record.maximum ?? record.maxValue)
  if (Number.isFinite(max)) rules.max = rules.max === null ? max : Math.min(rules.max, max)
  const pattern = String(record.pattern || record.regex || record.regExp || '').trim()
  if (pattern && !rules.pattern) {
    try {
      rules.pattern = new RegExp(pattern)
      rules.patternSource = pattern
    } catch {
      rules.pattern = null
      rules.patternSource = null
    }
  }
  for (const key of ['validators', 'fieldValidators', 'rules']) collectValidatorRules(record[key], rules)
}

function getValidatorRules(field: GridImportField): ValidatorRules {
  const rules: ValidatorRules = { required: field.field.required, min: null, max: null, pattern: null, patternSource: null }
  collectValidatorRules(field.raw.validators, rules)
  collectValidatorRules(field.raw.fieldValidators, rules)
  return rules
}

function parseNumericValue(value: string): number | null {
  const normalized = String(value || '').trim().replace(/\s+/g, '').replace(/,/g, '')
  if (!normalized || normalized === '-' || normalized === '.' || normalized === '-.') return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function isRequiredFieldValidationMessage(message: string): boolean {
  return message === 'is required' || message === 'Match On value is required'
}

function pushValidatedRowIssue(
  issue: GridImportRowIssue,
  rowIssues: GridImportValidationResult['rowIssues'],
  warningIssues: GridImportValidationResult['warningIssues']
): void {
  if (issue.kind === 'picklist' || !isRequiredFieldValidationMessage(issue.message)) {
    warningIssues.push(issue)
    return
  }
  rowIssues.push(issue)
}

function formatRowIssueMessage(issue: GridImportRowIssue): string {
  return issue.fieldName ? `${issue.fieldName}: ${issue.message}` : issue.message
}

function resolveRowValidationTone(
  rowIssues: GridImportValidationResult['rowIssues'],
  warningIssues: GridImportValidationResult['warningIssues'],
  csvRowNumber: number
): GridImportRowValidationTone {
  const hasRequiredError = rowIssues.some((issue) => issue.row === csvRowNumber)
  if (hasRequiredError) return 'error'
  const hasWarning = warningIssues.some((issue) => issue.row === csvRowNumber)
  if (hasWarning) return 'warning'
  return 'pass'
}

function validateNumericDigits(value: string, field: GridImportField): string | null {
  const normalized = String(value || '').trim().replace(/\s+/g, '').replace(/,/g, '').replace(/^-/, '')
  const [integerPart = '', decimalPart = ''] = normalized.split('.')
  if (typeof field.field.fieldLength === 'number' && integerPart.replace(/\D/g, '').length > field.field.fieldLength) {
    return `exceeds ${field.field.fieldLength} integer digit(s)`
  }
  if (typeof field.field.fieldPrecision === 'number' && decimalPart.length > field.field.fieldPrecision) {
    return `exceeds ${field.field.fieldPrecision} decimal place(s)`
  }
  return null
}

function validateCell(field: GridImportField, value: string): GridImportRowIssue['kind'] | string | null {
  const trimmed = String(value || '').trim()
  const rules = getValidatorRules(field)
  if (rules.required && !trimmed) return 'is required'
  if (!trimmed) return null

  if (field.allowedPicklistValues.length > 0) {
    const allowed = new Set(field.allowedPicklistValues.map((entry) => entry.toLowerCase()))
    const values = trimmed.split(',').map((entry) => entry.trim()).filter(Boolean)
    const invalid = values.find((entry) => !allowed.has(entry.toLowerCase()))
    if (invalid) return `picklist:has unsupported picklist value "${invalid}"`
  } else if (!field.field.picklistPath && field.raw.picklistFieldDefinition) {
    return 'picklist:has no importable picklist options in metadata'
  }

  if (isBooleanFieldType(field.field.typeId) && !/^(true|false|yes|no|1|0)$/i.test(trimmed)) return 'must be a boolean value'
  if (isDateFieldType(field.field.typeId)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) return 'must be a date value'
  }

  const payloadType = toGridPayloadType(field.field)
  if (isGridNumericPayloadType(payloadType) || isNumericFieldType(field.field.typeId) || field.field.kind === 'number') {
    const numeric = parseNumericValue(trimmed)
    if (numeric === null) return 'must be a number'
    if (isIntegerFieldType(field.field.typeId) && !Number.isInteger(numeric)) return 'must be an integer'
    const digitIssue = validateNumericDigits(trimmed, field)
    if (digitIssue) return digitIssue
    const bounds = resolveGridNumericBounds(field.field)
    if (bounds.min !== null && numeric < bounds.min) return `must be greater than or equal to ${bounds.min}`
    if (bounds.max !== null && numeric > bounds.max) return `must be less than or equal to ${bounds.max}`
    if (rules.min !== null && numeric < rules.min) return `must be greater than or equal to ${rules.min}`
    if (rules.max !== null && numeric > rules.max) return `must be less than or equal to ${rules.max}`
  }

  if (typeof field.field.fieldLength === 'number' && field.field.kind !== 'number' && trimmed.length > field.field.fieldLength) {
    return `exceeds ${field.field.fieldLength} character(s)`
  }
  if (rules.pattern && !rules.pattern.test(trimmed)) return `does not match validator pattern ${rules.patternSource || ''}`.trim()
  return null
}

async function validatePicklistCell(field: GridImportField, value: string): Promise<string | null> {
  const picklistPath = String(field.field.picklistPath || '').trim()
  const trimmed = String(value || '').trim()
  if (!picklistPath || !trimmed) return null

  const payloadType = toGridPayloadType(field.field).toLowerCase()
  const values =
    payloadType === 'multi-select'
      ? trimmed.split(',').map((entry) => entry.trim()).filter(Boolean)
      : [trimmed]

  for (const entry of values) {
    const page = await fetchLookupOptionsByQuery(picklistPath, entry, 100, 0, { useCache: true })
    const wanted = normalizeText(entry)
    const exact = page.options.find((option) => normalizeText(option.label) === wanted)
    if (!exact) return `has unsupported picklist value "${entry}"`
  }
  return null
}

export function getMappedRowCells(row: string[], headers: string[], fields: GridImportField[], mapping: GridImportMapping[]): GridImportMappedCell[] {
  const fieldById = new Map(fields.map((field) => [field.fieldId, field]))
  const headerPosition = new Map(headers.map((header, index) => [header, index]))
  const sortedMapping = mapping
    .filter((entry) => entry.header && headerPosition.has(entry.header))
    .sort((a, b) => (headerPosition.get(a.header) ?? 0) - (headerPosition.get(b.header) ?? 0))
  const cells: GridImportMappedCell[] = []
  for (const entry of sortedMapping) {
    const field = fieldById.get(entry.fieldId)
    const index = headerPosition.get(entry.header)
    if (!field || index === undefined) continue
    cells.push({ field, value: String(row[index] ?? '').trim() })
  }
  return cells
}

export function validateGridImport(
  parsed: CsvParseResult,
  fields: GridImportField[],
  mapping: GridImportMapping[],
  matchFieldIds: string[] = []
): GridImportValidationResult {
  const mappingIssues = validateImportMapping(parsed.headers, fields, mapping)
  const rowIssues: GridImportValidationResult['rowIssues'] = []
  const warningIssues: GridImportValidationResult['warningIssues'] = []
  let checkedCells = 0
  const fieldById = new Map(fields.map((field) => [field.fieldId, field]))
  const mappingByFieldId = new Map(mapping.map((entry) => [entry.fieldId, entry.header]))
  const matchFields = matchFieldIds
    .filter((fieldId) => Boolean(mappingByFieldId.get(fieldId)))
    .map((fieldId) => fieldById.get(fieldId))
    .filter((field): field is GridImportField => Boolean(field))

  for (const fieldId of matchFieldIds) {
    const field = fieldById.get(fieldId)
    if (!field) continue
    if (!mappingByFieldId.get(fieldId)) mappingIssues.push(`Match On field is not mapped: ${field.name}`)
  }

  parsed.rows.forEach((row, rowIndex) => {
    const hasAnyValue = row.some((value) => String(value || '').trim())
    const csvRowNumber = rowIndex + 2
    if (!hasAnyValue) {
      pushValidatedRowIssue({ row: csvRowNumber, fieldName: '', message: 'Empty row', kind: 'field' }, rowIssues, warningIssues)
      return
    }
    const cells = getMappedRowCells(row, parsed.headers, fields, mapping)
    checkedCells += cells.length
    for (const cell of cells) {
      const issue = validateCell(cell.field, cell.value)
      if (typeof issue === 'string' && issue.startsWith('picklist:')) {
        pushValidatedRowIssue(
          { row: csvRowNumber, fieldName: cell.field.name, message: issue.slice('picklist:'.length), kind: 'picklist' },
          rowIssues,
          warningIssues
        )
      } else if (issue) {
        pushValidatedRowIssue(
          { row: csvRowNumber, fieldName: cell.field.name, message: String(issue), kind: 'field' },
          rowIssues,
          warningIssues
        )
      }
    }
    if (matchFields.length > 0) {
      const cellByFieldId = new Map(cells.map((cell) => [cell.field.fieldId, cell]))
      for (const field of matchFields) {
        const value = String(cellByFieldId.get(field.fieldId)?.value || '').trim()
        if (!value) {
          pushValidatedRowIssue(
            { row: csvRowNumber, fieldName: field.name, message: 'Match On value is required', kind: 'field' },
            rowIssues,
            warningIssues
          )
        }
      }
    }
  })

  return {
    valid: mappingIssues.length === 0 && rowIssues.length === 0,
    mappingIssues,
    rowIssues,
    warningIssues,
    checkedRows: parsed.rows.length,
    checkedCells
  }
}

export type GridImportValidationProgress = {
  phase: 'mapping' | 'rows' | 'complete'
  completed: number
  total: number
  message: string
  rowSnapshot?: {
    csvRowNumber: number
    tone: GridImportRowValidationTone
    messages: string[]
  }
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, 0))
}

export async function validateGridImportWithProgress(
  parsed: CsvParseResult,
  fields: GridImportField[],
  mapping: GridImportMapping[],
  matchFieldIds: string[] = [],
  onProgress: (progress: GridImportValidationProgress) => void
): Promise<GridImportValidationResult> {
  onProgress({ phase: 'mapping', completed: 0, total: 1, message: 'Checking field mapping...' })
  await waitForPaint()

  const mappingIssues = validateImportMapping(parsed.headers, fields, mapping)
  const rowIssues: GridImportValidationResult['rowIssues'] = []
  const warningIssues: GridImportValidationResult['warningIssues'] = []
  let checkedCells = 0
  const fieldById = new Map(fields.map((field) => [field.fieldId, field]))
  const mappingByFieldId = new Map(mapping.map((entry) => [entry.fieldId, entry.header]))
  const matchFields = matchFieldIds
    .filter((fieldId) => Boolean(mappingByFieldId.get(fieldId)))
    .map((fieldId) => fieldById.get(fieldId))
    .filter((field): field is GridImportField => Boolean(field))

  for (const fieldId of matchFieldIds) {
    const field = fieldById.get(fieldId)
    if (!field) continue
    if (!mappingByFieldId.get(fieldId)) mappingIssues.push(`Match On field is not mapped: ${field.name}`)
  }

  const total = parsed.rows.length
  for (let rowIndex = 0; rowIndex < parsed.rows.length; rowIndex += 1) {
    const row = parsed.rows[rowIndex]!
    const csvRowNumber = rowIndex + 2

    const hasAnyValue = row.some((value) => String(value || '').trim())
    if (!hasAnyValue) {
      pushValidatedRowIssue({ row: csvRowNumber, fieldName: '', message: 'Empty row', kind: 'field' }, rowIssues, warningIssues)
    } else {
      const cells = getMappedRowCells(row, parsed.headers, fields, mapping)
      checkedCells += cells.length
      for (const cell of cells) {
        const issue = validateCell(cell.field, cell.value)
        if (typeof issue === 'string' && issue.startsWith('picklist:')) {
          pushValidatedRowIssue(
            { row: csvRowNumber, fieldName: cell.field.name, message: issue.slice('picklist:'.length), kind: 'picklist' },
            rowIssues,
            warningIssues
          )
        } else if (issue) {
          pushValidatedRowIssue(
            { row: csvRowNumber, fieldName: cell.field.name, message: String(issue), kind: 'field' },
            rowIssues,
            warningIssues
          )
        } else {
          const picklistIssue = await validatePicklistCell(cell.field, cell.value)
          if (picklistIssue) {
            pushValidatedRowIssue(
              { row: csvRowNumber, fieldName: cell.field.name, message: picklistIssue, kind: 'picklist' },
              rowIssues,
              warningIssues
            )
          }
        }
      }
      if (matchFields.length > 0) {
        const cellByFieldId = new Map(cells.map((cell) => [cell.field.fieldId, cell]))
        for (const field of matchFields) {
          const value = String(cellByFieldId.get(field.fieldId)?.value || '').trim()
          if (!value) {
            pushValidatedRowIssue(
              { row: csvRowNumber, fieldName: field.name, message: 'Match On value is required', kind: 'field' },
              rowIssues,
              warningIssues
            )
          }
        }
      }
    }

    const tone = resolveRowValidationTone(rowIssues, warningIssues, csvRowNumber)
    const messages = [
      ...rowIssues.filter((issue) => issue.row === csvRowNumber).map(formatRowIssueMessage),
      ...warningIssues.filter((issue) => issue.row === csvRowNumber).map(formatRowIssueMessage)
    ]

    onProgress({
      phase: 'rows',
      completed: rowIndex + 1,
      total,
      message: `Validating row ${rowIndex + 1} of ${total}...`,
      rowSnapshot: {
        csvRowNumber,
        tone,
        messages
      }
    })
    await waitForPaint()
  }

  onProgress({ phase: 'complete', completed: total, total, message: 'Validation complete.' })
  await waitForPaint()
  return {
    valid: mappingIssues.length === 0 && rowIssues.length === 0,
    mappingIssues,
    rowIssues,
    warningIssues,
    checkedRows: parsed.rows.length,
    checkedCells
  }
}

