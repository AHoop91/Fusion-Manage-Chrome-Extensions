import { isCwComponentsWorkspaceForUrl } from '../../../app/workspace/workspaceTierGate'
import type { PlmExtRuntime } from '../../../shared/runtime/types'
import { matchesCwComponentsItemChromeRoute } from '../../../shared/url/parse'
import { createDesignComponentsView } from './components.view'
import type { DesignComponentsView } from './components.types'

export function createDesignComponentsController(ext: PlmExtRuntime) {
  const view: DesignComponentsView = createDesignComponentsView(ext)

  return {
    matches(url: string): boolean {
      return matchesCwComponentsItemChromeRoute(url) && isCwComponentsWorkspaceForUrl(url)
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
