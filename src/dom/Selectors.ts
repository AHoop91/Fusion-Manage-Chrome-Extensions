export const SELECTORS = {
  body: 'body',
  commandBarReact: '#command-bar-react',
  itemDetailsWrapper: '#wrapper',
  itemDetailsSection: '[name="section-content"]',
  gridSpreadsheet: '#grid-spreadsheet',
  gridTable: 'spreadsheet table.htCore',
  gridCommandBar: '#transcluded-buttons .grid-command-bar',
  securityUsersRoot: '#profileinfo-2',
  securityUsersTable: '#profileinfo-2 .itembody-users table',
  securityUsersHeader: '#profileinfo-2 #itemmenu-2'
} as const

export type SelectorKey = keyof typeof SELECTORS

