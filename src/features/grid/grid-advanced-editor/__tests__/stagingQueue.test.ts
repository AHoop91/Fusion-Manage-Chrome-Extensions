// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createStagingQueue } from '../services/stagingQueue'

describe('createStagingQueue', () => {
  it('stores updates defensively and returns cloned snapshots', () => {
    const queue = createStagingQueue()
    const payload = new Map([['name', 'Widget']])
    const display = new Map([['name', 'Widget Display']])

    queue.stage({
      kind: 'update',
      domRowIndex: 4,
      payload,
      display
    })

    payload.set('name', 'Mutated')
    display.set('name', 'Mutated Display')

    const staged = queue.getByDomRowIndex(4)
    expect(staged).toEqual({
      kind: 'update',
      domRowIndex: 4,
      payload: new Map([['name', 'Widget']]),
      display: new Map([['name', 'Widget Display']])
    })

    if (!staged || staged.kind !== 'update') {
      throw new Error('Expected update op')
    }

    staged.payload.set('name', 'Changed After Read')
    expect(queue.getByDomRowIndex(4)).toEqual({
      kind: 'update',
      domRowIndex: 4,
      payload: new Map([['name', 'Widget']]),
      display: new Map([['name', 'Widget Display']])
    })
  })

  it('replaces updates with removals and can unstage existing rows', () => {
    const queue = createStagingQueue()

    queue.stage({
      kind: 'update',
      domRowIndex: 2,
      payload: new Map([['part', 'A']]),
      display: new Map([['part', 'A']])
    })
    queue.stage({ kind: 'remove', domRowIndex: 2 })

    expect(queue.getByDomRowIndex(2)).toEqual({ kind: 'remove', domRowIndex: 2 })
    expect(queue.count()).toBe(1)

    queue.unstage(2)
    expect(queue.getByDomRowIndex(2)).toBeUndefined()
    expect(queue.count()).toBe(0)
  })

  it('tracks inserts independently and ignores invalid insert removals', () => {
    const queue = createStagingQueue()

    queue.stage({
      kind: 'insert',
      payload: new Map([['code', '001']]),
      display: new Map([['code', '001']]),
      source: 'add'
    })
    queue.stage({
      kind: 'insert',
      payload: new Map([['code', '002']]),
      display: new Map([['code', '002']]),
      source: 'clone'
    })

    queue.removeInsert(-1)
    queue.removeInsert(4)
    expect(queue.count()).toBe(2)

    queue.removeInsert(0)
    expect(queue.getAll()).toEqual([
      {
        kind: 'insert',
        payload: new Map([['code', '002']]),
        display: new Map([['code', '002']]),
        source: 'clone'
      }
    ])
  })

  it('clears every staged operation', () => {
    const queue = createStagingQueue()

    queue.stage({
      kind: 'update',
      domRowIndex: 1,
      payload: new Map([['name', 'Alpha']]),
      display: new Map([['name', 'Alpha']])
    })
    queue.stage({ kind: 'remove', domRowIndex: 3 })
    queue.stage({
      kind: 'insert',
      payload: new Map([['name', 'Beta']]),
      display: new Map([['name', 'Beta']]),
      source: 'add'
    })

    queue.clear()

    expect(queue.getAll()).toEqual([])
    expect(queue.count()).toBe(0)
    expect(queue.getUpdatePayloads().size).toBe(0)
    expect(queue.getUpdateDisplays().size).toBe(0)
    expect(queue.getRemovals().size).toBe(0)
    expect(queue.getInserts()).toEqual([])
  })
})
