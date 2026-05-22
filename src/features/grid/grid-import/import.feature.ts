import type { GridPageRuntime } from '../grid.types'
import { createGridImportController, type GridImportControllerOptions } from './import.controller'
import type { GridImportFeature } from './types'

export function createGridImportFeature(
  ext: Pick<GridPageRuntime, 'requestPlmAction'>,
  options: GridImportControllerOptions
): GridImportFeature {
  const controller = createGridImportController(ext, options)
  return {
    open: controller.open,
    mount() {},
    update() {},
    unmount() {
      controller.close()
    }
  }
}

