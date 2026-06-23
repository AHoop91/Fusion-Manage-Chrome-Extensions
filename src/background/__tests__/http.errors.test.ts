// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { formatPlmErrorsArrayMessage } from '../httpErrors'

describe('formatPlmErrorsArrayMessage', () => {
  it('interpolates Fusion Manage errors array before generic HTTP message', () => {
    const body = {
      statusCode: 400,
      message: 'HTTP 400 Bad Request',
      errors: [
        {
          message: '{0} cannot have duplicates',
          code: 'error.unique',
          arguments: ['ID', 'ID'],
          field: { value: '10', isSystemField: false }
        }
      ]
    }
    expect(formatPlmErrorsArrayMessage(body)).toBe('ID cannot have duplicates')
  })

  it('joins multiple errors', () => {
    const body = {
      errors: [
        { message: '{0} is invalid', arguments: ['A'] },
        { message: '{0} is invalid', arguments: ['B'] }
      ]
    }
    expect(formatPlmErrorsArrayMessage(body)).toBe('A is invalid; B is invalid')
  })

  it('returns null when no errors array', () => {
    expect(formatPlmErrorsArrayMessage({ message: 'HTTP 400 Bad Request' })).toBe(null)
  })
})
