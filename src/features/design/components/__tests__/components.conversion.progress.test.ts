// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { estimatedPollRatio, parseManifestProgressRatio } from '../components.conversion.progress'

describe('parseManifestProgressRatio', () => {
  it('parses percent strings', () => {
    expect(parseManifestProgressRatio('45% complete')).toBeCloseTo(0.45)
  })

  it('parses numeric 0–1 and 0–100', () => {
    expect(parseManifestProgressRatio(0.5)).toBe(0.5)
    expect(parseManifestProgressRatio(50)).toBe(0.5)
  })
})

describe('estimatedPollRatio', () => {
  it('stays below 1', () => {
    expect(estimatedPollRatio(100, 100)).toBeLessThanOrEqual(0.92)
  })
})
