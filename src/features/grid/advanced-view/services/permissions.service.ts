import {
  getWorkspacePermissionSnapshot,
  hasPermissionByName,
  type PermissionRuntime,
  type WorkspacePermissionSnapshot
} from '../../../../platform/permissions/workspacePermissions'

const ADD_TO_GRID_PERMISSION = 'permission.shortname.add_to_grid'
const EDIT_GRID_PERMISSION = 'permission.shortname.edit_grid'
const DELETE_FROM_GRID_PERMISSION = 'permission.shortname.delete_from_grid'

/**
 * Grid advanced-editor permission envelope used by button and action gating.
 */
export interface GridAdvancedEditorPermissions {
  canAdd: boolean
  canDelete: boolean
  canEdit: boolean
  canOpen: boolean
  snapshot?: WorkspacePermissionSnapshot
}

/**
 * Resolve grid-specific permissions from workspace `/users/@me/permissions`.
 */
export async function resolveGridAdvancedEditorPermissions(
  ext: PermissionRuntime,
  tenant: string,
  workspaceId: number
): Promise<GridAdvancedEditorPermissions> {
  const snapshot = await getWorkspacePermissionSnapshot(ext, { tenant, workspaceId })
  const canAdd = hasPermissionByName(snapshot, ADD_TO_GRID_PERMISSION)
  const canEdit = hasPermissionByName(snapshot, EDIT_GRID_PERMISSION)
  const canDelete = hasPermissionByName(snapshot, DELETE_FROM_GRID_PERMISSION)

  return {
    canAdd,
    canDelete,
    canEdit,
    canOpen: canAdd || canEdit || canDelete,
    snapshot
  }
}
