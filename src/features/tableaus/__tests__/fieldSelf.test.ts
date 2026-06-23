import { describe, expect, it } from 'vitest'
import {
  buildAllowedFieldIdSetFromTableauMeta,
  collectTableauFieldImportIssues,
  fieldIdFromSelfUrl,
  findMissingTableauColumnFieldIds
} from '../services/fieldSelf'
import type { TableauExport, TableauListMetaResponse } from '../tableaus.types'

describe('fieldIdFromSelfUrl', () => {
  it('parses tableau-style column field paths', () => {
    expect(fieldIdFromSelfUrl('/api/v3/workspaces/57/views/0/fields/DESCRIPTOR')).toBe('DESCRIPTOR')
  })

  it('parses workspace field __self__ paths', () => {
    expect(fieldIdFromSelfUrl('/api/v3/workspaces/57/fields/description')).toBe('DESCRIPTION')
  })

  it('decodes percent-encoded segments', () => {
    expect(fieldIdFromSelfUrl('/api/v3/workspaces/57/fields/cust%20field')).toBe('CUST FIELD')
  })

  it('uses the same field id for any /views/{n}/fields/... path', () => {
    expect(fieldIdFromSelfUrl('/api/v3/workspaces/57/views/0/fields/LIFECYCLE_NAME')).toBe('LIFECYCLE_NAME')
    expect(fieldIdFromSelfUrl('/api/v3/workspaces/57/views/12/fields/LIFECYCLE_NAME')).toBe('LIFECYCLE_NAME')
  })
})

describe('buildAllowedFieldIdSetFromTableauMeta', () => {
  it('indexes by field id across tableaus', () => {
    const meta: TableauListMetaResponse = {
      tableaus: [
        {
          link: '/api/v3/workspaces/57/tableaus/1',
          columns: [
            {
              field: { __self__: '/api/v3/workspaces/57/views/0/fields/DESCRIPTOR' },
              group: { displayName: 'Item Descriptor' }
            },
            {
              field: { __self__: '/api/v3/workspaces/57/views/1/fields/LIFECYCLE_NAME' },
              group: { displayName: 'Lifecycle Name' }
            }
          ]
        }
      ]
    }
    const set = buildAllowedFieldIdSetFromTableauMeta(meta)
    expect(set.has('DESCRIPTOR')).toBe(true)
    expect(set.has('LIFECYCLE_NAME')).toBe(true)
  })

  it('accepts direct array-of-columns payload shape', () => {
    const meta = [
      { field: { __self__: '/api/v3/workspaces/57/views/0/fields/IMAGE' } },
      { field: { __self__: '/api/v3/workspaces/57/views/1/fields/DESCRIPTOR' } }
    ]
    const set = buildAllowedFieldIdSetFromTableauMeta(meta)
    expect(set.has('IMAGE')).toBe(true)
    expect(set.has('DESCRIPTOR')).toBe(true)
  })

  it('accepts top-level { columns: [...] } payload shape', () => {
    const meta = {
      columns: [
        { field: { __self__: '/api/v3/workspaces/57/views/0/fields/IMAGE' } },
        { field: { __self__: '/api/v3/workspaces/57/views/1/fields/CREATED_ON' } }
      ]
    }
    const set = buildAllowedFieldIdSetFromTableauMeta(meta)
    expect(set.has('IMAGE')).toBe(true)
    expect(set.has('CREATED_ON')).toBe(true)
  })
})

describe('collectTableauFieldImportIssues', () => {
  const tableau = (columns: TableauExport['columns']): TableauExport => ({
    __self__: '/api/v3/workspaces/1/tableaus/1',
    name: 'T',
    columns
  })

  it('returns one row per bad column (no dedupe)', () => {
    const allowed = new Set(['DESCRIPTOR'])
    const t = tableau([
      { field: { __self__: '/api/v3/workspaces/1/views/0/fields/MISSING' }, group: { displayName: 'Item Descriptor' }, displayOrder: 0 },
      { field: { __self__: '/api/v3/workspaces/1/views/0/fields/MISSING' }, group: { displayName: 'Item Descriptor' }, displayOrder: 1 }
    ])
    const issues = collectTableauFieldImportIssues(t, allowed)
    expect(issues).toHaveLength(2)
    expect(issues[0]!.columnNumber).toBe(1)
    expect(issues[1]!.columnNumber).toBe(2)
    expect(issues.every((i) => i.kind === 'not_in_workspace')).toBe(true)
  })

  it('passes when field id exists', () => {
    const allowed = new Set(['ICON'])
    const t = tableau([
      {
        field: { __self__: '/api/v3/workspaces/1/views/1/fields/ICON' },
        group: { displayName: 'Item Icon' },
        displayOrder: 0
      }
    ])
    expect(collectTableauFieldImportIssues(t, allowed)).toEqual([])
  })

  it('ignores group.displayName mismatches', () => {
    const allowed = new Set(['ICON'])
    const t = tableau([
      {
        field: { __self__: '/api/v3/workspaces/1/views/1/fields/ICON' },
        group: { displayName: 'Lifecycle' },
        displayOrder: 0
      }
    ])
    expect(collectTableauFieldImportIssues(t, allowed)).toEqual([])
  })

  it('ignores missing group.displayName when field id exists', () => {
    const allowed = new Set(['DESCRIPTOR'])
    const t = tableau([
      {
        field: { __self__: '/api/v3/workspaces/1/views/0/fields/DESCRIPTOR' },
        displayOrder: 0
      }
    ])
    expect(collectTableauFieldImportIssues(t, allowed)).toEqual([])
  })

  it('matches same field id across different view numbers', () => {
    const allowed = new Set(['LIFECYCLE_NAME'])
    const t = tableau([
      {
        field: { __self__: '/api/v3/workspaces/57/views/0/fields/LIFECYCLE_NAME' },
        group: { displayName: 'Lifecycle Name' },
        displayOrder: 0
      },
      {
        field: { __self__: '/api/v3/workspaces/57/views/12/fields/LIFECYCLE_NAME' },
        group: { displayName: 'Lifecycle Name' },
        displayOrder: 1
      }
    ])
    expect(collectTableauFieldImportIssues(t, allowed)).toEqual([])
  })
})

describe('findMissingTableauColumnFieldIds', () => {
  const tableau = (columns: TableauExport['columns']): TableauExport => ({
    __self__: '/api/v3/workspaces/1/tableaus/1',
    name: 'T',
    columns
  })

  it('returns empty when all column field ids match', () => {
    const allowed = new Set(['DESCRIPTOR', 'DESCRIPTION'])
    const t = tableau([
      {
        field: { __self__: '/api/v3/workspaces/1/views/0/fields/DESCRIPTOR' },
        group: { displayName: 'Item Descriptor' },
        displayOrder: 0
      },
      {
        field: { __self__: '/api/v3/workspaces/1/fields/description' },
        group: { displayName: 'Item Details' },
        displayOrder: 1
      }
    ])
    expect(findMissingTableauColumnFieldIds(t, allowed)).toEqual([])
  })

  it('lists unknown field ids', () => {
    const allowed = new Set(['DESCRIPTOR'])
    const t = tableau([
      {
        field: { __self__: '/api/v3/workspaces/1/views/0/fields/DESCRIPTOR' },
        group: { displayName: 'Item Descriptor' },
        displayOrder: 0
      },
      {
        field: { __self__: '/api/v3/workspaces/1/views/0/fields/MISSING' },
        group: { displayName: 'Item Descriptor' },
        displayOrder: 1
      }
    ])
    expect(findMissingTableauColumnFieldIds(t, allowed)).toEqual(['MISSING'])
  })
})
