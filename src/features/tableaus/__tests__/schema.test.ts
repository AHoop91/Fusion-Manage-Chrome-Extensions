import { describe, expect, it } from 'vitest'
import { parseTableauExport, extractWsIdFromSelf, ValidationError } from '../services/schema'

const VALID: unknown = {
  __self__: '/api/v3/workspaces/57/tableaus/544',
  name: 'My View',
  columns: [
    {
      field: { __self__: '/api/v3/workspaces/57/views/1/fields/IMAGE' },
      displayOrder: 0
    }
  ]
}

describe('tableaus/schema - parseTableauExport', () => {
  it('accepts a valid export', () => {
    const result = parseTableauExport(VALID)
    expect(result.name).toBe('My View')
    expect(result.columns).toHaveLength(1)
  })

  it('throws ValidationError for non-object', () => {
    expect(() => parseTableauExport('string')).toThrow(ValidationError)
    expect(() => parseTableauExport(null)).toThrow(ValidationError)
    expect(() => parseTableauExport([1, 2])).toThrow(ValidationError)
  })

  it('throws ValidationError for missing __self__', () => {
    expect(() => parseTableauExport({ ...VALID as object, __self__: undefined })).toThrow(ValidationError)
  })

  it('throws ValidationError for __self__ not matching tableau path', () => {
    expect(() => parseTableauExport({ ...VALID as object, __self__: '/api/v3/workspaces/57/items/1' })).toThrow(ValidationError)
  })

  it('throws ValidationError for missing name', () => {
    expect(() => parseTableauExport({ ...VALID as object, name: '' })).toThrow(ValidationError)
    expect(() => parseTableauExport({ ...VALID as object, name: undefined })).toThrow(ValidationError)
  })

  it('throws ValidationError for empty columns array', () => {
    expect(() => parseTableauExport({ ...VALID as object, columns: [] })).toThrow(ValidationError)
  })

  it('throws ValidationError for non-array columns', () => {
    expect(() => parseTableauExport({ ...VALID as object, columns: 'bad' })).toThrow(ValidationError)
  })

  it('throws ValidationError for column missing field.__self__', () => {
    const bad = {
      ...VALID as object,
      columns: [{ field: { __self__: '' }, displayOrder: 0 }]
    }
    expect(() => parseTableauExport(bad)).toThrow(ValidationError)
  })

  it('throws ValidationError for column missing displayOrder', () => {
    const bad = {
      ...VALID as object,
      columns: [{ field: { __self__: '/api/v3/workspaces/57/views/1/fields/X' }, displayOrder: 'bad' }]
    }
    expect(() => parseTableauExport(bad)).toThrow(ValidationError)
  })

  it('accepts title in place of name and normalises to name', () => {
    const withTitle = { ...VALID as object, name: undefined, title: 'From API' }
    const result = parseTableauExport(withTitle)
    expect(result.name).toBe('From API')
  })

  it('does not mutate the original input object', () => {
    const input = { ...VALID as object, name: undefined, title: 'From API' } as Record<string, unknown>
    parseTableauExport(input)
    expect(input.name).toBeUndefined()
  })

  it('includes a descriptive message in the error', () => {
    try {
      parseTableauExport({ ...VALID as object, name: '' })
    } catch (err) {
      expect((err as Error).message).toMatch(/name/)
    }
  })
})

describe('tableaus/schema - extractWsIdFromSelf', () => {
  it('extracts workspace ID from __self__', () => {
    expect(extractWsIdFromSelf('/api/v3/workspaces/57/tableaus/544')).toBe('57')
  })

  it('returns null for non-matching string', () => {
    expect(extractWsIdFromSelf('/api/v3/workspaces/57/items/1')).toBeNull()
    expect(extractWsIdFromSelf('')).toBeNull()
  })
})
