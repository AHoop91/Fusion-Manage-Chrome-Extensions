import { GRID_SELECTORS } from './dom/gridSelectors'
import { createGridObserver } from './dom/gridObserver'

export type GridDomAdapter = {
  requiredSelectors: string[]
  observePage: (onChange: () => void) => MutationObserver
}

export function createGridDom(): GridDomAdapter {
  return {
    requiredSelectors: [GRID_SELECTORS.spreadsheet, GRID_SELECTORS.commandBar],
    observePage(onChange) {
      return createGridObserver(onChange)
    }
  }
}
