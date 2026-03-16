// Shared Search feature surface used by capability-specific flows (for example BOM clone).
// Exposes service/session/view primitives while keeping caller-owned workflow logic external.
export { createItemSelectorService, type ItemSelectorService } from './service'
export { createItemSelectorSession } from './session'
export {
  renderItemSelectorSearchPhase,
  type ItemSelectorSearchSnapshot,
  type ItemSelectorSearchHandlers
} from './view'
export { ensureItemSelectorStyles } from './styles'
export type {
  ItemSelectorAttachment,
  ItemSelectorContext,
  ItemSelectorDetailRow,
  ItemSelectorDetailSection,
  ItemSelectorSearchField,
  ItemSelectorSearchFilter,
  ItemSelectorSearchFilterGroup,
  ItemSelectorSearchResult
} from './types'
