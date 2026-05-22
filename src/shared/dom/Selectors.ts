export const SELECTORS = {
  body: 'body',
  commandBarReact: '#command-bar-react',
  itemDetailsWrapper: '#wrapper',
  itemDetailsSection: '[name="section-content"]',
  gridSpreadsheet: '#grid-spreadsheet',
  gridTable: 'spreadsheet table.htCore',
  gridCommandBar: '#transcluded-buttons .grid-command-bar'
} as const

export type SelectorKey = keyof typeof SELECTORS

