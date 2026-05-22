type SafeExecutorOptions = {
  featureName: string
  onDisableFeature?: (featureName: string) => void
}

type RunResult<T> = { ok: true; value: T } | { ok: false; blocked: boolean; error?: unknown }

const MAX_FAILURES_PER_FEATURE = 3

/**
 * Isolates feature lifecycle errors so one failing feature does not break the registry loop.
 * No telemetry or diagnostics — only optional disable-after-repeated-failure.
 */
export class SafeExecutor {
  private readonly failureCountByFeature = new Map<string, number>()
  private readonly blockedFeatures = new Set<string>()

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

      if (nextCount >= MAX_FAILURES_PER_FEATURE) {
        this.blockedFeatures.add(options.featureName)
        options.onDisableFeature?.(options.featureName)
      }

      return { ok: false, blocked: this.blockedFeatures.has(options.featureName), error }
    }
  }
}
