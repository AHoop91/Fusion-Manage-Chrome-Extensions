import { GRID_SELECTORS } from './gridSelectors'

export type GridDomAdapter = {
  requiredSelectors: string[]
}

export function createGridDom(): GridDomAdapter {
  return {
    requiredSelectors: [GRID_SELECTORS.spreadsheet, GRID_SELECTORS.commandBar]
  }
}
