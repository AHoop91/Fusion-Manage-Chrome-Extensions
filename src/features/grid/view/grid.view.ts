import type { GridFeatureLifecycle, GridStateSnapshot } from '../grid.types'

export type GridView = {
  mount: (snapshot: GridStateSnapshot) => void
  update: (snapshot: GridStateSnapshot) => void
  unmount: (snapshot: GridStateSnapshot) => void
}

export function createGridView(capabilities: GridFeatureLifecycle[]): GridView {
  function runLifecycle(method: keyof GridFeatureLifecycle): void {
    for (const capability of capabilities) {
      capability[method]()
    }
  }

  return {
    mount(_snapshot) {
      runLifecycle('mount')
    },
    update(_snapshot) {
      runLifecycle('update')
    },
    unmount(_snapshot) {
      runLifecycle('unmount')
    }
  }
}
