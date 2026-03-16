import type { HealthStatus } from '../healthState'

export interface HealthDiagnosticEvent {
  status: HealthStatus
  missingSelectors: string[]
  disabledFeatures: string[]
  schemaVersion: string
  extensionVersion: string
  pageScope?: string
  pageSignature: string
  pageUrl: string
  timestamp: number
}

