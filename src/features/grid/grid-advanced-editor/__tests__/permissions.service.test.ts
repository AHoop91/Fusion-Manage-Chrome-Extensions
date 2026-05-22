import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveGridAdvancedEditorPermissions } from '../services/permissions.service'

const mockedPermissions = vi.hoisted(() => ({
  getWorkspacePermissionSnapshot: vi.fn(),
  hasPermissionByName: vi.fn()
}))

vi.mock('../../../../extension/permissions/workspacePermissions', () => ({
  getWorkspacePermissionSnapshot: mockedPermissions.getWorkspacePermissionSnapshot,
  hasPermissionByName: mockedPermissions.hasPermissionByName
}))

describe('resolveGridAdvancedEditorPermissions', () => {
  beforeEach(() => {
    mockedPermissions.getWorkspacePermissionSnapshot.mockReset()
    mockedPermissions.hasPermissionByName.mockReset()
  })

  it('opens the editor when any grid permission is granted', async () => {
    const snapshot = { permissions: [] }
    mockedPermissions.getWorkspacePermissionSnapshot.mockResolvedValue(snapshot)
    mockedPermissions.hasPermissionByName.mockImplementation((_nextSnapshot: unknown, permissionName: string) => {
      return permissionName === 'permission.shortname.edit_grid'
    })

    const result = await resolveGridAdvancedEditorPermissions({} as never, 'TEST', 57)

    expect(mockedPermissions.getWorkspacePermissionSnapshot).toHaveBeenCalledWith({}, { tenant: 'TEST', workspaceId: 57 })
    expect(mockedPermissions.hasPermissionByName).toHaveBeenCalledTimes(3)
    expect(result).toEqual({
      canAdd: false,
      canDelete: false,
      canEdit: true,
      canOpen: true,
      snapshot
    })
  })

  it('returns a fully locked envelope when no permissions are granted', async () => {
    const snapshot = { permissions: [] }
    mockedPermissions.getWorkspacePermissionSnapshot.mockResolvedValue(snapshot)
    mockedPermissions.hasPermissionByName.mockReturnValue(false)

    const result = await resolveGridAdvancedEditorPermissions({} as never, 'TEST', 9)

    expect(result).toEqual({
      canAdd: false,
      canDelete: false,
      canEdit: false,
      canOpen: false,
      snapshot
    })
  })
})
