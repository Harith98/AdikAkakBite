import { describe, it, expect } from 'vitest'
import { assignableRoles, canManageBusiness, canManageRole } from '@/lib/team'

describe('team permissions', () => {
  it('owners manage admins and staff, never other owners', () => {
    expect(canManageRole('owner', 'admin')).toBe(true)
    expect(canManageRole('owner', 'staff')).toBe(true)
    expect(canManageRole('owner', 'owner')).toBe(false)
  })

  it('admins manage staff only', () => {
    expect(canManageRole('admin', 'staff')).toBe(true)
    expect(canManageRole('admin', 'admin')).toBe(false)
    expect(canManageRole('admin', 'owner')).toBe(false)
  })

  it('staff manage nobody', () => {
    expect(canManageRole('staff', 'staff')).toBe(false)
    expect(assignableRoles('staff')).toEqual([])
  })

  it('assignable roles never include owner', () => {
    expect(assignableRoles('owner')).toEqual(['admin', 'staff'])
    expect(assignableRoles('admin')).toEqual(['staff'])
  })

  it('only owners and admins manage business settings', () => {
    expect(canManageBusiness('owner')).toBe(true)
    expect(canManageBusiness('admin')).toBe(true)
    expect(canManageBusiness('staff')).toBe(false)
  })
})
