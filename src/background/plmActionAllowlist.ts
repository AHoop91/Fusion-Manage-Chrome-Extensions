const ITEM_PAGE_PLM_ACTIONS = [
  'addBomItem',
  'addItemGridRow',
  'createItem',
  'fetchBomLinkableItems',
  'fetchApiJson',
  'fetchFields',
  'fetchSections',
  'getAttachments',
  'getBom',
  'getBomV1',
  'getBomViews',
  'getBomViewFields',
  'getBomViewsAndFields',
  'getFieldImageData',
  'getItemDescriptor',
  'getItemDetails',
  'getPermissions',
  'getWorkspaces',
  'removeBomItem',
  'removeItemGridRow',
  'searchBulk',
  'updateBomItem',
  'updateItemGridRow'
] as const

export const ALLOWED_PLM_ACTIONS_BY_SCOPE = {
  extension: new Set<string>([]),
  'item-page': new Set<string>(ITEM_PAGE_PLM_ACTIONS)
} as const
