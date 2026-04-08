import { describe, expect, it } from 'vitest'
import { compressToBase64, decompressFromBase64 } from '../../../shared/utils/export'

describe('compressToBase64 / decompressFromBase64', () => {
  it('round-trips a plain object', async () => {
    const data = { name: 'Test View', columns: [{ displayOrder: 0 }] }
    const encoded = await compressToBase64(data)
    expect(typeof encoded).toBe('string')
    expect(encoded.length).toBeGreaterThan(0)
    const decoded = await decompressFromBase64(encoded)
    expect(decoded).toEqual(data)
  })

  it('round-trips via the file format (JSON-wrapped base64)', async () => {
    const data = { name: 'Test View', columns: [{ displayOrder: 0 }] }
    // Simulate what downloadJson produces: JSON.stringify of the base64 string
    const fileContent = JSON.stringify(await compressToBase64(data))
    // Simulate what the importer does: JSON.parse then decompress
    const decoded = await decompressFromBase64(JSON.parse(fileContent) as string)
    expect(decoded).toEqual(data)
  })

  it('round-trips an array', async () => {
    const data = [{ name: 'A' }, { name: 'B' }]
    const decoded = await decompressFromBase64(await compressToBase64(data))
    expect(decoded).toEqual(data)
  })

  it('round-trips unicode strings', async () => {
    const data = { name: 'Vérité – naïve résumé 日本語 🎉' }
    const decoded = await decompressFromBase64(await compressToBase64(data))
    expect(decoded).toEqual(data)
  })

  it('produces a smaller output than raw JSON for repetitive data', async () => {
    const data = Array.from({ length: 50 }, (_, i) => ({
      field: { __self__: `/api/v3/workspaces/57/views/0/fields/FIELD_${i}` },
      displayOrder: i,
      group: { label: 'ITEM_DETAILS_FIELD', name: 'Item Details' }
    }))
    const encoded = await compressToBase64(data)
    const rawJson = JSON.stringify(data)
    expect(encoded.length).toBeLessThan(rawJson.length)
  })
})
