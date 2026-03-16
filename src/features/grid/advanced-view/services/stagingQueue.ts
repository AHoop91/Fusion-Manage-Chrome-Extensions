/**
 * Staged grid operation model used by the advanced editor before commit.
 */
export type StagedOp =
  | { kind: 'update'; domRowIndex: number; payload: Map<string, string>; display: Map<string, string> }
  | { kind: 'remove'; domRowIndex: number }
  | { kind: 'insert'; payload: Map<string, string>; display: Map<string, string>; source: 'add' | 'clone' }

/**
 * Mutable queue contract for staged add/update/remove operations.
 */
export interface StagingQueue {
  /**
   * Adds or replaces a staged operation.
   */
  stage: (op: StagedOp) => void
  /**
   * Clears staged operations for a specific existing row.
   */
  unstage: (domRowIndex: number) => void
  /**
   * Removes a staged insert operation by index.
   */
  removeInsert: (insertIndex: number) => void
  /**
   * Returns all staged operations.
   */
  getAll: () => StagedOp[]
  /**
   * Returns staged operation for an existing row.
   */
  getByDomRowIndex: (index: number) => StagedOp | undefined
  /**
   * Returns total number of staged operations.
   */
  count: () => number
  /**
   * Clears all staged operations.
   */
  clear: () => void
}

/**
 * Extended queue API exposed to controller internals for efficient lookups.
 */
export interface InternalStagingQueue extends StagingQueue {
  /**
   * Returns staged update payload map by row index.
   */
  getUpdatePayloads: () => Map<number, Map<string, string>>
  /**
   * Returns staged update display map by row index.
   */
  getUpdateDisplays: () => Map<number, Map<string, string>>
  /**
   * Returns staged removals by row index.
   */
  getRemovals: () => Set<number>
  /**
   * Returns staged inserts list.
   */
  getInserts: () => Array<{ payload: Map<string, string>; display: Map<string, string>; source: 'add' | 'clone' }>
}

/**
 * Creates staging queue instance for modal edit session state.
 */
export function createStagingQueue(): InternalStagingQueue {
  const updatesPayloadByRow = new Map<number, Map<string, string>>()
  const updatesDisplayByRow = new Map<number, Map<string, string>>()
  const removals = new Set<number>()
  const inserts: Array<{ payload: Map<string, string>; display: Map<string, string>; source: 'add' | 'clone' }> = []

  function stage(op: StagedOp): void {
    if (op.kind === 'update') {
      updatesPayloadByRow.set(op.domRowIndex, new Map(op.payload))
      updatesDisplayByRow.set(op.domRowIndex, new Map(op.display))
      removals.delete(op.domRowIndex)
      return
    }
    if (op.kind === 'remove') {
      removals.add(op.domRowIndex)
      updatesPayloadByRow.delete(op.domRowIndex)
      updatesDisplayByRow.delete(op.domRowIndex)
      return
    }
    inserts.push({
      payload: new Map(op.payload),
      display: new Map(op.display),
      source: op.source
    })
  }

  function unstage(domRowIndex: number): void {
    updatesPayloadByRow.delete(domRowIndex)
    updatesDisplayByRow.delete(domRowIndex)
    removals.delete(domRowIndex)
  }

  function removeInsert(insertIndex: number): void {
    if (insertIndex < 0 || insertIndex >= inserts.length) return
    inserts.splice(insertIndex, 1)
  }

  function getAll(): StagedOp[] {
    const operations: StagedOp[] = []
    for (const [domRowIndex, payload] of updatesPayloadByRow.entries()) {
      operations.push({
        kind: 'update',
        domRowIndex,
        payload: new Map(payload),
        display: new Map(updatesDisplayByRow.get(domRowIndex) || [])
      })
    }
    for (const domRowIndex of removals.values()) {
      operations.push({ kind: 'remove', domRowIndex })
    }
    for (const insert of inserts) {
      operations.push({
        kind: 'insert',
        payload: new Map(insert.payload),
        display: new Map(insert.display),
        source: insert.source
      })
    }
    return operations
  }

  function getByDomRowIndex(index: number): StagedOp | undefined {
    if (updatesPayloadByRow.has(index)) {
      return {
        kind: 'update',
        domRowIndex: index,
        payload: new Map(updatesPayloadByRow.get(index) || []),
        display: new Map(updatesDisplayByRow.get(index) || [])
      }
    }
    if (removals.has(index)) return { kind: 'remove', domRowIndex: index }
    return undefined
  }

  function count(): number {
    return updatesPayloadByRow.size + removals.size + inserts.length
  }

  function clear(): void {
    updatesPayloadByRow.clear()
    updatesDisplayByRow.clear()
    removals.clear()
    inserts.length = 0
  }

  return {
    stage,
    unstage,
    removeInsert,
    getAll,
    getByDomRowIndex,
    count,
    clear,
    getUpdatePayloads: () => updatesPayloadByRow,
    getUpdateDisplays: () => updatesDisplayByRow,
    getRemovals: () => removals,
    getInserts: () => inserts
  }
}

