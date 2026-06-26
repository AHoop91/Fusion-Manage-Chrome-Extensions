/**
 * Cross-feature UI widgets (`GenericLoader`, `SearchDialogModal`) used by multiple product features (`bom`, `grid`, …).
 * For runtime / DOM primitives used app-wide, prefer `src/shared/*`.
 */
export {
  SearchDialogModal,
  type SearchDialogModalProps,
  type ItemSelectorSearchHandlers,
  type ItemSelectorSearchSnapshot,
  ensureSearchDialogModalStyles,
  SEARCH_DIALOG_MODAL_STYLE_ID
} from './search-dialog-modal'
export {
  GenericLoader,
  type GenericLoaderProps,
  createGenericLoaderElement,
  type GenericLoaderElementOptions,
  ensureGenericLoaderStyles,
  GENERIC_LOADER_STYLE_ID
} from './generic-loader'
