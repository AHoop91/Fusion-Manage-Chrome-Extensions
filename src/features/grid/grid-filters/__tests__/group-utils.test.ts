import { describe, expect, it } from 'vitest'
import {
  cloneGroups,
  getActiveConditions,
  getActiveGroups,
  removeConditionFromGroups,
  sanitizeMode,
  serializeGroups
} from '../groupUtils'
import type { ColumnFilterGroup } from '../model'

function createGroup(): ColumnFilterGroup[] {
  return [
    {
      id: 'group-1',
      columnKey: 'description',
      mode: 'or',
      conditions: [
        { id: 'c1', operator: 'contains', value: ' Alpha ', valueTo: '' },
        { id: 'c2', operator: 'between', value: '10', valueTo: '20' },
        { id: 'c3', operator: 'contains', value: '   ', valueTo: '' }
      ]
    },
    {
      id: 'group-2',
      columnKey: 'status',
      mode: 'and',
      conditions: [
        { id: 'c4', operator: 'is_empty', value: '', valueTo: '' }
      ]
    }
  ]
}

describe('grid filters/groupUtils', () => {
  it('clones groups deeply so mutations do not leak back', () => {
    const original = createGroup()
    const cloned = cloneGroups(original)

    cloned[0].conditions[0].value = 'Changed'

    expect(original[0].conditions[0].value).toBe(' Alpha ')
    expect(cloned).not.toBe(original)
  })

  it('sanitizes join mode and resolves active conditions/groups', () => {
    expect(sanitizeMode('and')).toBe('and')
    expect(sanitizeMode('unexpected')).toBe('or')

    const groups = createGroup()
    expect(getActiveConditions(groups[0]).map((condition) => condition.id)).toEqual(['c1', 'c2'])
    expect(getActiveGroups(groups).map((group) => group.id)).toEqual(['group-1', 'group-2'])
  })

  it('serializes groups with normalized values', () => {
    const serialized = serializeGroups(createGroup())
    expect(serialized).toContain('"columnKey":"description"')
    expect(serialized).toContain('"value":"alpha"')
    expect(serialized).toContain('"valueTo":"20"')
  })

  it('removes conditions and drops empty groups', () => {
    const next = removeConditionFromGroups(createGroup(), 'group-2', 'c4')
    expect(next.map((group) => group.id)).toEqual(['group-1'])
    expect(next[0].conditions.map((condition) => condition.id)).toEqual(['c1', 'c2', 'c3'])
  })
})
