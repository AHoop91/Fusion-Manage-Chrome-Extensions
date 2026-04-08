const ITEM_PAGE_PLM_ACTIONS = [
  'addBomItem',
  'addItemGridRow',
  'createItem',
  'createTableau',
  'deleteTableau',
  'fetchBomLinkableItems',
  'fetchApiJson',
  'fetchFields',
  'fetchSections',
  'getAttachments',
  'getBom',
  'getBomFlat',
  'getBomV1',
  'getBomViews',
  'getBomViewFields',
  'getBomViewsAndFields',
  'getFieldImageData',
  'getItemDescriptor',
  'getItemDetails',
  'getPermissions',
  'getTableau',
  'getTableauList',
  'getTableauListMeta',
  'getWorkspaces',
  'removeBomItem',
  'removeItemGridRow',
  'searchBulk',
  'updateBomItem',
  'updateItemGridRow',
  'updateTableau'
] as const

export const ALLOWED_PLM_ACTIONS_BY_SCOPE = {
  extension: new Set<string>([]),
  'item-page': new Set<string>(ITEM_PAGE_PLM_ACTIONS)
} as const
