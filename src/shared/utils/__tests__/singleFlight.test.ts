// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { runSingleFlight } from '../singleFlight'

describe('runSingleFlight', () => {
  it('deduplicates concurrent calls for the same key', async () => {
    const cache = new Map<string, Promise<number>>()
    const factory = vi.fn(async () => 42)

    const [first, second] = await Promise.all([
      runSingleFlight(cache, 'a', factory),
      runSingleFlight(cache, 'a', factory)
    ])

    expect(first).toBe(42)
    expect(second).toBe(42)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(cache.size).toBe(0)
  })
})
