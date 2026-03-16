import { DomAdapter } from '../../dom/DomAdapter'
import { HealthState, HealthStatus, type HealthSnapshot } from '../health/healthState'
import { SafeExecutor } from '../safety/safeExecutor'
import type { HealthTelemetry } from '../observability/healthTelemetry'

export interface FeatureDefinition {
  name: string
  requiredSelectors: string[]
  riskLevel: 'low' | 'medium' | 'high'
  initialize(): void
  matches?: (url: string) => boolean
  update?: (url: string) => void
  teardown?: () => void
}

type FeatureRecord = {
  definition: FeatureDefinition
  active: boolean
  disabled: boolean
}

type FeatureRegistryDeps = {
  domAdapter: DomAdapter
  safeExecutor: SafeExecutor
  telemetry: HealthTelemetry
  extensionVersion: string
}

function isRiskAllowed(snapshot: HealthSnapshot, riskLevel: FeatureDefinition['riskLevel']): boolean {
  if (snapshot.status === HealthStatus.HEALTHY) return true
  if (snapshot.status === HealthStatus.DEGRADED) return true
  if (snapshot.status === HealthStatus.PARTIAL_FAILURE) return riskLevel === 'low'
  return false
}

export class FeatureRegistry {
  private readonly records = new Map<string, FeatureRecord>()
  private currentHealth: HealthSnapshot | null = null

  constructor(private readonly deps: FeatureRegistryDeps) {}

  register(definition: FeatureDefinition): void {
    if (this.records.has(definition.name)) return
    this.records.set(definition.name, {
      definition,
      active: false,
      disabled: false
    })
  }

  setHealth(snapshot: HealthSnapshot): void {
    this.currentHealth = snapshot
    HealthState.setSnapshot(snapshot)
  }

  getDisabledFeatures(): string[] {
    const disabled: string[] = []
    for (const [name, record] of this.records.entries()) {
      if (record.disabled || this.deps.safeExecutor.isFeatureBlocked(name)) {
        disabled.push(name)
      }
    }
    return disabled
  }

  private disableFeature(featureName: string): void {
    const record = this.records.get(featureName)
    if (!record) return
    record.disabled = true
    if (record.active) {
      try {
        record.definition.teardown?.()
      } catch {
        // Safe no-op.
      }
      record.active = false
    }
  }

  private canRunFeature(record: FeatureRecord): boolean {
    const snapshot = this.currentHealth
    if (!snapshot) return false
    if (record.disabled || this.deps.safeExecutor.isFeatureBlocked(record.definition.name)) return false
    if (!isRiskAllowed(snapshot, record.definition.riskLevel)) return false

    const selectors = this.deps.domAdapter.hasAll(record.definition.requiredSelectors)
    return selectors.ok
  }

  async applyRoute(url: string, options?: { skipUpdates?: boolean }): Promise<void> {
    const snapshot = this.currentHealth || HealthState.getSnapshot()
    if (!snapshot) return
    const skipUpdates = Boolean(options?.skipUpdates)

    for (const record of this.records.values()) {
      const matches = record.definition.matches ? record.definition.matches(url) : true
      const canRun = matches && this.canRunFeature(record)

      if (!matches) {
        if (record.active) {
          await this.deps.safeExecutor.run(
            () => {
              record.definition.teardown?.()
              record.active = false
            },
            {
              featureName: record.definition.name,
              onDisableFeature: (name) => this.disableFeature(name),
              diagnosticBase: {
                schemaVersion: snapshot.schema.schemaVersion,
                extensionVersion: this.deps.extensionVersion,
                pageScope: snapshot.schema.pageSignature,
                pageSignature: snapshot.pageSignature,
                pageUrl: url
              },
              getMissingSelectors: () => snapshot.missingSelectors,
              getDisabledFeatures: () => this.getDisabledFeatures()
            }
          )
        }
        continue
      }

      if (!canRun) {
        // For matched routes, avoid hard teardown on transient DOM-health dips.
        // Active features remain mounted and can recover in-place.
        continue
      }

      if (!record.active) {
        const result = await this.deps.safeExecutor.run(
          () => {
            record.definition.initialize()
            record.active = true
          },
          {
            featureName: record.definition.name,
            onDisableFeature: (name) => this.disableFeature(name),
              diagnosticBase: {
                schemaVersion: snapshot.schema.schemaVersion,
                extensionVersion: this.deps.extensionVersion,
                pageScope: snapshot.schema.pageSignature,
                pageSignature: snapshot.pageSignature,
                pageUrl: url
              },
            getMissingSelectors: () => snapshot.missingSelectors,
            getDisabledFeatures: () => this.getDisabledFeatures()
          }
        )
        if (!result.ok && 'blocked' in result && result.blocked) {
          this.disableFeature(record.definition.name)
        }
        continue
      }

      if (!skipUpdates && record.definition.update) {
        await this.deps.safeExecutor.run(
          () => {
            record.definition.update?.(url)
          },
          {
            featureName: record.definition.name,
            onDisableFeature: (name) => this.disableFeature(name),
              diagnosticBase: {
                schemaVersion: snapshot.schema.schemaVersion,
                extensionVersion: this.deps.extensionVersion,
                pageScope: snapshot.schema.pageSignature,
                pageSignature: snapshot.pageSignature,
                pageUrl: url
              },
            getMissingSelectors: () => snapshot.missingSelectors,
            getDisabledFeatures: () => this.getDisabledFeatures()
          }
        )
      }
    }

    const nextSnapshot: HealthSnapshot = {
      ...snapshot,
      disabledFeatures: this.getDisabledFeatures(),
      timestamp: Date.now()
    }
    this.currentHealth = nextSnapshot
    HealthState.setSnapshot(nextSnapshot)

    await this.deps.telemetry.emit({
      status: nextSnapshot.status,
      missingSelectors: nextSnapshot.missingSelectors,
      disabledFeatures: nextSnapshot.disabledFeatures,
      schemaVersion: nextSnapshot.schema.schemaVersion,
      extensionVersion: this.deps.extensionVersion,
      pageScope: nextSnapshot.schema.pageSignature,
      pageSignature: nextSnapshot.pageSignature,
      pageUrl: url,
      timestamp: nextSnapshot.timestamp
    })
  }
}
