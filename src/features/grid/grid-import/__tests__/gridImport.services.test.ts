// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { CapturedGridFieldDefinition, FormFieldDefinition } from '../../grid-advanced-editor/types'
import { isCsvFileName, parseCsv, sampleCsvRows } from '../csv.service'
import { buildImportableFields, createAutoMapping, validateImportMapping } from '../mapping.service'
import { buildGridImportRowData, submitGridImportRows } from '../submit.service'
import { validateGridImport } from '../validation.service'

function rawField(id: string, name: string, overrides: Partial<CapturedGridFieldDefinition> = {}): CapturedGridFieldDefinition {
  return {
    __self__: `/api/v3/workspaces/1/views/2/fields/${id}`,
    name,
    type: { link: '/api/v3/field-types/4', title: 'Single Line Text' },
    displayOrder: 0,
    editability: 'ALWAYS',
    visibility: 'ALWAYS',
    derived: false,
    ...overrides
  }
}

function formField(fieldId: string, title: string, overrides: Partial<FormFieldDefinition> = {}): FormFieldDefinition {
  return {
    fieldId,
    title,
    description: null,
    kind: 'text',
    typeId: null,
    picklistPath: null,
    defaultValue: null,
    defaultPayloadValue: null,
    fieldLength: null,
    fieldPrecision: null,
    unitOfMeasure: null,
    required: false,
    editable: true,
    visible: true,
    displayOrder: 0,
    fieldSelf: `/api/v3/workspaces/1/views/2/fields/${fieldId}`,
    fieldUrn: `urn:test:${fieldId}`,
    ...overrides
  }
}

describe('grid import CSV parsing', () => {
  it('accepts only CSV filenames and parses quoted values safely', () => {
    expect(isCsvFileName('rows.csv')).toBe(true)
    expect(isCsvFileName('rows.xlsx')).toBe(false)
    expect(parseCsv('Name,Notes\r\nAlpha,"one, two"\nBeta,"multi\nline"')).toEqual({
      headers: ['Name', 'Notes'],
      rows: [
        ['Alpha', 'one, two'],
        ['Beta', 'multi\nline']
      ]
    })
  })

  it('samples preview rows without dropping import rows', () => {
    const rows = Array.from({ length: 60 }, (_, index) => [String(index)])
    expect(sampleCsvRows(rows)).toHaveLength(50)
    expect(rows).toHaveLength(60)
  })
})

describe('grid import mapping', () => {
  it('builds fields dynamically, sorts by display order, and excludes read-only formula fields', () => {
    const fields = [
      rawField('STEP', 'Step', { displayOrder: 2 }),
      rawField('SEV', 'SEV', { displayOrder: 1, type: { link: '/api/v3/field-types/30', title: 'Integer' } }),
      rawField('RPN', 'RPN', { displayOrder: 3, editability: 'NEVER', formulaField: true })
    ]
    const importable = buildImportableFields(
      { fields },
      [
        formField('STEP', 'Step', { displayOrder: 2 }),
        formField('SEV', 'SEV', { kind: 'number', typeId: 30, displayOrder: 1 }),
        formField('RPN', 'RPN', { editable: false, displayOrder: 3 })
      ]
    )

    expect(importable.map((field) => [field.fieldId, field.name])).toEqual([
      ['SEV', 'SEV'],
      ['STEP', 'Step']
    ])
  })

  it('uses field ids from __self__ while preserving matched form metadata by field name', () => {
    const importable = buildImportableFields(
      { fields: [rawField('KEY_PROCESS_STEP_OR_INPUT', 'Key Process Step or Input')] },
      [formField('KEY PROCESS STEP OR INPUT', 'Key Process Step or Input', { required: true, fieldLength: 25 })]
    )

    expect(importable[0]!.fieldId).toBe('KEY_PROCESS_STEP_OR_INPUT')
    expect(importable[0]!.field.required).toBe(true)
    expect(importable[0]!.field.fieldLength).toBe(25)
  })

  it('auto matches CSV headers to field names and validates duplicate mappings', () => {
    const fields = buildImportableFields(
      { fields: [rawField('NAME', 'Name'), rawField('QTY', 'Quantity')] },
      [formField('NAME', 'Name', { required: true }), formField('QTY', 'Quantity')]
    )
    expect(createAutoMapping(['Quantity', 'Name'], fields)).toEqual([
      { fieldId: 'NAME', header: 'Name' },
      { fieldId: 'QTY', header: 'Quantity' }
    ])
    expect(validateImportMapping(['Name', 'Name'], fields, [{ fieldId: 'NAME', header: '' }, { fieldId: 'QTY', header: 'Missing' }])).toEqual([
      'Duplicate CSV header: name',
      'Required field is not mapped: Name',
      'Mapped header does not exist: Missing'
    ])
  })
})

