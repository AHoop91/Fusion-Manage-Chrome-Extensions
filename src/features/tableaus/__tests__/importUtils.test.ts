import { describe, expect, it } from 'vitest'
import { resolveUniqueName, stripDefaults, stripFieldObject, stripColumn } from '../view/import/importDialog'

// ---------------------------------------------------------------------------
// resolveUniqueName
// ---------------------------------------------------------------------------

describe('resolveUniqueName', () => {
  it('returns base name when not taken', () => {
    const existing = new Set<string>()
    const reserved = new Set<string>()
    expect(resolveUniqueName('All', existing, reserved)).toBe('All')
  })

  it('appends (1) when base name is taken', () => {
    const existing = new Set(['all'])
    const reserved = new Set<string>()
    expect(resolveUniqueName('All', existing, reserved)).toBe('All (1)')
  })

  it('increments to next available number', () => {
    const existing = new Set(['all', 'all (1)', 'all (2)'])
    const reserved = new Set<string>()
    expect(resolveUniqueName('All', existing, reserved)).toBe('All (3)')
  })

  it('strips existing trailing (N) before incrementing', () => {
    const existing = new Set(['all (1)'])
    const reserved = new Set<string>()
    expect(resolveUniqueName('All (1)', existing, reserved)).toBe('All (2)')
  })

  it('respects reserved names for intra-batch collisions', () => {
    const existing = new Set<string>()
    const reserved = new Set(['all'])
    expect(resolveUniqueName('All', existing, reserved)).toBe('All (1)')
  })

  it('respects both existing and reserved simultaneously', () => {
    const existing = new Set(['all'])
    const reserved = new Set(['all (1)'])
    expect(resolveUniqueName('All', existing, reserved)).toBe('All (2)')
  })

  it('is case-insensitive for matching', () => {
    const existing = new Set(['my view'])
    const reserved = new Set<string>()
    expect(resolveUniqueName('My View', existing, reserved)).toBe('My View (1)')
  })
})

// ---------------------------------------------------------------------------
// stripFieldObject
// ---------------------------------------------------------------------------

describe('stripFieldObject', () => {
  it('removes computed read-only properties', () => {
    const field = {
      __self__: '/api/v3/workspaces/57/views/0/fields/X',
      urn: 'urn:adsk.plm:...',
      title: 'My Field',
      value: null,
      uomConverted: 'pounds',
      formulaField: true,
      defaultValue: '',
      isSystemField: true
    }
    const result = stripFieldObject(field) as Record<string, unknown>
    expect(result.value).toBeUndefined()
    expect(result.uomConverted).toBeUndefined()
    expect(result.formulaField).toBeUndefined()
    expect(result.defaultValue).toBeUndefined()
    expect(result.__self__).toBe(field.__self__)
    expect(result.isSystemField).toBe(true)
  })

  it('reduces type to link reference only', () => {
    const field = {
      __self__: '/api/v3/workspaces/57/views/0/fields/X',
      type: { link: '/api/v3/field-types/4', urn: 'urn:...', title: 'Alpha Numeric', deleted: false }
    }
    const result = stripFieldObject(field) as Record<string, unknown>
    expect(result.type).toEqual({ link: '/api/v3/field-types/4' })
  })

  it('passes through non-objects unchanged', () => {
    expect(stripFieldObject(null)).toBeNull()
    expect(stripFieldObject('string')).toBe('string')
    expect(stripFieldObject([1, 2])).toEqual([1, 2])
  })
})

// ---------------------------------------------------------------------------
// stripColumn
// ---------------------------------------------------------------------------

describe('stripColumn', () => {
  const col = {
    field: {
      __self__: '/api/v3/workspaces/57/views/0/fields/DESCRIPTOR',
      value: null,
      formulaField: false,
      type: { link: '/api/v3/field-types/4', urn: 'urn:...', title: 'Alpha', deleted: false }
    },
    group: { label: 'ITEM_DESCRIPTOR_FIELD', name: 'Item Descriptor' },
    allowMultipleFilters: true,
    displayOrder: 2,
    sort: { order: 0, direction: 'ASCENDING' },
    appliedFilters: { matchRule: 'ALL', filters: [] },
    visible: false,
    originalElement: {}
  }

  it('removes appliedFilters', () => {
    const result = stripColumn(col) as Record<string, unknown>
    expect(result.appliedFilters).toBeUndefined()
  })

  it('sets visible to true', () => {
    const result = stripColumn(col) as Record<string, unknown>
    expect(result.visible).toBe(true)
  })

  it('preserves displayOrder and sort', () => {
    const result = stripColumn(col) as Record<string, unknown>
    expect(result.displayOrder).toBe(2)
    expect(result.sort).toEqual({ order: 0, direction: 'ASCENDING' })
  })

  it('adds originalElement as a copy of cleaned base', () => {
    const result = stripColumn(col) as Record<string, unknown>
    expect(result.originalElement).toBeDefined()
    const orig = result.originalElement as Record<string, unknown>
    expect(orig.displayOrder).toBeUndefined()
    expect(orig.appliedFilters).toBeUndefined()
  })

  it('strips computed fields from nested field object', () => {
    const result = stripColumn(col) as Record<string, unknown>
    const field = (result.field as Record<string, unknown>)
    expect(field.value).toBeUndefined()
    expect(field.formulaField).toBeUndefined()
    expect(field.type).toEqual({ link: '/api/v3/field-types/4' })
  })
})

// ---------------------------------------------------------------------------
// stripDefaults
// ---------------------------------------------------------------------------

describe('stripDefaults', () => {
  it('removes showOnlyDeletedRecords when false', () => {
    const result = stripDefaults({ name: 'X', showOnlyDeletedRecords: false })
    expect(result.showOnlyDeletedRecords).toBeUndefined()
  })

  it('keeps showOnlyDeletedRecords when true', () => {
    const result = stripDefaults({ name: 'X', showOnlyDeletedRecords: true })
    expect(result.showOnlyDeletedRecords).toBe(true)
  })

  it('removes description when empty string', () => {
    const result = stripDefaults({ name: 'X', description: '' })
    expect(result.description).toBeUndefined()
  })

  it('keeps description when non-empty', () => {
    const result = stripDefaults({ name: 'X', description: 'My desc' })
    expect(result.description).toBe('My desc')
  })

  it('preserves isDefault regardless of value', () => {
    expect(stripDefaults({ isDefault: false }).isDefault).toBe(false)
    expect(stripDefaults({ isDefault: true }).isDefault).toBe(true)
  })

  it('preserves workspace', () => {
    const ws = { __self__: '/api/v3/workspaces/57' }
    expect(stripDefaults({ workspace: ws }).workspace).toEqual(ws)
  })

  it('applies stripColumn to each column', () => {
    const col = {
      field: { __self__: '/api/v3/workspaces/57/views/0/fields/X', value: null },
      displayOrder: 0,
      appliedFilters: { matchRule: 'ALL', filters: [] }
    }
    const result = stripDefaults({ columns: [col] })
    const resultCol = (result.columns as Record<string, unknown>[])[0]!
    expect(resultCol.appliedFilters).toBeUndefined()
    expect(resultCol.visible).toBe(true)
  })
})
