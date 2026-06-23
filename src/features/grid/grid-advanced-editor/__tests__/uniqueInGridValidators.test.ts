// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  collectUniqueInGridFieldIdsFromFieldDefinitions,
  collectUniqueInGridFieldIdsFromValidatorsPayload
} from '../services/uniqueInGridValidators'

describe('uniqueInGrid validators', () => {
  it('collects field id from uniqueInGrid validator variables (fieldid casing)', () => {
    const payload = [
      {
        validatorName: 'uniqueInGrid',
        variables: { fieldid: 'ID' }
      }
    ]
    expect(collectUniqueInGridFieldIdsFromValidatorsPayload(payload)).toEqual(['ID'])
  })

  it('walks nested validators arrays', () => {
    const payload = {
      validators: [{ validatorName: 'uniqueInGrid', variables: { fieldId: 'CODE' } }]
    }
    expect(collectUniqueInGridFieldIdsFromValidatorsPayload(payload)).toEqual(['CODE'])
  })

  it('dedupes definitions across fields', () => {
    const defs = [
      { fieldValidators: { validatorName: 'uniqueInGrid', variables: { fieldId: 'A' } } },
      { fieldValidators: { validatorName: 'uniqueInGrid', variables: { fieldId: 'a' } } }
    ]
    expect(collectUniqueInGridFieldIdsFromFieldDefinitions(defs)).toEqual(['A'])
  })
})
