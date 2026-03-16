import {
  getWorkspacePermissionSnapshot,
  hasPermissionByName,
  type PermissionRuntime,
  type WorkspacePermissionSnapshot
} from '../../../platform/permissions/workspacePermissions'

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
  const snapshot = await getWorkspacePermissionSnapshot(ext, { tenant, workspaceId }, forceRefresh)
  const canView = hasPermissionByName(snapshot, VIEW_BOM_PERMISSION)
  const canAdd = hasPermissionByName(snapshot, ADD_TO_BOM_PERMISSION)
  const canEdit = hasPermissionByName(snapshot, EDIT_BOM_PERMISSION)
  const canDelete = hasPermissionByName(snapshot, DELETE_FROM_BOM_PERMISSION)

  return {
    canAdd,
    canDelete,
    canEdit,
    canOpen: canAdd || canEdit || canDelete,
    canView,
    snapshot
  }
}


