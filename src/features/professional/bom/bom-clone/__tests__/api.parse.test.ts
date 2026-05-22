import { describe, expect, it } from 'vitest'
import {
  applyMessageTemplate,
  assertMutationSuccess,
  extractBomMutationErrorMessage,
  extractValidationMessage,
  extractValidationMessageDeep,
  tryParseJson
} from '../services/api/parse'

describe('bom/api/parse', () => {
  it('applies indexed message templates and extracts direct validation messages', () => {
    expect(applyMessageTemplate('Field {0} failed at {1}', ['Quantity', 2])).toBe('Field Quantity failed at 2')
    expect(extractValidationMessage({
      message: 'Field {0} is required',
      arguments: ['Description']
    })).toBe('Field Description is required')
  })

  it('falls back to field titles when template messages are absent', () => {
    expect(extractValidationMessage({
      field: { title: 'Revision' }
    })).toBe('Revision: invalid value')
  })

  it('parses nested validation payloads deeply, including JSON strings', () => {
    expect(tryParseJson('{"message":"Bad value"}')).toEqual({ message: 'Bad value' })
    expect(tryParseJson('not-json')).toBeNull()

    expect(extractValidationMessageDeep({
      data: {
        validationErrors: [
          {
            message: 'Row {0} failed',
            arguments: ['A']
          }
        ]
      }
    })).toBe('Row A failed')

    expect(extractValidationMessageDeep('{"errors":[{"field":{"title":"Quantity"}}]}')).toBe('Quantity: invalid value')
  })

  it('extracts structured BOM mutation error messages before generic fallbacks', () => {
    expect(extractBomMutationErrorMessage({
      data: {
        errors: [
          {
            message: 'Cannot add {0}',
            arguments: ['Component']
          }
        ]
      },
      statusText: 'Bad Request'
    }, 'Fallback')).toBe('Cannot add Component')

    expect(extractBomMutationErrorMessage({
      message: 'Direct error',
      statusText: 'Bad Request'
    }, 'Fallback')).toBe('Direct error')
  })

  it('accepts successful mutation payloads and throws rich errors for failures', () => {
    expect(() => assertMutationSuccess('add', { status: 201 })).not.toThrow()

    expect(() => assertMutationSuccess('update', {
      status: 400,
      data: {
        errors: [
          {
            field: { title: 'Quantity' }
          }
        ]
      }
    })).toThrow('Quantity: invalid value')

    expect(() => assertMutationSuccess('remove', {
      status: 500,
      statusText: 'Server Error'
    })).toThrow('Server Error')
  })
})
