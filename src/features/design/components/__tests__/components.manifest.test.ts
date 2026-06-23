// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { findDerivativeForFormat, isManifestSuccess, isManifestTerminal } from '../components.manifest'
import type { ConversionJobManifest } from '../components.types'

describe('findDerivativeForFormat', () => {
  it('finds a step derivative by outputType (APS file export structure)', () => {
    const manifest = {
      status: 'success',
      derivatives: [
        {
          outputType: 'step',
          status: 'success',
          children: [
            {
              type: 'resource',
              status: 'success',
              role: 'exportedFile',
              urn: 'urn:adsk.forge:derivative:1'
            }
          ]
        }
      ]
    } as ConversionJobManifest

    const hit = findDerivativeForFormat(manifest, 'step')
    expect(hit?.urn).toBe('urn:adsk.forge:derivative:1')
  })

  it('returns null when step derivative outputType does not match', () => {
    const manifest = {
      status: 'success',
      derivatives: [
        {
          outputType: 'obj',
          status: 'success',
          children: [
            {
              type: 'resource',
              status: 'success',
              role: 'exportedFile',
              urn: 'urn:adsk.forge:derivative:2'
            }
          ]
        }
      ]
    } as ConversionJobManifest

    expect(findDerivativeForFormat(manifest, 'step')).toBeNull()
  })

  it('finds thumbnail derivative by role', () => {
    const manifest = {
      status: 'success',
      derivatives: [
        {
          outputType: 'thumbnail',
          status: 'success',
          children: [
            {
              type: 'resource',
              status: 'success',
              role: 'thumbnail',
              mime: 'image/png',
              urn: 'urn:adsk.viewing:scfs.file:x/output/t.png'
            }
          ]
        }
      ]
    } as ConversionJobManifest

    expect(findDerivativeForFormat(manifest, 'thumbnail')?.urn).toContain('urn:')
  })

  it('does not find thumbnail when no derivative has outputType thumbnail', () => {
    const manifest = {
      status: 'success',
      derivatives: [
        {
          outputType: 'step',
          status: 'success',
          children: [
            {
              type: 'resource',
              status: 'success',
              role: 'exportedFile',
              mime: 'image/png',
              urn: 'urn:adsk.viewing:scfs.file:x/output/other.png'
            }
          ]
        }
      ]
    } as ConversionJobManifest

    expect(findDerivativeForFormat(manifest, 'thumbnail')).toBeNull()
  })
})

describe('findDerivativeForFormat — new format types', () => {
  it('finds fbx derivative by outputType', () => {
    const manifest = {
      status: 'success',
      derivatives: [{
        outputType: 'fbx',
        status: 'success',
        children: [{
          type: 'resource',
          status: 'success',
          role: 'exportedFile',
          urn: 'urn:adsk.forge:derivative:fbx-1'
        }]
      }]
    } as ConversionJobManifest
    expect(findDerivativeForFormat(manifest, 'fbx')?.urn).toBe('urn:adsk.forge:derivative:fbx-1')
  })

  it('finds svf derivative by svf role', () => {
    const manifest = {
      status: 'success',
      derivatives: [{
        children: [{
          type: 'resource',
          status: 'success',
          role: 'svf',
          urn: 'urn:adsk.forge:derivative:svf-1'
        }]
      }]
    } as ConversionJobManifest
    expect(findDerivativeForFormat(manifest, 'svf')?.urn).toBe('urn:adsk.forge:derivative:svf-1')
  })

  it('finds svf2 derivative by svf2 role', () => {
    const manifest = {
      status: 'success',
      derivatives: [{
        children: [{
          type: 'resource',
          status: 'success',
          role: 'svf2',
          urn: 'urn:adsk.forge:derivative:svf2-1'
        }]
      }]
    } as ConversionJobManifest
    expect(findDerivativeForFormat(manifest, 'svf2')?.urn).toBe('urn:adsk.forge:derivative:svf2-1')
  })
})

describe('manifest status helpers', () => {
  it('isManifestTerminal is true for terminal APS statuses', () => {
    expect(isManifestTerminal({ status: 'success' })).toBe(true)
    expect(isManifestTerminal({ status: 'FAILED' })).toBe(true)
    expect(isManifestTerminal({ status: 'timeout' })).toBe(true)
    expect(isManifestTerminal({ status: 'pending' })).toBe(false)
  })

  it('isManifestSuccess matches success only', () => {
    expect(isManifestSuccess({ status: 'success' })).toBe(true)
    expect(isManifestSuccess({ status: 'failed' })).toBe(false)
  })
})
