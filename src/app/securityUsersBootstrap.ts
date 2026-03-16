/**
 * Security users filters content-script entrypoint.
 */
import { BootstrapGuard } from '../core/health/bootstrapGuard'
import { FeatureRegistry } from '../core/orchestration/featureRegistry'
import { healthTelemetry } from '../core/observability/healthTelemetry'
import { getExtensionVersion } from '../platform/runtime/extensionInfo'
import { createSecurityUsersFilterDefinition } from '../features/security/users/filterDefinition'

export function bootstrapSecurityUsers(): void {
  void (async () => {
    const bootstrap = await BootstrapGuard.initialize({
      contextId: 'security-users',
      initialUrl: window.location.href,
      extensionVersion: getExtensionVersion()
    })

    const registry = new FeatureRegistry({
      domAdapter: bootstrap.domAdapter,
      safeExecutor: bootstrap.safeExecutor,
      telemetry: healthTelemetry,
      extensionVersion: bootstrap.extensionVersion
    })

    registry.register(createSecurityUsersFilterDefinition())

    let applyInFlight = false
    let queuedUrl: string | null = null

    async function applyRoute(url: string, options?: { skipUpdates?: boolean }): Promise<void> {
      const snapshot = await bootstrap.evaluateUrl(url)
      registry.setHealth(snapshot)
      await registry.applyRoute(url, options)
    }

    function scheduleApply(url: string, options?: { skipUpdates?: boolean }): void {
      if (applyInFlight) {
        queuedUrl = url
        return
      }

      applyInFlight = true
      void applyRoute(url, options).finally(() => {
        applyInFlight = false
        if (!queuedUrl) return
        const nextUrl = queuedUrl
        queuedUrl = null
        scheduleApply(nextUrl, { skipUpdates: true })
      })
    }

    let lastUrl = window.location.href
    const onUrlMaybeChanged = (): void => {
      const currentUrl = window.location.href
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl
        scheduleApply(lastUrl)
        return
      }
      scheduleApply(lastUrl, { skipUpdates: true })
    }

    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          scheduleApply(lastUrl)
        },
        { once: true }
      )
    } else {
      scheduleApply(lastUrl)
    }

    window.addEventListener('hashchange', onUrlMaybeChanged)
    window.addEventListener('popstate', onUrlMaybeChanged)
    window.setInterval(onUrlMaybeChanged, 1200)
  })()
}

bootstrapSecurityUsers()
