/**
 * Shared runtime contracts for content scripts.
 */
export type PageContext = { url: string }

export type PageModule = {
  id: string
  matches: (url: string) => boolean
  requiredSelectors?: string[]
  riskLevel?: 'low' | 'medium' | 'high'
  mount?: (ctx: PageContext) => void
  update?: (ctx: PageContext) => void
  unmount?: (ctx: PageContext) => void
  __active?: boolean
}

export type ModalAction = { id: string; label: string }

export type PlmExtRuntime = {
  pages: PageModule[]
  registerPage: (page: PageModule) => void
  ensureNavPatched: (eventName: string) => void
  findByIdDeep: (root: Document | ShadowRoot | Element | null, id: string) => HTMLElement | null
  isFusionHost: (url: string) => boolean
  isItemDetailsPage: (url: string) => boolean
  isAddItemPage: (url: string) => boolean
  closeModal: (modalId: string) => void
  openModal: (modalId: string, action: ModalAction) => void
  getLocalOptions: <T extends object>(storageKey: string, defaults: T) => Promise<T>
  setLocalOptions: <T extends object>(storageKey: string, nextOptions: T) => Promise<void>
  requestPlmAction: <T = unknown>(action: string, payload?: Record<string, unknown>) => Promise<T>
}

declare global {
  interface Window {
    __plmExt?: PlmExtRuntime
  }
}

export {}

