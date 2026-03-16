import { DomAdapter } from '../../dom/DomAdapter'
import { SafeExecutor } from '../safety/safeExecutor'
import { healthTelemetry } from '../observability/healthTelemetry'
import { evaluateHealth } from './healthEvaluator'
import { resolveHealthSchema, type BootstrapContextId } from './pageHealthConfig'
import { HealthState, HealthStatus, type HealthSnapshot } from './healthState'

export type BootstrapSession = {
  contextId: BootstrapContextId
  extensionVersion: string
  domAdapter: DomAdapter
  safeExecutor: SafeExecutor
  evaluateUrl: (url: string) => Promise<HealthSnapshot>
  getSnapshot: () => HealthSnapshot | null
}

type BootstrapInitOptions = {
  contextId: BootstrapContextId
  initialUrl: string
  extensionVersion: string
}

/**
 * Hard startup gate for DOM safety.
 *
 * Initialization order:
 * 1) load schema configuration
 * 2) validate DOM integrity
 * 3) register session health state
 * 4) emit diagnostic event
 * 5) attach structural monitor
 */
export class BootstrapGuard {
  private static initPromise: Promise<BootstrapSession> | null = null
  private static monitorObserver: MutationObserver | null = null
  private static monitorTimer: number | null = null
  private static readonly DOWNGRADE_GRACE_MS = 1200

  static initialize(options: BootstrapInitOptions): Promise<BootstrapSession> {
    if (BootstrapGuard.initPromise) return BootstrapGuard.initPromise
    BootstrapGuard.initPromise = BootstrapGuard.createSession(options)
    return BootstrapGuard.initPromise
  }

  private static async createSession(options: BootstrapInitOptions): Promise<BootstrapSession> {
    const domAdapter = new DomAdapter(document)
    const safeExecutor = new SafeExecutor(healthTelemetry)
    let lastEvaluatedUrl = options.initialUrl
    let unhealthySince = 0
    let unhealthyFingerprint = ''

    const evaluateUrl = async (url: string): Promise<HealthSnapshot> => {
      if (url !== lastEvaluatedUrl) {
        lastEvaluatedUrl = url
        unhealthySince = 0
        unhealthyFingerprint = ''
      }

      const schema = resolveHealthSchema(url, options.contextId)
      const rawSnapshot = evaluateHealth(schema, domAdapter)
      const previousSnapshot = HealthState.getSnapshot()
      let snapshot = rawSnapshot

      const isTransientDowngrade =
        rawSnapshot.status === HealthStatus.DEGRADED || rawSnapshot.status === HealthStatus.PARTIAL_FAILURE
      const previousHealthy = previousSnapshot?.status === HealthStatus.HEALTHY

      if (isTransientDowngrade && previousHealthy) {
        const fingerprint = [
          rawSnapshot.status,
          rawSnapshot.pageSignature,
          ...rawSnapshot.missingSelectors,
          ...rawSnapshot.failedAssertions
        ].join('|')

        if (unhealthyFingerprint !== fingerprint) {
          unhealthyFingerprint = fingerprint
          unhealthySince = Date.now()
        }

        if (Date.now() - unhealthySince < BootstrapGuard.DOWNGRADE_GRACE_MS) {
          snapshot = {
            ...previousSnapshot,
            timestamp: Date.now()
          }
        }
      } else if (rawSnapshot.status === HealthStatus.HEALTHY) {
        unhealthySince = 0
        unhealthyFingerprint = ''
      }

      HealthState.setSnapshot(snapshot)

      await healthTelemetry.emit({
        status: snapshot.status,
        missingSelectors: snapshot.missingSelectors,
        disabledFeatures: snapshot.disabledFeatures,
        schemaVersion: snapshot.schema.schemaVersion,
        extensionVersion: options.extensionVersion,
        pageScope: snapshot.schema.pageSignature,
        pageSignature: snapshot.pageSignature,
        pageUrl: url,
        timestamp: Date.now()
      })

      return snapshot
    }

    await evaluateUrl(options.initialUrl)
    BootstrapGuard.installMutationMonitor(evaluateUrl)

    return {
      contextId: options.contextId,
      extensionVersion: options.extensionVersion,
      domAdapter,
      safeExecutor,
      evaluateUrl,
      getSnapshot: () => HealthState.getSnapshot()
    }
  }

  private static installMutationMonitor(evaluateUrl: (url: string) => Promise<HealthSnapshot>): void {
    if (BootstrapGuard.monitorObserver) return

    const scheduleCheck = (): void => {
      if (BootstrapGuard.monitorTimer !== null) return
      BootstrapGuard.monitorTimer = window.setTimeout(async () => {
        BootstrapGuard.monitorTimer = null
        const snapshot = await evaluateUrl(window.location.href)
        if (snapshot.status === HealthStatus.CRITICAL_FAILURE) {
          // Keep monitor active for potential future recovery.
          return
        }
      }, 200)
    }

    BootstrapGuard.monitorObserver = new MutationObserver(() => {
      scheduleCheck()
    })

    BootstrapGuard.monitorObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'id']
    })
  }
}
