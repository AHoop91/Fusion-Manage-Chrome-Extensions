import type { PlmExtRuntime } from '../../shared/runtime/types'

export interface WorkspacePermission {
  deleted?: boolean
  link?: string
  name?: string
  title?: string
  type?: string
  urn?: string
}

export interface WorkspacePermissionSnapshot {
  permissions: WorkspacePermission[]
  tenant: string
  workspaceId: number
  dmsId: number | null
}

export interface WorkspacePermissionContext {
  dmsId?: number | null
  tenant: string
  workspaceId: number
}

export type PermissionRuntime = Pick<PlmExtRuntime, 'requestPlmAction'>

type PermissionsActionResponse = {
  data?: unknown
  permissions?: unknown
}

const permissionSnapshotCache = new Map<string, WorkspacePermissionSnapshot>()
const permissionInflightCache = new Map<string, Promise<WorkspacePermissionSnapshot>>()

function toCacheKey(context: WorkspacePermissionContext): string {
  return `${context.tenant.toUpperCase()}:${context.workspaceId}:${context.dmsId ?? ''}`
}

function toWorkspacePermissions(raw: unknown): WorkspacePermission[] {
  const list = Array.isArray(raw) ? raw : []
  const permissions: WorkspacePermission[] = []
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    permissions.push({
      deleted: Boolean(record.deleted),
      link: typeof record.link === 'string' ? record.link : undefined,
      name: typeof record.name === 'string' ? record.name : undefined,
      title: typeof record.title === 'string' ? record.title : undefined,
      type: typeof record.type === 'string' ? record.type : undefined,
      urn: typeof record.urn === 'string' ? record.urn : undefined
    })
  }
  return permissions
}

export async function getWorkspacePermissionSnapshot(
  ext: PermissionRuntime,
  context: WorkspacePermissionContext,
  forceRefresh = false
): Promise<WorkspacePermissionSnapshot> {
  const key = toCacheKey(context)

  if (!forceRefresh) {
    const cached = permissionSnapshotCache.get(key)
    if (cached) return cached

    const inflight = permissionInflightCache.get(key)
    if (inflight) return inflight
  }

  const request = (async (): Promise<WorkspacePermissionSnapshot> => {
    const response = await ext.requestPlmAction<PermissionsActionResponse>('getPermissions', {
      dmsId: context.dmsId ?? undefined,
      tenant: context.tenant,
      wsId: context.workspaceId
    })

    const payload = response?.data ?? response?.permissions ?? []
    const snapshot: WorkspacePermissionSnapshot = {
      dmsId: context.dmsId ?? null,
      permissions: toWorkspacePermissions(payload),
      tenant: context.tenant,
      workspaceId: context.workspaceId
    }

    permissionSnapshotCache.set(key, snapshot)
    return snapshot
  })()

  permissionInflightCache.set(key, request)

  try {
    return await request
  } finally {
    permissionInflightCache.delete(key)
  }
}

export function hasPermissionByName(snapshot: WorkspacePermissionSnapshot | null, permissionName: string): boolean {
  if (!snapshot || !permissionName.trim()) return false
  const expected = permissionName.trim().toLowerCase()
  for (const permission of snapshot.permissions) {
    if (permission.deleted) continue
    const current = String(permission.name || '').trim().toLowerCase()
    if (current && current === expected) return true
  }
  return false
}

export function clearWorkspacePermissionSnapshot(context?: WorkspacePermissionContext): void {
  if (!context) {
    permissionSnapshotCache.clear()
    permissionInflightCache.clear()
    return
  }

  const key = toCacheKey(context)
  permissionSnapshotCache.delete(key)
  permissionInflightCache.delete(key)
}

