import { describe, expect, it, vi } from 'vitest'

import { createSecurityController } from '../controller'

describe('security controller', () => {
  it('matches supported security routes only on Fusion hosts', () => {
    const controller = createSecurityController({
      isFusionHost: vi.fn((url: string) => url.includes('tenant.example'))
    })

    expect(controller.matches('https://tenant.example/plm/admin')).toBe(true)
    expect(controller.matches('https://tenant.example/plm/workspaces/57/items/123?tab=users')).toBe(true)
    expect(controller.matches('https://tenant.example/plm/workspaces/57/items/123?tab=groups')).toBe(true)
    expect(controller.matches('https://tenant.example/plm/workspaces/57/items/123?tab=roles')).toBe(true)
    expect(controller.matches('https://tenant.example/plm/workspaces/57/items/123?tab=details')).toBe(false)
    expect(controller.matches('https://other.example/plm/admin')).toBe(false)
    expect(controller.matches('not-a-url')).toBe(false)
  })
})
