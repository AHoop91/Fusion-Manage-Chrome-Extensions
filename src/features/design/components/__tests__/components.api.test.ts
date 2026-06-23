// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  fetchDesignItemFromGraphQL,
  resolveModelIdForItem,
  resolveTranslationSources
} from '../components.api'
import type { DesignComponentsRuntime } from '../components.types'

function makeRuntime(responses: Record<string, unknown>): DesignComponentsRuntime {
  return {
    requestPlmAction: vi.fn(async (action: string) => {
      if (action in responses) return responses[action]
      throw new Error(`Unexpected action: ${action}`)
    }) as DesignComponentsRuntime['requestPlmAction']
  }
}

const FAKE_URL =
  'https://test.autodeskplm360.net/plm/workspaces/57/items/itemDetails?view=full&tab=details&mode=view&itemId=57%2C15535'

describe('resolveModelIdForItem', () => {
  it('extracts modelId from the item API response', async () => {
    const runtime = makeRuntime({
      fetchApiJson: { id: 15535, modelId: 'model-abc-123' }
    })
    const modelId = await resolveModelIdForItem(runtime, FAKE_URL)
    expect(modelId).toBe('model-abc-123')
  })

  it('throws when modelId is absent from the response', async () => {
    const runtime = makeRuntime({ fetchApiJson: { id: 15535 } })
    await expect(resolveModelIdForItem(runtime, FAKE_URL)).rejects.toThrow('modelId')
  })
})

describe('fetchDesignItemFromGraphQL', () => {
  it('returns designItem from a successful GraphQL response', async () => {
    const gqlResponse = {
      data: {
        model: {
          id: 'model-abc-123',
          designItem: {
            id: 'item-xyz',
            name: 'Reciprocating Saw',
            extensionType: 'f3d',
            mimeType: 'application/vnd.autodesk.fusion360',
            size: '8424819',
            fusionWebUrl: 'https://fusion.autodesk.com/x'
          }
        }
      }
    }
    const runtime = makeRuntime({ fetchMfgGraphQL: gqlResponse })
    const details = await fetchDesignItemFromGraphQL(runtime, 'model-abc-123')
    expect(details.extensionType).toBe('f3d')
    expect(details.name).toBe('Reciprocating Saw')
    expect(details.size).toBe('8424819')
  })

  it('falls back extensionType to f3d when absent', async () => {
    const gqlResponse = {
      data: {
        model: {
          id: 'model-abc-123',
          designItem: {
            id: 'item-xyz',
            name: 'Unknown Design',
            extensionType: null,
            mimeType: '',
            size: '0',
            fusionWebUrl: ''
          }
        }
      }
    }
    const runtime = makeRuntime({ fetchMfgGraphQL: gqlResponse })
    const details = await fetchDesignItemFromGraphQL(runtime, 'model-abc-123')
    expect(details.extensionType).toBe('f3d')
  })

  it('throws when model is missing from response', async () => {
    const runtime = makeRuntime({ fetchMfgGraphQL: { data: { model: null } } })
    await expect(fetchDesignItemFromGraphQL(runtime, 'model-abc-123')).rejects.toThrow()
  })
})

describe('resolveTranslationSources', () => {
  it('returns designDetails and formatOptions after successful chain', async () => {
    const runtime = makeRuntime({
      fetchApiJson: { id: 15535, modelId: 'model-abc-123' },
      fetchMfgGraphQL: {
        data: {
          model: {
            id: 'model-abc-123',
            designItem: {
              id: 'di-1',
              name: 'Saw',
              extensionType: 'f3d',
              mimeType: 'application/vnd.autodesk.fusion360',
              size: '1000000',
              fusionWebUrl: ''
            }
          }
        }
      },
      getModelDerivativeFormats: {
        formats: {
          step: ['f3d'],
          fbx:  ['f3d'],
          svf:  ['f3d'],
          svf2: ['f3d'],
          thumbnail: ['f3d']
        }
      }
    })

    const result = await resolveTranslationSources(runtime, FAKE_URL)
    expect(result.designDetails.name).toBe('Saw')
    expect(result.designDetails.extensionType).toBe('f3d')
    expect(result.formatOptions.map((o) => o.value)).toContain('step')
    expect(result.formatOptions.map((o) => o.value)).toContain('fbx')
    expect(result.formatOptions.map((o) => o.value)).toContain('svf')
  })
})
