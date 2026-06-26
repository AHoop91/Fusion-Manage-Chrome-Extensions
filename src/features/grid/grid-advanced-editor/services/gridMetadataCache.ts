import type { CapturedGridFieldDefinition, CapturedGridFieldsPayload, CapturedGridRowsPayload } from '../types'
import { normalizeApiUrlPath, getTenantFromPlmHost } from '../../../../shared/url/parse'
import { hasExtendedRequiredValidator } from '../../../../shared/form/validatorTree'
import { collectUniqueInGridFieldIdsFromValidatorsPayload } from './uniqueInGridValidators'
import {
  clearGridApiMetadataCache,
  getGridFieldsPayloadForCurrentContext,
  clearGridRowsPayloadForCurrentContext,
  getGridRowsPayloadForCurrentContext,
  getGridViewIdCandidates,
  hydrateGridFieldsForCurrentContext,
  hydrateGridRowsForCurrentContext
} from '../../grid-services/gridApiMetadata'

type ValidatorContext = {
  key: string
  request: () => Promise<Response>
  hasData: (data: unknown) => boolean
  inFlight: Map<string, Promise<boolean>>
}

/**
 * Metadata cache contract for API-backed grid fields/rows and required-validator caching.
 */
export interface GridMetadataCache {
  /**
   * Resolves ordered view-id candidates for current grid context.
   */
  getGridViewIdCandidates: (workspaceId: number, dmsId: number) => number[]
  /**
   * Hydrates fields metadata for the active grid context.
   */
  hydrateFields: () => Promise<boolean>
  /**
   * Hydrates row payload for the active grid context.
   */
  hydrateRows: () => Promise<boolean>
  /**
   * Returns the current API field-definition payload.
   */
  getGridFieldsPayloadForCurrentGrid: () => CapturedGridFieldsPayload | null
  /**
   * Returns the current API rows payload.
   */
  getGridRowsPayloadForCurrentGrid: () => CapturedGridRowsPayload | null
  /**
   * Clears row payload cache for the active grid context.
   */
  clearGridRowsForCurrentContext: () => void
  /**
   * Hydrates required validators for the provided field definitions.
   */
  hydrateRequiredValidatorsForFields: (fields: CapturedGridFieldDefinition[]) => Promise<void>
  /**
   * Evaluates whether a field definition is required using hydrated validator data.
   */
  isFieldRequired: (definition: CapturedGridFieldDefinition) => boolean
  /**
   * Clears API caches and in-flight validator state.
   */
  clear: () => void
  /**
   * Field IDs discovered from linked validator documents (same fetch as required hydration).
   */
  getHydratedUniqueInGridFieldIds: () => string[]
}

const requiredByValidatorsPath = new Map<string, boolean>()
const validatorHydrationInFlightByPath = new Map<string, Promise<boolean>>()
const uniqueInGridFieldIdsFromLinkedValidators = new Set<string>()

function getValidatorsPath(definition: CapturedGridFieldDefinition): string | null {
  const source = definition.validators
  if (typeof source === 'string') {
    const normalized = normalizeApiUrlPath(source)
    return /^\/api\/v3\//i.test(normalized) ? normalized : null
  }
  if (source && typeof source === 'object') {
    const record = source as Record<string, unknown>
    const link = String(record.link || record.__self__ || '').trim()
    if (link) {
      const normalized = normalizeApiUrlPath(link)
      return /^\/api\/v3\//i.test(normalized) ? normalized : null
    }
  }
  return null
}

async function hydrateValidator(context: ValidatorContext): Promise<boolean> {
  const existing = context.inFlight.get(context.key)
  if (existing) return existing

  const run = (async (): Promise<boolean> => {
    try {
      const response = await context.request()
      if (!response.ok) return false
      const data = (await response.json()) as unknown
      return context.hasData(data)
    } catch {
      return false
    } finally {
      context.inFlight.delete(context.key)
    }
  })()

  context.inFlight.set(context.key, run)
  return run
}

/**
 * Creates metadata cache helpers for API-backed grid fields/rows and required validators.
 */
export function createGridMetadataCache(): GridMetadataCache {
  async function hydrateRequiredValidatorsForFields(fields: CapturedGridFieldDefinition[]): Promise<void> {
    const paths = new Set<string>()
    for (const field of fields) {
      if (!field) continue
      const path = getValidatorsPath(field)
      if (!path || requiredByValidatorsPath.has(path)) continue
      paths.add(path)
    }

    if (paths.size === 0) return

    await Promise.all(
      Array.from(paths).map(async (path) => {
        if (requiredByValidatorsPath.has(path)) return
        const ok = await hydrateValidator({
          key: path,
          inFlight: validatorHydrationInFlightByPath,
          request: async () => {
            const tenant = getTenantFromPlmHost(window.location.href)
            const runtime = window.__plmExt
            if (!tenant || !runtime?.requestPlmAction) {
              return new Response(null, { status: 503 })
            }
            const data = await runtime.requestPlmAction<unknown>('fetchApiJson', {
              tenant,
              path
            })
            return new Response(JSON.stringify(data), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          },
          hasData: (data) => {
            for (const id of collectUniqueInGridFieldIdsFromValidatorsPayload(data)) {
              uniqueInGridFieldIdsFromLinkedValidators.add(id)
            }
            const isRequired = hasExtendedRequiredValidator(data)
            requiredByValidatorsPath.set(path, isRequired)
            return isRequired
          }
        })
        if (!ok && !requiredByValidatorsPath.has(path)) {
          requiredByValidatorsPath.set(path, false)
        }
      })
    )
  }

  function isFieldRequired(definition: CapturedGridFieldDefinition): boolean {
    const explicitRequired = (definition as Record<string, unknown>).required
    if (explicitRequired === true) return true
    if (hasExtendedRequiredValidator(definition.fieldValidators)) return true
    const validatorsPath = getValidatorsPath(definition)
    if (validatorsPath && requiredByValidatorsPath.has(validatorsPath)) {
      return Boolean(requiredByValidatorsPath.get(validatorsPath))
    }
    return false
  }

  function clear(): void {
    clearGridApiMetadataCache()
    requiredByValidatorsPath.clear()
    validatorHydrationInFlightByPath.clear()
    uniqueInGridFieldIdsFromLinkedValidators.clear()
  }

  return {
    getGridViewIdCandidates,
    hydrateFields: hydrateGridFieldsForCurrentContext,
    hydrateRows: hydrateGridRowsForCurrentContext,
    getGridFieldsPayloadForCurrentGrid: getGridFieldsPayloadForCurrentContext,
    clearGridRowsForCurrentContext: clearGridRowsPayloadForCurrentContext,
    getGridRowsPayloadForCurrentGrid: getGridRowsPayloadForCurrentContext,
    hydrateRequiredValidatorsForFields,
    isFieldRequired,
    clear,
    getHydratedUniqueInGridFieldIds: () => Array.from(uniqueInGridFieldIdsFromLinkedValidators)
  }
}
