import { isItemDetailsEditMode } from '../item-details.utils'
import type { ItemDetailsOptionsMode, ItemDetailsRuntime } from '../item-details.types'

export type ItemDetailsService = {
  matches: (url: string) => boolean
  resolveOptionsMode: (url: string) => ItemDetailsOptionsMode
}

export function createItemDetailsService(runtime: ItemDetailsRuntime): ItemDetailsService {
  return {
    matches(url) {
      return runtime.isItemDetailsPage(url) || runtime.isAddItemPage(url)
    },
    resolveOptionsMode(url) {
      return runtime.isAddItemPage(url) || isItemDetailsEditMode(url) ? 'edit' : 'view'
    }
  }
}
