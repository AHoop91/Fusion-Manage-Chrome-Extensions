import type { FeatureFlagKey } from '../../build/featureFlagKeys'
import { FEATURE_FLAG_KEYS } from '../../build/featureFlagKeys'
import { FEATURES } from '../../build/featureFlags'
import { mergeBuildWithRuntimeOverrides, setEffectiveFeatures } from './effectiveFeatures'

export const RUNTIME_FEATURE_OVERRIDES_STORAGE_KEY = 'plmExt_runtimeFeatureOverrides'

/** Legacy key — still removed by {@link clearRuntimeFeatureStorage} so old profiles do not retain junk. */
const LEGACY_TOGGLE_HISTORY_KEY = 'plmExt_runtimeFeatureToggleHistory'

function isChromeStorageAvailable(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.local)
}

function handleStorageUnavailable(error: unknown): void {
  if (error instanceof Error && error.message.includes('Extension context invalidated')) return
  throw error
}

async function getLocalStorageValue(key: string): Promise<Record<string, unknown> | null> {
  if (!isChromeStorageAvailable()) return null
  try {
    // Cast needed: chrome types declare the key-array overload as `never[]`, but the runtime accepts `string[]`
    return await (chrome.storage.local.get as (keys: string[]) => Promise<Record<string, unknown>>)([key])
  } catch (error) {
    handleStorageUnavailable(error)
    return null
  }
}

async function setLocalStorageValue(values: Record<string, unknown>): Promise<void> {
  if (!isChromeStorageAvailable()) return
  try {
    await chrome.storage.local.set(values)
  } catch (error) {
    handleStorageUnavailable(error)
  }
}

async function removeLocalStorageValues(keys: string[]): Promise<void> {
  if (!isChromeStorageAvailable()) return
  try {
    await chrome.storage.local.remove(keys)
  } catch (error) {
    handleStorageUnavailable(error)
  }
}

function sanitizeOverrides(raw: unknown): Partial<Record<FeatureFlagKey, boolean>> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const out: Partial<Record<FeatureFlagKey, boolean>> = {}
  for (const key of FEATURE_FLAG_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(raw, key)) continue
    const v = (raw as Record<string, unknown>)[key]
    if (typeof v === 'boolean') {
      out[key] = v
    }
  }
  return out
}

/**
 * Load overrides from storage and refresh {@link getEffectiveFeatures}.
 */
export async function initRuntimeFeaturesFromStorage(): Promise<void> {
  const bag = await getLocalStorageValue(RUNTIME_FEATURE_OVERRIDES_STORAGE_KEY)
  if (!bag) {
    setEffectiveFeatures(mergeBuildWithRuntimeOverrides(FEATURES, {}))
    return
  }

  const overrides = sanitizeOverrides(bag[RUNTIME_FEATURE_OVERRIDES_STORAGE_KEY])
  setEffectiveFeatures(mergeBuildWithRuntimeOverrides(FEATURES, overrides))
}

export async function getRuntimeFeatureOverridesFromStorage(): Promise<Partial<Record<FeatureFlagKey, boolean>>> {
  const bag = await getLocalStorageValue(RUNTIME_FEATURE_OVERRIDES_STORAGE_KEY)
  if (!bag) return {}
  return sanitizeOverrides(bag[RUNTIME_FEATURE_OVERRIDES_STORAGE_KEY])
}

/**
 * Persist one flag. Does not refresh in-memory effective flags in other extension contexts
 * unless they listen for storage changes (item pages dispatch a route re-apply after reload).
 */
export async function persistRuntimeFeatureToggle(key: FeatureFlagKey, value: boolean): Promise<void> {
  const bag = await getLocalStorageValue(RUNTIME_FEATURE_OVERRIDES_STORAGE_KEY)
  if (!bag) return
  const prev = sanitizeOverrides(bag[RUNTIME_FEATURE_OVERRIDES_STORAGE_KEY])
  const nextOverrides: Partial<Record<FeatureFlagKey, boolean>> = { ...prev, [key]: value }

  await setLocalStorageValue({
    [RUNTIME_FEATURE_OVERRIDES_STORAGE_KEY]: nextOverrides
  })
}

/**
 * Clear runtime overrides (restore build defaults in storage). Also drops legacy toggle-history data if present.
 */
export async function clearRuntimeFeatureStorage(): Promise<void> {
  await removeLocalStorageValues([RUNTIME_FEATURE_OVERRIDES_STORAGE_KEY, LEGACY_TOGGLE_HISTORY_KEY])
}
