import type { TableausRuntime } from './tableaus.types'
import { matchesTableausPage, extractWsId, extractActiveTableauId } from './services/tableaus.service'
import { createTableausApi } from './services/tableaus.api'
import { createTableausView } from './view/tableaus.view'

export type TableausController = {
  matches: (url: string) => boolean
  mount: () => void
  update: () => void
  unmount: () => void
}

export function createTableausController(ext: TableausRuntime): TableausController {
  const api = createTableausApi(ext.requestPlmAction)
  const view = createTableausView({
    api,
    getWsId: () => extractWsId(window.location.href),
    getActiveTableauId: () => extractActiveTableauId(window.location.href)
  })

  return {
    matches(url: string): boolean {
      return matchesTableausPage(url)
    },
    mount(): void {
      view.mount()
    },
    update(): void {
      view.update()
    },
    unmount(): void {
      view.unmount()
    }
  }
}
