// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { CapturedGridFieldDefinition, FormFieldDefinition } from '../../grid-advanced-editor/types'
import {
  buildImportEditSession,
  canBuildImportEditSession,
  formatImportEditAllSkippedStatus,
  IMPORT_EDIT_MATCH_ONLY_SKIP_MESSAGE,
  IMPORT_EDIT_SESSION_VALIDATION_MESSAGE,
  summarizeImportEditSkippedRows
} from '../build-import-edit-session'
import {
  buildExistingRowMatchIndex,
  classifyImportRowMatch,
  classificationErrorMessage,
  getNonEmptyCsvRows
} from '../import-row-classification'
import {
  gridStagedFieldValuesForImportEditUpdate,
  gridStagedFieldValuesFromSubmitData
} from '../import-row-data'
import { parseCsv } from '../csv.service'
import { buildImportableFields, createAutoMapping } from '../mapping.service'
import { buildGridImportRowData } from '../submit.service'
import { getMappedRowCells } from '../validation.service'
import type { GridImportMapping, GridImportValidationResult } from '../types'
import type { GridImportMatchableRow } from '../import-row-classification'

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

const validValidation: GridImportValidationResult = {
  valid: true,
  mappingIssues: [],
  rowIssues: [],
  warningIssues: [],
  checkedRows: 0,
  checkedCells: 0
}

describe('import row classification', () => {
  it('classifies rows without Match On as insert', () => {
    const parsed = parseCsv('Name\nWidget')
    const fields = buildImportableFields({ fields: [rawField('NAME', 'Name')] }, [formField('NAME', 'Name')])
    const mapping = createAutoMapping(parsed.headers, fields)
    const cells = getMappedRowCells(parsed.rows[0]!, parsed.headers, fields, mapping)
    expect(classifyImportRowMatch(cells, [], new Map())).toEqual({ kind: 'insert' })
  })

  it('classifies incomplete Match On values as insert, matching submit add path', () => {
    const parsed = parseCsv('Name,Code\nWidget,')
    const fields = buildImportableFields(
      { fields: [rawField('NAME', 'Name'), rawField('CODE', 'Code')] },
      [formField('NAME', 'Name'), formField('CODE', 'Code')]
    )
    const mapping = createAutoMapping(parsed.headers, fields)
    const cells = getMappedRowCells(parsed.rows[0]!, parsed.headers, fields, mapping)
    const index = buildExistingRowMatchIndex(
      [
        {
          rowId: '42',
          index: 0,
          byFieldId: new Map([
            ['NAME', 'Widget'],
            ['CODE', 'A1']
          ])
        }
      ],
      ['NAME', 'CODE']
    )
    expect(classifyImportRowMatch(cells, ['NAME', 'CODE'], index)).toEqual({ kind: 'insert' })
  })

  it('classifies a single Match On hit as update', () => {
    const parsed = parseCsv('Name,Code\nWidget,A1')
    const fields = buildImportableFields(
      { fields: [rawField('NAME', 'Name'), rawField('CODE', 'Code')] },
      [formField('NAME', 'Name'), formField('CODE', 'Code')]
    )
    const mapping = createAutoMapping(parsed.headers, fields)
    const cells = getMappedRowCells(parsed.rows[0]!, parsed.headers, fields, mapping)
    const index = new Map([
      [
        'widget\u001fa1',
        [
          {
            rowId: '42',
            index: 0,
            byFieldId: new Map([
              ['NAME', 'Widget'],
              ['CODE', 'A1']
            ])
          }
        ]
      ]
    ])
    expect(classifyImportRowMatch(cells, ['NAME', 'CODE'], index)).toEqual({
      kind: 'update',
      matchedRowId: '42',
      matchedApiRowIndex: 0
    })
  })
})

