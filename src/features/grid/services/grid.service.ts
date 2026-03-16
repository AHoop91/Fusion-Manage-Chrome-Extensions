import { isGridPage } from '../filters'
import type { GridFeatureLifecycle, GridPageRuntime } from '../grid.types'

type GridCapabilityFactories = {
  createGridFiltersFeature: () => GridFeatureLifecycle
  createGridFormFeature: (runtime: Pick<GridPageRuntime, 'requestPlmAction'>) => GridFeatureLifecycle
}

export type GridService = {
  matches: (url: string) => boolean
  createCapabilities: (factories: GridCapabilityFactories) => GridFeatureLifecycle[]
}

export function createGridService(runtime: GridPageRuntime): GridService {
  return {
    matches(url) {
      return isGridPage(url)
    },
    createCapabilities(factories) {
      return [
        factories.createGridFiltersFeature(),
        factories.createGridFormFeature(runtime)
      ]
    }
  }
}
