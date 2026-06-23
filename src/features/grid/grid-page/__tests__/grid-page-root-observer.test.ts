// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

describe('grid-page-root-observer', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('notifies all subscribers from one shared MutationObserver', async () => {
    vi.resetModules()
    const observe = vi.fn()
    const disconnect = vi.fn()
    const callbacks: Array<() => void> = []
    vi.stubGlobal('document', { documentElement: {} })
    vi.stubGlobal(
      'MutationObserver',
      vi.fn(function MutationObserver(this: MutationObserver, callback: () => void) {
        callbacks.push(callback)
        this.observe = observe
        this.disconnect = disconnect
      })
    )

    const { subscribeGridPageRootObserver: subscribe } = await import('../grid-page-root-observer')

    const first = vi.fn()
    const second = vi.fn()
    const unsubscribeFirst = subscribe(first)
    const unsubscribeSecond = subscribe(second)

    expect(observe).toHaveBeenCalledTimes(1)
    expect(callbacks).toHaveLength(1)

    callbacks[0]?.()
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)

    unsubscribeFirst()
    expect(disconnect).not.toHaveBeenCalled()

    second.mockClear()
    callbacks[0]?.()
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).toHaveBeenCalledTimes(1)

    unsubscribeSecond()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it('still notifies later subscribers when an earlier subscriber throws', async () => {
    vi.resetModules()
    const callbacks: Array<() => void> = []
    vi.stubGlobal('document', { documentElement: {} })
    vi.stubGlobal(
      'MutationObserver',
      vi.fn(function MutationObserver(this: MutationObserver, callback: () => void) {
        callbacks.push(callback)
        this.observe = vi.fn()
        this.disconnect = vi.fn()
      })
    )

    const { subscribeGridPageRootObserver: subscribe } = await import('../grid-page-root-observer')

    const second = vi.fn()
    subscribe(() => {
      throw new Error('subscriber failed')
    })
    subscribe(second)

    callbacks[0]?.()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
