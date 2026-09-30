import type { BusinessMemberRole } from '@/lib/supabase/database.types'

// Mirrors the SQL helpers in migration 0009 (can_manage_business /
// can_manage_role). The database enforces these rules; this copy only decides
// which buttons the UI shows, so a mismatch fails safe (a hidden button, or a
// refused write) rather than granting access.

export const ROLE_LABELS: Record<BusinessMemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  staff: 'Staff',
}

export const ROLE_DESCRIPTIONS: Record<BusinessMemberRole, string> = {
  owner: 'Full access, including managing admins',
  admin: 'Settings, daily schedule and managing staff',
  staff: 'Day-to-day work: Today, orders, products, inventory, customers, sales',
}

export const INVITE_EXPIRY_DAYS = 7

/** Owners and admins can edit business settings and the daily schedule. */
export function canManageBusiness(role: BusinessMemberRole): boolean {
  return role === 'owner' || role === 'admin'
}

/** Can `actor` invite, re-role or remove someone holding `target`? */
export function canManageRole(actor: BusinessMemberRole, target: BusinessMemberRole): boolean {
  if (actor === 'owner') return target === 'admin' || target === 'staff'
  if (actor === 'admin') return target === 'staff'
  return false
}

/** Roles `actor` may hand out in an invitation or role change. */
export function assignableRoles(actor: BusinessMemberRole): BusinessMemberRole[] {
  return (['admin', 'staff'] as const).filter((role) => canManageRole(actor, role))
}

export function isMemberRole(value: string): value is BusinessMemberRole {
  return value === 'owner' || value === 'admin' || value === 'staff'
}
