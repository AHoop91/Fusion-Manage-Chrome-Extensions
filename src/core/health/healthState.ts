import type { HealthSchemaV1 } from './contracts/HealthSchema.v1'

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  PARTIAL_FAILURE = 'PARTIAL_FAILURE',
  CRITICAL_FAILURE = 'CRITICAL_FAILURE'
}

export type HealthSnapshot = {
  status: HealthStatus
  schema: HealthSchemaV1
  pageSignature: string
  missingSelectors: string[]
  failedAssertions: string[]
  disabledFeatures: string[]
  unstable: boolean
  timestamp: number
}

class HealthStateStore {
  private static instance: HealthStateStore | null = null

  private snapshot: HealthSnapshot | null = null
  private baselineSignatureBySchema = new Map<string, string>()

  static getInstance(): HealthStateStore {
    if (!HealthStateStore.instance) {
      HealthStateStore.instance = new HealthStateStore()
    }
    return HealthStateStore.instance
  }

  getSnapshot(): HealthSnapshot | null {
    return this.snapshot
  }

  setSnapshot(snapshot: HealthSnapshot): void {
    this.snapshot = snapshot
  }

  setBaselineSignature(schemaKey: string, signature: string): void {
    if (!schemaKey || !signature) return
    if (!this.baselineSignatureBySchema.has(schemaKey)) {
      this.baselineSignatureBySchema.set(schemaKey, signature)
    }
  }

  getBaselineSignature(schemaKey: string): string | null {
    return this.baselineSignatureBySchema.get(schemaKey) || null
  }
}

export const HealthState = HealthStateStore.getInstance()
