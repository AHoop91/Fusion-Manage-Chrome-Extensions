import { isBomPageFeatureEnabled, isGridPageFeatureEnabled } from '../../build/featureFlags'
import { getEffectiveFeatures } from '../../extension/runtime/effectiveFeatures'
import type { PlmExtRuntime } from '../../shared/runtime/types'
import type { WorkspaceFeatureTier } from '../../shared/workspace/workspaceFeatureTier'
import { fetchWorkspaceTierSnapshot } from '../../shared/workspace/workspaceFeatureTier'
import { getTenantFromPlmHost, parseWorkspaceIdFromPlmWorkspacePath } from '../../shared/url/parse'

/** Only these lazy chunks consult workspace tier; all other loaders are shared and URL-gated only. */
const TIER_GATED_LOADER_IDS = new Set(['itemDetails', 'bom'])

function isLoaderEnabledByBuildFlags(loaderId: string): boolean {
  const f = getEffectiveFeatures()
  switch (loaderId) {
    case 'itemDetails':
      return f.enableItemDetails
    case 'grid':
      return isGridPageFeatureEnabled(f)
    case 'bom':
      return isBomPageFeatureEnabled(f)
    case 'tableaus':
      return f.enableTableaus
    default:
      return true
  }
}

const tierByWorkspaceId = new Map<number, WorkspaceFeatureTier>()
/** Uppercase `systemName` from workspace API (empty if unresolved). */
const systemNameUpperByWorkspaceId = new Map<number, string>()
const tierResolveInflight = new Map<number, Promise<void>>()

async function resolveTierIntoCache(runtime: PlmExtRuntime, url: string, workspaceId: number): Promise<void> {
  const tenant = getTenantFromPlmHost(url)
  if (!tenant) {
    tierByWorkspaceId.set(workspaceId, 'professional')
    systemNameUpperByWorkspaceId.set(workspaceId, '')
    return
  }
  const snapshot = await fetchWorkspaceTierSnapshot(runtime, tenant, workspaceId)
  tierByWorkspaceId.set(workspaceId, snapshot.tier)
  systemNameUpperByWorkspaceId.set(workspaceId, snapshot.systemNameUpper)
}

/**
 * Resolves GET `/api/v3/workspaces/{id}` once per workspace and caches {@link WorkspaceFeatureTier}.
 * Call from lazy bootstrap `prepareRoute` before route matching so tier-gated loaders sync-match correctly.
 */
export async function prepareWorkspaceTierForUrl(runtime: PlmExtRuntime | undefined, url: string): Promise<void> {
  if (!runtime?.requestPlmAction) return

  const workspaceId = parseWorkspaceIdFromPlmWorkspacePath(url)
  if (workspaceId === null) return

  if (tierByWorkspaceId.has(workspaceId)) return

  let pending = tierResolveInflight.get(workspaceId)
  if (!pending) {
    pending = resolveTierIntoCache(runtime, url, workspaceId).finally(() => {
      tierResolveInflight.delete(workspaceId)
    })
    tierResolveInflight.set(workspaceId, pending)
  }

  await pending
}

export function getWorkspaceFeatureTierForCurrentUrl(url: string): WorkspaceFeatureTier {
  const workspaceId = parseWorkspaceIdFromPlmWorkspacePath(url)
  if (workspaceId === null) return 'professional'
  return tierByWorkspaceId.get(workspaceId) ?? 'professional'
}

/**
 * Returns whether a lazy page-module loader should run for the current URL.
 * Grid, tableaus, and other shared features are not tier-gated — only item-details and BOM chunks use tier.
 */
export function shouldLoadLazyModule(loaderId: string, url: string): boolean {
  if (!isLoaderEnabledByBuildFlags(loaderId)) return false
  if (!TIER_GATED_LOADER_IDS.has(loaderId)) return true

  return getWorkspaceFeatureTierForCurrentUrl(url) === 'professional'
}

/** CW_COMPONENTS-only extension surfaces (Design workspace). Requires {@link prepareWorkspaceTierForUrl} first. */
export function isCwComponentsWorkspaceForUrl(url: string): boolean {
  const workspaceId = parseWorkspaceIdFromPlmWorkspacePath(url)
  if (workspaceId === null) return false
  return systemNameUpperByWorkspaceId.get(workspaceId) === 'CW_COMPONENTS'
}
