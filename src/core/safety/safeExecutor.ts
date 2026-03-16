import { HealthStatus } from '../health/healthState'
import type { HealthDiagnosticEvent } from '../health/contracts/HealthDiagnosticEvent'
import type { HealthTelemetry } from '../observability/healthTelemetry'

type SafeExecutorOptions = {
  featureName: string
  onDowngrade?: (nextStatus: HealthStatus) => void
  onDisableFeature?: (featureName: string) => void
  diagnosticBase: Omit<HealthDiagnosticEvent, 'status' | 'timestamp' | 'disabledFeatures' | 'missingSelectors'>
  getMissingSelectors: () => string[]
  getDisabledFeatures: () => string[]
}

type RunResult<T> = { ok: true; value: T } | { ok: false; blocked: boolean; error?: unknown }

const MAX_FAILURES_PER_FEATURE = 3

export class SafeExecutor {
  private readonly failureCountByFeature = new Map<string, number>()
  private readonly blockedFeatures = new Set<string>()

  constructor(private readonly telemetry: HealthTelemetry) {}

  isFeatureBlocked(featureName: string): boolean {
    return this.blockedFeatures.has(featureName)
  }

  async run<T>(operation: () => T, options: SafeExecutorOptions): Promise<RunResult<T>> {
    if (this.blockedFeatures.has(options.featureName)) {
      return { ok: false, blocked: true }
    }

    try {
      const value = operation()
      return { ok: true, value }
    } catch (error) {
      const nextCount = (this.failureCountByFeature.get(options.featureName) || 0) + 1
      this.failureCountByFeature.set(options.featureName, nextCount)

      let status = HealthStatus.DEGRADED
      if (nextCount >= MAX_FAILURES_PER_FEATURE) {
        this.blockedFeatures.add(options.featureName)
        status = HealthStatus.PARTIAL_FAILURE
        options.onDisableFeature?.(options.featureName)
      }
      options.onDowngrade?.(status)

      await this.telemetry.emit({
        status,
        missingSelectors: options.getMissingSelectors(),
        disabledFeatures: options.getDisabledFeatures(),
        schemaVersion: options.diagnosticBase.schemaVersion,
        extensionVersion: options.diagnosticBase.extensionVersion,
        pageScope: options.diagnosticBase.pageScope,
        pageSignature: options.diagnosticBase.pageSignature,
        pageUrl: options.diagnosticBase.pageUrl,
        timestamp: Date.now()
      })

      return { ok: false, blocked: this.blockedFeatures.has(options.featureName), error }
    }
  }
}
