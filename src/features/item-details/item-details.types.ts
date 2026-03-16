import type { PlmExtRuntime } from '../../shared/runtime/types'

export type ItemDetailsRuntime = Pick<
  PlmExtRuntime,
  | 'registerPage'
  | 'isItemDetailsPage'
  | 'isAddItemPage'
  | 'findByIdDeep'
  | 'getLocalOptions'
  | 'setLocalOptions'
  | 'requestPlmAction'
>

export type SectionMeta = {
  section: HTMLElement
  key: string
  label: string
}

export type SectionsVisibilityMap = Record<string, string[]>

export type ItemDetailsOptionsMode = 'view' | 'edit'

export type ItemDetailsStateSnapshot = {
  optionsMode: ItemDetailsOptionsMode
}

export type ItemDetailsController = {
  matches: (url: string) => boolean
  mount: (ctx: { url: string }) => void
  update: (ctx: { url: string }) => void
  unmount: () => void
}
