import type { ItemDetailsOptionsMode, ItemDetailsStateSnapshot } from './item-details.types'

type ItemDetailsState = {
  getSnapshot: () => ItemDetailsStateSnapshot
  reset: () => void
  setOptionsMode: (mode: ItemDetailsOptionsMode) => void
}

function createDefaultSnapshot(initialMode: ItemDetailsOptionsMode): ItemDetailsStateSnapshot {
  return {
    optionsMode: initialMode
  }
}

export function createItemDetailsState(initialMode: ItemDetailsOptionsMode): ItemDetailsState {
  let snapshot = createDefaultSnapshot(initialMode)

  return {
    getSnapshot() {
      return snapshot
    },
    reset() {
      snapshot = createDefaultSnapshot(initialMode)
    },
    setOptionsMode(mode) {
      snapshot = {
        ...snapshot,
        optionsMode: mode
      }
    }
  }
}
