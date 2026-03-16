import { HealthStatus } from '../../../core/health/healthState'
import { healthTelemetry } from '../../../core/observability/healthTelemetry'
import { getExtensionVersion } from '../../../platform/runtime/extensionInfo'
import type { BomCloneCapabilityState, BomCloneDiagnosticCode } from './clone.types'

/**
 * Capability-level health adapter for BOM Clone.
 * Maps clone runtime states/diagnostics into shared telemetry events.
 */
type CloneHealth = {
  register: (pageUrl: string) => void
  setState: (state: BomCloneCapabilityState, pageUrl: string) => void
  emitDiagnostic: (code: BomCloneDiagnosticCode, pageUrl: string, detail: string) => void
}

const CAPABILITY_KEY = 'bom.clone'

function toHealthStatus(state: BomCloneCapabilityState): HealthStatus {
  switch (state) {
    case 'enabled':
      return HealthStatus.HEALTHY
    case 'disabled':
      return HealthStatus.CRITICAL_FAILURE
    case 'degraded':
      return HealthStatus.DEGRADED
    default:
      return HealthStatus.PARTIAL_FAILURE
  }
}

export function createCloneHealth(): CloneHealth {
  const extensionVersion = getExtensionVersion()
  let registered = false

  async function emit(state: BomCloneCapabilityState, pageUrl: string, detail?: string): Promise<void> {
    await healthTelemetry.emit({
      status: toHealthStatus(state),
      missingSelectors: [],
      disabledFeatures: state === 'enabled' ? [] : [CAPABILITY_KEY],
      schemaVersion: '1.0.0',
      extensionVersion,
      pageScope: CAPABILITY_KEY,
      pageSignature: detail ? `${CAPABILITY_KEY}:${detail}` : CAPABILITY_KEY,
      pageUrl,
      timestamp: Date.now()
    })
  }

  return {
    register(pageUrl) {
      if (registered) return
      registered = true
      void emit('initializing', pageUrl)
    },
    setState(state, pageUrl) {
      void emit(state, pageUrl)
    },
    emitDiagnostic(code, pageUrl, detail) {
      void emit('degraded', pageUrl, `${code}:${detail}`)
    }
  }
}