describe('buildImportEditSession', () => {
  it('skips empty CSV rows like submit import', async () => {
    const parsed = parseCsv('Name\nWidget\n\nGadget')
    expect(getNonEmptyCsvRows(parsed).map((entry) => entry.csvRowNumber)).toEqual([2, 4])

    const fields = buildImportableFields({ fields: [rawField('NAME', 'Name')] }, [formField('NAME', 'Name')])
    const mapping = createAutoMapping(parsed.headers, fields)
    const session = await buildImportEditSession({
      fileName: 'rows.csv',
      parsed,
      fields,
      mapping,
      matchFieldIds: [],
      validation: validValidation,
      rowValidation: {
        2: { tone: 'pass', messages: [] },
        4: { tone: 'pass', messages: [] }
      }
    })

    expect(session.rows).toHaveLength(2)
    expect(session.rows.every((row) => row.kind === 'insert')).toBe(true)
    expect(session.rows.map((row) => row.csvRowNumber)).toEqual([2, 4])
    expect(session.skippedRows).toEqual([])
  })

  it('excludes Match On fields from update row staged fields', async () => {
    const parsed = parseCsv('Name,Code,Qty\nWidget,A1,9')
    const fields = buildImportableFields(
      {
        fields: [
          rawField('NAME', 'Name'),
          rawField('CODE', 'Code'),
          rawField('QTY', 'Qty', { type: { link: '/api/v3/field-types/30', title: 'Integer' } })
        ]
      },
      [formField('NAME', 'Name'), formField('CODE', 'Code'), formField('QTY', 'Qty', { kind: 'number', typeId: 30 })]
    )
    const mapping = createAutoMapping(parsed.headers, fields)
    const cells = getMappedRowCells(parsed.rows[0]!, parsed.headers, fields, mapping)
    const submitData = await buildGridImportRowData(cells)

    expect(gridStagedFieldValuesForImportEditUpdate(submitData, ['NAME', 'CODE'])).toEqual([
      { fieldId: 'QTY', payload: '9', display: '9' }
    ])

    const session = await buildImportEditSession({
      fileName: 'match-keys.csv',
      parsed,
      fields,
      mapping,
      matchFieldIds: ['NAME', 'CODE'],
      validation: validValidation,
      rowValidation: { 2: { tone: 'pass', messages: [] } },
      existingRows: [
        {
          rowId: '42',
          index: 0,
          byFieldId: new Map([
            ['NAME', 'Widget'],
            ['CODE', 'A1']
          ])
        }
      ]
    })

    expect(session.rows).toHaveLength(1)
    expect(session.rows[0]).toMatchObject({
      kind: 'update',
      matchedRowId: '42',
      fields: [{ fieldId: 'QTY', payload: '9', display: '9' }]
    })
  })

  it('keeps Match On fields on insert row staged fields', async () => {
    const parsed = parseCsv('Name,Code\nNew,B2')
    const fields = buildImportableFields(
      { fields: [rawField('NAME', 'Name'), rawField('CODE', 'Code')] },
      [formField('NAME', 'Name'), formField('CODE', 'Code')]
    )
    const mapping = createAutoMapping(parsed.headers, fields)

    const session = await buildImportEditSession({
      fileName: 'insert-keys.csv',
      parsed,
      fields,
      mapping,
      matchFieldIds: ['NAME', 'CODE'],
      validation: validValidation,
      rowValidation: { 2: { tone: 'pass', messages: [] } },
      existingRows: [
        {
          rowId: '42',
          index: 0,
          byFieldId: new Map([
            ['NAME', 'Widget'],
            ['CODE', 'A1']
          ])
        }
      ]
    })

    expect(session.rows).toHaveLength(1)
    expect(session.rows[0]!).toMatchObject({ kind: 'insert', csvRowNumber: 2 })
    if (session.rows[0]!.kind === 'insert') {
      expect(session.rows[0]!.fields.map((field) => field.fieldId).sort()).toEqual(['CODE', 'NAME'])
    }
  })

  it('records match-only update rows in skippedRows with a clear reason', async () => {
    const parsed = parseCsv('Name,Code\nWidget,A1')
    const fields = buildImportableFields(
      { fields: [rawField('NAME', 'Name'), rawField('CODE', 'Code')] },
      [formField('NAME', 'Name'), formField('CODE', 'Code')]
    )
    const mapping = createAutoMapping(parsed.headers, fields)

    const session = await buildImportEditSession({
      fileName: 'keys-only.csv',
      parsed,
      fields,
      mapping,
      matchFieldIds: ['NAME', 'CODE'],
      validation: validValidation,
      rowValidation: { 2: { tone: 'pass', messages: [] } },
      existingRows: [
        {
          rowId: '42',
          index: 0,
          byFieldId: new Map([
            ['NAME', 'Widget'],
            ['CODE', 'A1']
          ])
        }
      ]
    })

    expect(session.rows).toEqual([])
    expect(session.skippedRows).toEqual([
      { csvRowNumber: 2, reason: IMPORT_EDIT_MATCH_ONLY_SKIP_MESSAGE }
    ])
  })

  it('builds update rows when Match On matches existing grid rows', async () => {
    const parsed = parseCsv('Name,Code,Qty\nWidget,A1,9\nNew,B2,1')
    const fields = buildImportableFields(
      {
        fields: [
          rawField('NAME', 'Name'),
          rawField('CODE', 'Code'),
          rawField('QTY', 'Qty', { type: { link: '/api/v3/field-types/30', title: 'Integer' } })
        ]
      },
      [formField('NAME', 'Name'), formField('CODE', 'Code'), formField('QTY', 'Qty', { kind: 'number', typeId: 30 })]
    )
    const mapping = createAutoMapping(parsed.headers, fields)

    const session = await buildImportEditSession({
      fileName: 'match.csv',
      parsed,
      fields,
      mapping,
      matchFieldIds: ['NAME', 'CODE'],
      validation: validValidation,
      rowValidation: {
        2: { tone: 'pass', messages: [] },
        3: { tone: 'pass', messages: [] }
      },
      existingRows: [
        {
          rowId: '42',
          index: 0,
          byFieldId: new Map([
            ['NAME', 'Widget'],
            ['CODE', 'A1']
          ])
        }
      ],
      domRowIndexByRowId: new Map([['42', 5]])
    })

    expect(session.rows).toHaveLength(2)
    expect(session.rows[0]).toMatchObject({
      kind: 'update',
      csvRowNumber: 2,
      matchedRowId: '42',
      matchedApiRowIndex: 0,
      domRowIndex: 5,
      fields: [{ fieldId: 'QTY', payload: '9', display: '9' }]
    })
    expect(session.rows[1]).toMatchObject({
      kind: 'insert',
      csvRowNumber: 3,
      sourceRowLabel: 'CSV row 3'
    })
  })

  it('preserves fieldId, payload, and display on resolved staged values', async () => {
    const parsed = parseCsv('Name,Qty\nWidget,7')
    const fields = buildImportableFields(
      {
        fields: [
          rawField('NAME', 'Name'),
          rawField('QTY', 'Qty', { type: { link: '/api/v3/field-types/30', title: 'Integer' } })
        ]
      },
      [formField('NAME', 'Name'), formField('QTY', 'Qty', { kind: 'number', typeId: 30 })]
    )
    const mapping = createAutoMapping(parsed.headers, fields)
    const cells = getMappedRowCells(parsed.rows[0]!, parsed.headers, fields, mapping)
    const submitData = await buildGridImportRowData(cells)
    const staged = gridStagedFieldValuesFromSubmitData(submitData)

    expect(staged).toEqual([
      { fieldId: 'NAME', payload: 'Widget', display: 'Widget' },
      { fieldId: 'QTY', payload: '7', display: '7' }
    ])

    const session = await buildImportEditSession({
      fileName: 'values.csv',
      parsed,
      fields,
      mapping,
      matchFieldIds: [],
      validation: validValidation,
      rowValidation: { 2: { tone: 'pass', messages: [] } }
    })

    expect(session.rows[0]!.kind).toBe('insert')
    if (session.rows[0]!.kind === 'insert') {
      expect(session.rows[0]!.fields).toEqual(staged)
    }
  })

  it('carries row validation hints and blocking row numbers', async () => {
    const parsed = parseCsv('Name\nWidget')
    const fields = buildImportableFields({ fields: [rawField('NAME', 'Name')] }, [formField('NAME', 'Name')])
    const mapping = createAutoMapping(parsed.headers, fields)

    const session = await buildImportEditSession({
      fileName: 'hints.csv',
      parsed,
      fields,
      mapping,
      matchFieldIds: [],
      validation: validValidation,
      rowValidation: {
        2: { tone: 'warning', messages: ['Owner: unsupported value'] },
        3: { tone: 'error', messages: ['Name: is required'] }
      }
    })

    expect(session.validationHints.rowValidationByCsvRow[2]).toEqual({
      tone: 'warning',
      messages: ['Owner: unsupported value']
    })
    expect(session.validationHints.blockingCsvRowNumbers).toEqual([3])
  })

  it('records ambiguous Match On rows in skippedRows', async () => {
    const parsed = parseCsv('Name,Code\nWidget,A1')
    const fields = buildImportableFields(
      { fields: [rawField('NAME', 'Name'), rawField('CODE', 'Code')] },
      [formField('NAME', 'Name'), formField('CODE', 'Code')]
    )
    const mapping = createAutoMapping(parsed.headers, fields)
    const duplicateMatchRow: GridImportMatchableRow = {
      rowId: '42',
      index: 0,
      byFieldId: new Map([
        ['NAME', 'Widget'],
        ['CODE', 'A1']
      ])
    }

    const session = await buildImportEditSession({
      fileName: 'ambiguous.csv',
      parsed,
      fields,
      mapping,
      matchFieldIds: ['NAME', 'CODE'],
      validation: validValidation,
      rowValidation: { 2: { tone: 'pass', messages: [] } },
      existingRows: [duplicateMatchRow, { ...duplicateMatchRow, rowId: '43', index: 1 }]
    })

    expect(session.rows).toEqual([])
    expect(session.skippedRows).toEqual([
      {
        csvRowNumber: 2,
        reason: classificationErrorMessage('ambiguous-match')
      }
    ])
  })

  it('records matched rows without row id in skippedRows', async () => {
    const parsed = parseCsv('Name,Code\nWidget,A1')
    const fields = buildImportableFields(
      { fields: [rawField('NAME', 'Name'), rawField('CODE', 'Code')] },
      [formField('NAME', 'Name'), formField('CODE', 'Code')]
    )
    const mapping = createAutoMapping(parsed.headers, fields)

    const session = await buildImportEditSession({
      fileName: 'missing-id.csv',
      parsed,
      fields,
      mapping,
      matchFieldIds: ['NAME', 'CODE'],
      validation: validValidation,
      rowValidation: { 2: { tone: 'pass', messages: [] } },
      existingRows: [
        {
          rowId: null,
          index: 0,
          byFieldId: new Map([
            ['NAME', 'Widget'],
            ['CODE', 'A1']
          ])
        }
      ]
    })

    expect(session.rows).toEqual([])
    expect(session.skippedRows).toEqual([
      {
        csvRowNumber: 2,
        reason: classificationErrorMessage('missing-row-id')
      }
    ])
  })

  it('records rows with no mapped field values in skippedRows', async () => {
    const parsed = parseCsv('Notes\nhello')
    const fields = buildImportableFields({ fields: [rawField('NAME', 'Name')] }, [formField('NAME', 'Name')])
    const mapping: GridImportMapping[] = [{ fieldId: 'NAME', header: '' }]

    const session = await buildImportEditSession({
      fileName: 'unmapped.csv',
      parsed,
      fields,
      mapping,
      matchFieldIds: [],
      validation: validValidation,
      rowValidation: { 2: { tone: 'pass', messages: [] } }
    })

    expect(session.rows).toEqual([])
    expect(session.skippedRows).toEqual([
      {
        csvRowNumber: 2,
        reason: classificationErrorMessage('no-mapped-values')
      }
    ])
  })

  it('classifies incomplete Match On as insert rows in the session', async () => {
    const parsed = parseCsv('Name,Code\nWidget,')
    const fields = buildImportableFields(
      { fields: [rawField('NAME', 'Name'), rawField('CODE', 'Code')] },
      [formField('NAME', 'Name'), formField('CODE', 'Code')]
    )
    const mapping = createAutoMapping(parsed.headers, fields)

    const session = await buildImportEditSession({
      fileName: 'partial-match.csv',
      parsed,
      fields,
      mapping,
      matchFieldIds: ['NAME', 'CODE'],
      validation: validValidation,
      rowValidation: { 2: { tone: 'pass', messages: [] } },
      existingRows: [
        {
          rowId: '42',
          index: 0,
          byFieldId: new Map([
            ['NAME', 'Widget'],
            ['CODE', 'A1']
          ])
        }
      ]
    })

    expect(session.skippedRows).toEqual([])
    expect(session.rows).toHaveLength(1)
    expect(session.rows[0]).toMatchObject({ kind: 'insert', csvRowNumber: 2 })
  })

  it('rejects session build when validation is invalid', async () => {
    const parsed = parseCsv('Name\nWidget')
    const fields = buildImportableFields({ fields: [rawField('NAME', 'Name')] }, [formField('NAME', 'Name')])
    const mapping = createAutoMapping(parsed.headers, fields)
    const invalidValidation: GridImportValidationResult = {
      valid: false,
      mappingIssues: [],
      rowIssues: [{ row: 2, fieldName: 'Name', message: 'is required', kind: 'field' }],
      warningIssues: [],
      checkedRows: 1,
      checkedCells: 1
    }

    await expect(
      buildImportEditSession({
        fileName: 'invalid.csv',
        parsed,
        fields,
        mapping,
        matchFieldIds: [],
        validation: invalidValidation,
        rowValidation: {}
      })
    ).rejects.toThrow(IMPORT_EDIT_SESSION_VALIDATION_MESSAGE)
  })
})

