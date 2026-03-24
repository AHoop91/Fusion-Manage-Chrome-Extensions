import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyBomClonePermissions, resolveBomClonePermissions } from '../clone.permissions'

const mockedPermissions = vi.hoisted(() => ({
  getWorkspacePermissionSnapshot: vi.fn(),
  hasPermissionByName: vi.fn()
}))

vi.mock('../../../../platform/permissions/workspacePermissions', () => ({
  getWorkspacePermissionSnapshot: mockedPermissions.getWorkspacePermissionSnapshot,
  hasPermissionByName: mockedPermissions.hasPermissionByName
}))

describe('bom/clone.permissions', () => {
  beforeEach(() => {
    mockedPermissions.getWorkspacePermissionSnapshot.mockReset()
    mockedPermissions.hasPermissionByName.mockReset()
  })

  it('creates a fully locked empty permission envelope', () => {
    expect(createEmptyBomClonePermissions()).toEqual({
      canAdd: false,
      canDelete: false,
      canEdit: false,
      canOpen: false,
      canView: false
    })
  })

  it('resolves BOM permissions and opens when any mutating permission exists', async () => {
    const snapshot = { permissions: [] }
    mockedPermissions.getWorkspacePermissionSnapshot.mockResolvedValue(snapshot)
    mockedPermissions.hasPermissionByName.mockImplementation((_nextSnapshot: unknown, permissionName: string) => {
      return permissionName === 'permission.shortname.view_bom'
        || permissionName === 'permission.shortname.add_to_bom'
    })

    const result = await resolveBomClonePermissions({} as never, 'TEST', 57, true)

    expect(mockedPermissions.getWorkspacePermissionSnapshot).toHaveBeenCalledWith({}, { tenant: 'TEST', workspaceId: 57 }, true)
    expect(mockedPermissions.hasPermissionByName).toHaveBeenCalledTimes(4)
    expect(result).toEqual({
      canAdd: true,
      canDelete: false,
      canEdit: false,
      canOpen: true,
      canView: true,
      snapshot
    })
  })

  it('keeps clone closed when the user can only view the BOM', async () => {
    const snapshot = { permissions: [] }
    mockedPermissions.getWorkspacePermissionSnapshot.mockResolvedValue(snapshot)
    mockedPermissions.hasPermissionByName.mockImplementation((_nextSnapshot: unknown, permissionName: string) => {
      return permissionName === 'permission.shortname.view_bom'
    })

    const result = await resolveBomClonePermissions({} as never, 'TEST', 9)

    expect(result).toEqual({
      canAdd: false,
      canDelete: false,
      canEdit: false,
      canOpen: false,
      canView: true,
      snapshot
    })
  })
})
