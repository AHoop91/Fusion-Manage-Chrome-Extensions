import type { GridFeatureLifecycle } from '../grid.types'

export type GridView = {
  mount: () => void
  update: () => void
  unmount: () => void
}

export function createGridView(capabilities: GridFeatureLifecycle[]): GridView {
  function runLifecycle(method: keyof GridFeatureLifecycle): void {
    for (const capability of capabilities) {
      capability[method]()
    }
  }

  return {
    mount() {
      runLifecycle('mount')
    },
    update() {
      runLifecycle('update')
    },
    unmount() {
      runLifecycle('unmount')
    }
  }
}
