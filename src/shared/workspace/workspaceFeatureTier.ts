import type { PlmExtRuntime } from '../runtime/types'

/** Workspace API shape used only for tier detection (GET `/api/v3/workspaces/{id}`). */
export type WorkspaceTierMetadata = {
  systemName?: string
}

/** `design` only for CW_COMPONENTS / CW_DRAWINGS; all other cases are `professional`. */
export type WorkspaceFeatureTier = 'design' | 'professional'

export type WorkspaceTierSnapshot = {
  tier: WorkspaceFeatureTier
  /** Uppercase trimmed `systemName` from API, or empty string if unknown. */
  systemNameUpper: string
}

/**
 * Returns whether `systemName` is one of the Fusion Design workspace types (case-insensitive).
 */
export function isDesignWorkspaceSystemName(systemName: string): boolean {
  const upper = systemName.trim().toUpperCase()
  return upper === 'CW_COMPONENTS' || upper === 'CW_DRAWINGS'
}

/**
 * Single GET `/api/v3/workspaces/{id}` for tier + raw workspace kind (e.g. CW_COMPONENTS-only UI).
 */
export async function fetchWorkspaceTierSnapshot(
  runtime: Pick<PlmExtRuntime, 'requestPlmAction'>,
  tenant: string,
  workspaceId: number
): Promise<WorkspaceTierSnapshot> {
  try {
    const data = await runtime.requestPlmAction<WorkspaceTierMetadata>('fetchApiJson', {
      tenant,
      path: `/api/v3/workspaces/${workspaceId}`
    })
    const systemName = typeof data?.systemName === 'string' ? data.systemName.trim() : ''
    const systemNameUpper = systemName.toUpperCase()
    const tier: WorkspaceFeatureTier = isDesignWorkspaceSystemName(systemName) ? 'design' : 'professional'
    return { tier, systemNameUpper }
  } catch {
    return { tier: 'professional', systemNameUpper: '' }
  }
}
