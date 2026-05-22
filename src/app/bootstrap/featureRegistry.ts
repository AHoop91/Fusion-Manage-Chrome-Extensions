import { DomAdapter } from '../../shared/dom/DomAdapter'
import { SafeExecutor } from './safeExecutor'

export interface FeatureDefinition {
  name: string
  requiredSelectors: string[]
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
}

export class FeatureRegistry {
  private readonly records = new Map<string, FeatureRecord>()

  constructor(private readonly deps: FeatureRegistryDeps) {}

  register(definition: FeatureDefinition): void {
    if (this.records.has(definition.name)) return
    this.records.set(definition.name, {
      definition,
      active: false,
      disabled: false
    })
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
    if (record.disabled || this.deps.safeExecutor.isFeatureBlocked(record.definition.name)) return false
    const selectors = this.deps.domAdapter.hasAll(record.definition.requiredSelectors)
    return selectors.ok
  }

  async applyRoute(url: string, options?: { skipUpdates?: boolean }): Promise<void> {
    const skipUpdates = Boolean(options?.skipUpdates)

    const runOpts = (featureName: string) => ({
      featureName,
      onDisableFeature: (name: string) => this.disableFeature(name)
    })

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
            runOpts(record.definition.name)
          )
        }
        continue
      }

      if (!canRun) {
        continue
      }

      if (!record.active) {
        const result = await this.deps.safeExecutor.run(
          () => {
            record.definition.initialize()
            record.active = true
          },
          runOpts(record.definition.name)
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
          runOpts(record.definition.name)
        )
      }
    }
  }
}
