import { resolveWorkspacePermissionFlags } from '../../../../extension/permissions/resolveWorkspacePermissionFlags'
import type { PermissionRuntime, WorkspacePermissionSnapshot } from '../../../../extension/permissions/workspacePermissions'

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
  const { flags, snapshot } = await resolveWorkspacePermissionFlags(ext, tenant, workspaceId, {
    canAdd: ADD_TO_GRID_PERMISSION,
    canEdit: EDIT_GRID_PERMISSION,
    canDelete: DELETE_FROM_GRID_PERMISSION
  })

  return {
    canAdd: flags.canAdd ?? false,
    canDelete: flags.canDelete ?? false,
    canEdit: flags.canEdit ?? false,
    canOpen: Boolean(flags.canAdd || flags.canEdit || flags.canDelete),
    snapshot
  }
}
