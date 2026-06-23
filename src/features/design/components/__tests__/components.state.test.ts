// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { toConversionState } from '../components.state'

describe('toConversionState', () => {
  it('uses default message for known state', () => {
    expect(toConversionState('submitting')).toEqual({
      state: 'submitting',
      message: 'Submitting translation job…'
    })
  })

  it('uses override message when provided', () => {
    expect(toConversionState('error', 'Model Derivative rejected the job.')).toEqual({
      state: 'error',
      message: 'Model Derivative rejected the job.'
    })
  })
})
