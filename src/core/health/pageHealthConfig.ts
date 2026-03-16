import { SELECTORS } from '../../dom/Selectors'
import type { HealthSchemaV1 } from './contracts/HealthSchema.v1'

export type BootstrapContextId = 'content-router' | 'security-users'

const BASE_SCHEMA: HealthSchemaV1 = {
  schemaVersion: '1.0.0',
  pageSignature: 'runtime-baseline',
  requiredSelectors: [SELECTORS.body],
  optionalSelectors: [],
  structuralAssertions: [
    {
      id: 'body-present',
      selector: SELECTORS.body,
      assertion: 'exists',
      severity: 'critical'
    }
  ],
  featureDependencies: {}
}

function createItemDetailsSchema(): HealthSchemaV1 {
  return {
    ...BASE_SCHEMA,
    pageSignature: 'runtime-baseline:item-details',
    requiredSelectors: [SELECTORS.body],
    optionalSelectors: [],
    structuralAssertions: [...BASE_SCHEMA.structuralAssertions],
    featureDependencies: {
      itemDetails: [SELECTORS.body]
    }
  }
}

function createGridSchema(): HealthSchemaV1 {
  return {
    ...BASE_SCHEMA,
    pageSignature: 'runtime-baseline:grid',
    requiredSelectors: [SELECTORS.body, SELECTORS.gridSpreadsheet, SELECTORS.gridCommandBar],
    optionalSelectors: [],
    structuralAssertions: [...BASE_SCHEMA.structuralAssertions],
    featureDependencies: {
      grid: [SELECTORS.gridSpreadsheet, SELECTORS.gridCommandBar]
    }
  }
}

function createSecuritySchema(): HealthSchemaV1 {
  return {
    ...BASE_SCHEMA,
    pageSignature: 'runtime-baseline:security-users',
    requiredSelectors: [SELECTORS.body, SELECTORS.securityUsersRoot, SELECTORS.securityUsersTable],
    optionalSelectors: [],
    structuralAssertions: [...BASE_SCHEMA.structuralAssertions],
    featureDependencies: {
      security: [SELECTORS.securityUsersTable],
      securityUsersFilter: [SELECTORS.securityUsersTable]
    }
  }
}

export function resolveHealthSchema(urlString: string, contextId: BootstrapContextId): HealthSchemaV1 {
  let url: URL | null = null
  try {
    url = new URL(urlString)
  } catch {
    return BASE_SCHEMA
  }

  const pathname = url.pathname.toLowerCase()
  const tab = (url.searchParams.get('tab') || '').toLowerCase()

  if (contextId === 'security-users') return createSecuritySchema()
  if (/\/plm\/workspaces\/\d+\/items\/itemdetails$/i.test(pathname) || /\/plm\/workspaces\/\d+\/items\/additem$/i.test(pathname)) {
    return createItemDetailsSchema()
  }
  if (/\/plm\/workspaces\/\d+\/items\/grid$/i.test(pathname)) return createGridSchema()
  if (pathname.includes('/admin') || tab === 'users' || tab === 'groups' || tab === 'roles') return createSecuritySchema()

  return BASE_SCHEMA
}

