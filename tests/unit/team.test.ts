import { describe, it, expect } from 'vitest'
import { assignableRoles, canManageBusiness, canManageRole, generateTempPassword, MIN_PASSWORD_LENGTH } from '@/lib/team'

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

describe('generateTempPassword', () => {
  it('is long enough, grouped for reading aloud, and free of look-alike characters', () => {
    const password = generateTempPassword()
    expect(password).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/)
    expect(password.length).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH)
    expect(password).not.toMatch(/[0O1lI]/)
  })

  it('is different every time', () => {
    const passwords = new Set(Array.from({ length: 50 }, () => generateTempPassword()))
    expect(passwords.size).toBe(50)
  })
})
