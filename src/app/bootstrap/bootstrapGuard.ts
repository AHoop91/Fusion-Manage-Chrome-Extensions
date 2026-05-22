import { DomAdapter } from '../../shared/dom/DomAdapter'
import { SafeExecutor } from './safeExecutor'

export type BootstrapContextId = 'content-router'

export type BootstrapSession = {
  contextId: BootstrapContextId
  domAdapter: DomAdapter
  safeExecutor: SafeExecutor
}

type BootstrapInitOptions = {
  contextId: BootstrapContextId
}

/**
 * Builds shared DOM access and a safe executor for {@link FeatureRegistry}.
 */
export class BootstrapGuard {
  private static initPromise: Promise<BootstrapSession> | null = null

  static initialize(options: BootstrapInitOptions): Promise<BootstrapSession> {
    if (BootstrapGuard.initPromise) return BootstrapGuard.initPromise
    BootstrapGuard.initPromise = Promise.resolve(BootstrapGuard.createSession(options))
    return BootstrapGuard.initPromise
  }

  private static createSession(options: BootstrapInitOptions): BootstrapSession {
    const domAdapter = new DomAdapter(document)
    const safeExecutor = new SafeExecutor()
    return {
      contextId: options.contextId,
      domAdapter,
      safeExecutor
    }
  }
}