describe('grid import validation and submit', () => {
  it('validates numeric, picklist, and empty row failures from metadata', () => {
    const raw = [
      rawField('SEV', 'SEV', {
        type: { link: '/api/v3/field-types/30', title: 'Integer' },
        fieldLength: 2,
        fieldValidators: [{ min: 1, max: 10 }]
      }),
      rawField('OWNER', 'Owner', {
        type: { link: '/api/v3/field-types/20', title: 'Single Selection' },
        picklistFieldDefinition: { options: [{ label: 'Alice' }, { label: 'Bob' }] }
      })
    ]
    const fields = buildImportableFields(
      { fields: raw },
      [
        formField('SEV', 'SEV', { kind: 'number', typeId: 30, fieldLength: 2 }),
        formField('OWNER', 'Owner', { typeId: 20, picklistPath: '/api/v3/lookups/users' })
      ]
    )
    const parsed = parseCsv('SEV,Owner\n11,Charlie\n3,Alice\n\n123,Bob\nbad,Alice')
    const result = validateGridImport(parsed, fields, createAutoMapping(parsed.headers, fields))

    expect(result.valid).toBe(true)
    expect(result.rowIssues).toEqual([])
    expect(result.warningIssues).toEqual([
      { row: 2, fieldName: 'SEV', message: 'must be less than or equal to 10', kind: 'field' },
      { row: 2, fieldName: 'Owner', message: 'has unsupported picklist value "Charlie"', kind: 'picklist' },
      { row: 4, fieldName: '', message: 'Empty row', kind: 'field' },
      { row: 5, fieldName: 'SEV', message: 'exceeds 2 integer digit(s)', kind: 'field' },
      { row: 6, fieldName: 'SEV', message: 'must be a number', kind: 'field' }
    ])
    expect(result.checkedRows).toBe(5)
    expect(result.checkedCells).toBe(8)
  })

  it('requires selected Match On fields to be mapped and populated', () => {
    const parsed = parseCsv('Name,Code\nWidget,')
    const fields = buildImportableFields(
      { fields: [rawField('NAME', 'Name'), rawField('CODE', 'Code')] },
      [formField('NAME', 'Name'), formField('CODE', 'Code')]
    )

    expect(validateGridImport(parsed, fields, [{ fieldId: 'NAME', header: 'Name' }, { fieldId: 'CODE', header: '' }], ['CODE'])).toEqual({
      valid: false,
      mappingIssues: ['Match On field is not mapped: Code'],
      rowIssues: [],
      warningIssues: [],
      checkedRows: 1,
      checkedCells: 1
    })

    expect(validateGridImport(parsed, fields, createAutoMapping(parsed.headers, fields), ['CODE']).rowIssues).toEqual([
      { row: 2, fieldName: 'Code', message: 'Match On value is required', kind: 'field' }
    ])
  })

  it('builds Advanced Editor compatible submit entries', async () => {
    const fields = buildImportableFields(
      { fields: [rawField('NAME', 'Name'), rawField('QTY', 'Quantity', { type: { link: '/api/v3/field-types/30', title: 'Integer' } })] },
      [formField('NAME', 'Name'), formField('QTY', 'Quantity', { kind: 'number', typeId: 30 })]
    )
    const data = await buildGridImportRowData([
      { field: fields[0]!, value: 'Widget' },
      { field: fields[1]!, value: '7' }
    ])
    expect(data.map((entry) => ({ fieldId: entry.fieldId, type: entry.type, value: entry.value, display: entry.display }))).toEqual([
      { fieldId: 'NAME', type: 'string', value: 'Widget', display: 'Widget' },
      { fieldId: 'QTY', type: 'integer', value: '7', display: '7' }
    ])
  })

  it('blanks unsupported picklist values when importing with known picklist issues', async () => {
    const fields = buildImportableFields(
      {
        fields: [
          rawField('OWNER', 'Owner', {
            type: { link: '/api/v3/field-types/20', title: 'Single Selection' },
            picklistFieldDefinition: { options: [{ label: 'Alice' }] }
          })
        ]
      },
      [formField('OWNER', 'Owner', { typeId: 20, picklistPath: '/api/v3/lookups/users' })]
    )
    const data = await buildGridImportRowData([{ field: fields[0]!, value: 'Missing User' }])
    expect(data[0]).toMatchObject({ fieldId: 'OWNER', value: '', display: '' })
  })

  it('submits valid rows and returns API failures by CSV row', async () => {
    const parsed = parseCsv('Name\nGood\nBad')
    const fields = buildImportableFields({ fields: [rawField('NAME', 'Name')] }, [formField('NAME', 'Name')])
    const mapping = createAutoMapping(parsed.headers, fields)
    const requestPlmAction = vi.fn(async (_action: string, payload?: Record<string, unknown>) => {
      const data = payload?.data as Array<{ display: string }>
      if (data[0]?.display === 'Bad') throw new Error('API rejected row')
      return '/api/v3/rows/1'
    })

    const result = await submitGridImportRows(
      parsed,
      fields,
      mapping,
      {
        ext: {
          requestPlmAction: requestPlmAction as unknown as <T = unknown>(action: string, payload?: Record<string, unknown>) => Promise<T>
        },
        tenant: 'TEST',
        workspaceId: 1,
        dmsId: 2,
        viewId: 3
      },
      vi.fn()
    )

    expect(requestPlmAction).toHaveBeenCalledTimes(2)
    expect(requestPlmAction.mock.calls[0]![0]).toBe('addItemGridRow')
    expect(result).toEqual({
      successCount: 1,
      addCount: 1,
      updateCount: 0,
      failures: [{ row: 3, message: 'API rejected row' }]
    })
  })

  it('updates matching existing rows when composite Match On fields match', async () => {
    const parsed = parseCsv('Name,Code\nWidget,A1\nNew,B2')
    const fields = buildImportableFields(
      { fields: [rawField('NAME', 'Name'), rawField('CODE', 'Code')] },
      [formField('NAME', 'Name'), formField('CODE', 'Code')]
    )
    const mapping = createAutoMapping(parsed.headers, fields)
    const requestPlmAction = vi.fn(async () => '/api/v3/rows/1')

    const result = await submitGridImportRows(
      parsed,
      fields,
      mapping,
      {
        ext: {
          requestPlmAction: requestPlmAction as unknown as <T = unknown>(action: string, payload?: Record<string, unknown>) => Promise<T>
        },
        tenant: 'TEST',
        workspaceId: 1,
        dmsId: 2,
        viewId: 3,
        matchFieldIds: ['NAME', 'CODE'],
        existingRows: [
          {
            index: 0,
            identity: 'row-1',
            rowId: '42',
            byFieldId: new Map([
              ['NAME', 'Widget'],
              ['CODE', 'A1']
            ]),
            byFieldLink: new Map(),
            byTitle: new Map(),
            rawByFieldId: new Map()
          }
        ]
      },
      vi.fn()
    )

    const calls = requestPlmAction.mock.calls as unknown as [string, Record<string, unknown>?][]
    expect(calls.map((call) => call[0])).toEqual(['updateItemGridRow', 'addItemGridRow'])
    expect(calls[0]?.[1]).toMatchObject({ rowId: '42' })
    expect(result).toEqual({ successCount: 2, addCount: 1, updateCount: 1, failures: [] })
  })
})

