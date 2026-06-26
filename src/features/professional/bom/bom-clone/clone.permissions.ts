import { resolveWorkspacePermissionFlags } from '../../../../extension/permissions/resolveWorkspacePermissionFlags'
import {
  type PermissionRuntime,
  type WorkspacePermissionSnapshot
} from '../../../../extension/permissions/workspacePermissions'

const VIEW_BOM_PERMISSION = 'permission.shortname.view_bom'
const EDIT_BOM_PERMISSION = 'permission.shortname.edit_bom'
const ADD_TO_BOM_PERMISSION = 'permission.shortname.add_to_bom'
const DELETE_FROM_BOM_PERMISSION = 'permission.shortname.delete_from_bom'

export interface BomClonePermissions {
  canAdd: boolean
  canDelete: boolean
  canEdit: boolean
  canOpen: boolean
  canView: boolean
  snapshot?: WorkspacePermissionSnapshot
}

export function createEmptyBomClonePermissions(): BomClonePermissions {
  return {
    canAdd: false,
    canDelete: false,
    canEdit: false,
    canOpen: false,
    canView: false
  }
}

export async function resolveBomClonePermissions(
  ext: PermissionRuntime,
  tenant: string,
  workspaceId: number,
  forceRefresh = false
): Promise<BomClonePermissions> {
  const { flags, snapshot } = await resolveWorkspacePermissionFlags(
    ext,
    tenant,
    workspaceId,
    {
      canView: VIEW_BOM_PERMISSION,
      canAdd: ADD_TO_BOM_PERMISSION,
      canEdit: EDIT_BOM_PERMISSION,
      canDelete: DELETE_FROM_BOM_PERMISSION
    },
    { forceRefresh }
  )

  return {
    canAdd: flags.canAdd ?? false,
    canDelete: flags.canDelete ?? false,
    canEdit: flags.canEdit ?? false,
    canOpen: Boolean(flags.canAdd || flags.canEdit || flags.canDelete),
    canView: flags.canView ?? false,
    snapshot
  }
}
