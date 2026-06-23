// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  derivativeOutputsForSourceExtension,
  extractFormatsMatrix,
  normalizeExtensionToken
} from '../components.formats.catalog'

describe('extractFormatsMatrix', () => {
  it('reads nested formats object', () => {
    const matrix = extractFormatsMatrix({
      formats: {
        stl: ['f3d', 'dwg'],
        thumbnail: ['f3d']
      }
    })
    expect(matrix?.stl).toContain('f3d')
    expect(matrix?.thumbnail).toContain('f3d')
  })
})

describe('derivativeOutputsForSourceExtension', () => {
  const matrix = {
    stl: ['ipt', 'f3d'],
    pdf: ['dwg'],
    thumbnail: ['f3d']
  }

  it('selects outputs whose source-extension lists include the design extension', () => {
    const out = derivativeOutputsForSourceExtension(matrix, 'f3d')
    expect(out).toContain('stl')
    expect(out).toContain('thumbnail')
    expect(out).not.toContain('pdf')
  })

  it('normalizes extension tokens', () => {
    expect(normalizeExtensionToken('.F3D')).toBe('f3d')
  })
})

describe('derivativeOutputsForSourceExtension — fbx/svf/svf2 catalog keys', () => {
  const matrix = {
    fbx:  ['f3d'],
    svf:  ['f3d', 'ipt'],
    svf2: ['f3d', 'ipt'],
    stl:  ['f3d']
  }

  it('returns fbx when catalog key fbx lists the source extension', () => {
    const out = derivativeOutputsForSourceExtension(matrix, 'f3d')
    expect(out).toContain('fbx')
  })

  it('returns svf when catalog key svf lists the source extension', () => {
    const out = derivativeOutputsForSourceExtension(matrix, 'f3d')
    expect(out).toContain('svf')
  })

  it('returns svf2 when catalog key svf2 lists the source extension', () => {
    const out = derivativeOutputsForSourceExtension(matrix, 'f3d')
    expect(out).toContain('svf2')
  })

  it('orders formats: fbx before svf before svf2 before thumbnail', () => {
    const matrixWithAll = {
      fbx:       ['f3d'],
      svf:       ['f3d'],
      svf2:      ['f3d'],
      thumbnail: ['f3d']
    }
    const out = derivativeOutputsForSourceExtension(matrixWithAll, 'f3d')
    expect(out.indexOf('fbx')).toBeLessThan(out.indexOf('svf'))
    expect(out.indexOf('svf')).toBeLessThan(out.indexOf('svf2'))
    expect(out.indexOf('svf2')).toBeLessThan(out.indexOf('thumbnail'))
  })
})
