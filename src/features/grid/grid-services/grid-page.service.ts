import { isGridPage } from '../grid-page/grid-page-context'
import type { GridPageRuntime } from '../grid.types'

export type GridPageService = {
  matches: (url: string) => boolean
}

export function createGridPageService(_runtime: GridPageRuntime): GridPageService {
  return {
    matches(url) {
      return isGridPage(url)
    }
  }
}
