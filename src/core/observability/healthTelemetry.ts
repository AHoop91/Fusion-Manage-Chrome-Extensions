import type { HealthDiagnosticEvent } from '../health/contracts/HealthDiagnosticEvent'
import { sendRuntimeMessageFireAndForget } from '../../platform/messaging/runtimeClient'
import { getSessionValues, setSessionValues } from '../../platform/storage/sessionStorage'

export const HEALTH_DIAGNOSTIC_STORAGE_KEY = 'plmExtension.healthDiagnostic'
export const HEALTH_DIAGNOSTIC_BY_PAGE_SIGNATURE_STORAGE_KEY = 'plmExtension.healthDiagnosticByPageSignature'

type DiagnosticsByPageSignature = Record<string, HealthDiagnosticEvent>
const MAX_DIAGNOSTICS_BY_PAGE_SIGNATURE_ENTRIES = 20
const MAX_DIAGNOSTICS_BY_PAGE_SIGNATURE_AGE_MS = 24 * 60 * 60 * 1000

function isDebugEnabled(): boolean {
  try {
    return window.localStorage.getItem('plmExtension.debug') === '1'
  } catch {
    return false
  }
}

function safeDebugLog(message: string, payload?: unknown): void {
  if (!isDebugEnabled()) return
  try {
    if (payload !== undefined) {
      console.debug(message, payload)
      return
    }
    console.debug(message)
  } catch {
    // Ignore logging errors.
  }
}

function sanitizeDiagnosticForStorage(event: HealthDiagnosticEvent): HealthDiagnosticEvent {
  return {
    ...event,
    pageUrl: ''
  }
}

export class HealthTelemetry {
  async emit(event: HealthDiagnosticEvent): Promise<void> {
    const now = Date.now()
    const sanitizedEvent = sanitizeDiagnosticForStorage(event)
    const signatureKey =
      String(event.pageScope || '').trim()
      || String(event.pageSignature || '').trim()
      || 'runtime-baseline'

    try {
      const existingResult =
        (await getSessionValues<Record<string, unknown>>([
          HEALTH_DIAGNOSTIC_STORAGE_KEY,
          HEALTH_DIAGNOSTIC_BY_PAGE_SIGNATURE_STORAGE_KEY
        ])) || {}
      const existingMap =
        (existingResult as Record<string, unknown>)[HEALTH_DIAGNOSTIC_BY_PAGE_SIGNATURE_STORAGE_KEY] || {}
      const nextMap: DiagnosticsByPageSignature = {}
      for (const [pageSignature, diagnostic] of Object.entries(existingMap as Record<string, HealthDiagnosticEvent>)) {
        if (!diagnostic || typeof diagnostic !== 'object') continue
        const timestamp = Number(diagnostic.timestamp || 0)
        if (!Number.isFinite(timestamp) || now - timestamp > MAX_DIAGNOSTICS_BY_PAGE_SIGNATURE_AGE_MS) continue
        nextMap[pageSignature] = diagnostic
      }
      nextMap[signatureKey] = sanitizedEvent

      const entries = Object.entries(nextMap)
        .sort((a, b) => (b[1]?.timestamp || 0) - (a[1]?.timestamp || 0))
        .slice(0, MAX_DIAGNOSTICS_BY_PAGE_SIGNATURE_ENTRIES)
      const trimmedMap = Object.fromEntries(entries)

      await setSessionValues({
        [HEALTH_DIAGNOSTIC_STORAGE_KEY]: sanitizedEvent,
        [HEALTH_DIAGNOSTIC_BY_PAGE_SIGNATURE_STORAGE_KEY]: trimmedMap
      })
    } catch {
      // Ignore storage errors; telemetry must never break feature flow.
    }

    sendRuntimeMessageFireAndForget({
      type: 'HEALTH_DIAGNOSTIC_EVENT',
      payload: event as unknown as Record<string, unknown>
    })

    safeDebugLog('[plm-extension] health diagnostic', event)
  }
}

export const healthTelemetry = new HealthTelemetry()
