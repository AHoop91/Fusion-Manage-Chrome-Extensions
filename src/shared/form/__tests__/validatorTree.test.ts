// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  hasExtendedRequiredValidator,
  hasRequiredValidator,
  isRequiredLikeValidatorName,
  normalizeValidatorName
} from '../validatorTree'

describe('validatorTree', () => {
  it('normalizes validator names', () => {
    expect(normalizeValidatorName(' Required ')).toBe('required')
    expect(isRequiredLikeValidatorName('dropdown-selection')).toBe(true)
  })

  it('detects strict required validators recursively', () => {
    expect(hasRequiredValidator({ validators: [{ name: 'required' }] })).toBe(true)
    expect(hasRequiredValidator({ validators: [{ name: 'missing' }] })).toBe(false)
  })

  it('detects extended required validators for grid import', () => {
    expect(hasExtendedRequiredValidator({ validators: [{ validatorName: 'missing' }] })).toBe(true)
  })
})
