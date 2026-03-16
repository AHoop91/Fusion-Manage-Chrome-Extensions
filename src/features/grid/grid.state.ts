import type { GridStateSnapshot } from './grid.types'

type GridState = {
  getSnapshot: () => GridStateSnapshot
  setMounted: (value: boolean) => void
  reset: () => void
}

function createDefaultSnapshot(): GridStateSnapshot {
  return {
    mounted: false
  }
}

export function createGridState(): GridState {
  let snapshot = createDefaultSnapshot()

  return {
    getSnapshot() {
      return snapshot
    },
    setMounted(value) {
      snapshot = {
        ...snapshot,
        mounted: value
      }
    },
    reset() {
      snapshot = createDefaultSnapshot()
    }
  }
}
