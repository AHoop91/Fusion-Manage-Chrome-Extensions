import {
  getWorkspacePermissionSnapshot,
  hasPermissionByName,
  type PermissionRuntime,
  type WorkspacePermissionSnapshot
} from './workspacePermissions'

export async function resolveWorkspacePermissionFlags(
  ext: PermissionRuntime,
  tenant: string,
  workspaceId: number,
  namedPermissions: Record<string, string>,
  options?: { forceRefresh?: boolean }
): Promise<{ flags: Record<string, boolean>; snapshot: WorkspacePermissionSnapshot }> {
  const snapshot = await getWorkspacePermissionSnapshot(
    ext,
    { tenant, workspaceId },
    options?.forceRefresh
  )
  const flags: Record<string, boolean> = {}
  for (const [key, permissionName] of Object.entries(namedPermissions)) {
    flags[key] = hasPermissionByName(snapshot, permissionName)
  }
  return { flags, snapshot }
}