describe('import edit all-skipped summary', () => {
  it('returns null when there are no skipped rows', () => {
    expect(summarizeImportEditSkippedRows([])).toBeNull()
  })

  it('summarizes a single skipped row without an additional-rows hint', () => {
    expect(
      summarizeImportEditSkippedRows([{ csvRowNumber: 2, reason: IMPORT_EDIT_MATCH_ONLY_SKIP_MESSAGE }])
    ).toEqual({
      skippedRowCount: 1,
      firstReason: IMPORT_EDIT_MATCH_ONLY_SKIP_MESSAGE,
      hasAdditionalSkippedRows: false
    })
  })

  it('formats status with skipped count, first reason, and additional-rows hint', () => {
    const summary = summarizeImportEditSkippedRows([
      { csvRowNumber: 2, reason: IMPORT_EDIT_MATCH_ONLY_SKIP_MESSAGE },
      { csvRowNumber: 3, reason: 'Multiple existing grid rows match selected Match On fields.' }
    ])
    expect(summary).toMatchObject({
      skippedRowCount: 2,
      hasAdditionalSkippedRows: true
    })
    expect(formatImportEditAllSkippedStatus(summary!)).toContain('2 CSV row(s) could not be staged')
    expect(formatImportEditAllSkippedStatus(summary!)).toContain(IMPORT_EDIT_MATCH_ONLY_SKIP_MESSAGE)
    expect(formatImportEditAllSkippedStatus(summary!)).toContain('Additional skipped rows may have other reasons.')
  })
})

describe('canBuildImportEditSession', () => {
  it('returns false when validation is null', () => {
    expect(canBuildImportEditSession(null)).toBe(false)
  })

  it('returns true when validation.valid is true', () => {
    expect(canBuildImportEditSession(validValidation)).toBe(true)
  })

  it('returns false when validation has blocking row issues', () => {
    expect(
      canBuildImportEditSession({
        valid: false,
        mappingIssues: ['Required field is not mapped: Name'],
        rowIssues: [],
        warningIssues: [],
        checkedRows: 0,
        checkedCells: 0
      })
    ).toBe(false)
  })

  it('returns true when only validation warnings are present', () => {
    expect(
      canBuildImportEditSession({
        valid: true,
        mappingIssues: [],
        rowIssues: [],
        warningIssues: [{ row: 2, fieldName: 'Owner', message: 'unsupported', kind: 'picklist' }],
        checkedRows: 1,
        checkedCells: 1
      })
    ).toBe(true)
  })
})
