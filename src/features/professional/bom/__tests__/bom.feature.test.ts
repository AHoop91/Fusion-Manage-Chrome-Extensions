import { describe, expect, it, vi } from 'vitest'
import { createBomPageModule } from '../bom.feature'

describe('bom feature', () => {
  it('matches supported BOM view routes only', () => {
    const isFusionHost = vi.fn((url: string) => url.includes('test.autodeskplm360.net'))
    const module = createBomPageModule({
      isFusionHost,
      requestPlmAction: vi.fn(),
      openModal: vi.fn(),
      closeModal: vi.fn(),
      findByIdDeep: vi.fn()
    })

    expect(module.matches('https://test.autodeskplm360.net/plm/workspaces/57/items/bom/nested?tab=bom&mode=view&view=full')).toBe(true)
    expect(module.matches('https://test.autodeskplm360.net/plm/workspaces/57/items/bom/nested?tab=bom&mode=view&view=split')).toBe(true)
    expect(module.matches('https://test.autodeskplm360.net/plm/workspaces/57/items/bom/nested?tab=bom&mode=edit&view=full')).toBe(false)
    expect(module.matches('https://test.autodeskplm360.net/plm/workspaces/57/items/bom/nested?tab=details&mode=view&view=full')).toBe(false)
    expect(module.matches('https://other.example/plm/workspaces/57/items/bom/nested?tab=bom&mode=view&view=full')).toBe(false)
    expect(module.matches('not-a-url')).toBe(false)
  })
})
