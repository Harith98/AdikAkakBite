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

export const MIN_PASSWORD_LENGTH = 8

// No 0/O, 1/l/I: temporary passwords get read out loud or copied by hand.
const PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * A temporary password for a new or reset account, e.g. "Kq7m-Xt3r-P9wa".
 * 12 random characters (~68 bits) from crypto.getRandomValues — works both in
 * the browser ("Generate" button) and on the server (password reset).
 */
export function generateTempPassword(): string {
  const bytes = new Uint32Array(12)
  globalThis.crypto.getRandomValues(bytes)
  const chars = Array.from(bytes, (b) => PASSWORD_ALPHABET[b % PASSWORD_ALPHABET.length])
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((group) => group.join('')).join('-')
}

/** Owners and admins can edit business settings and the daily schedule. */
export function canManageBusiness(role: BusinessMemberRole): boolean {
  return role === 'owner' || role === 'admin'
}

/** Can `actor` add, re-role, reset or remove someone holding `target`? */
export function canManageRole(actor: BusinessMemberRole, target: BusinessMemberRole): boolean {
  if (actor === 'owner') return target === 'admin' || target === 'staff'
  if (actor === 'admin') return target === 'staff'
  return false
}

/** Roles `actor` may give when adding someone or changing a role. */
export function assignableRoles(actor: BusinessMemberRole): BusinessMemberRole[] {
  return (['admin', 'staff'] as const).filter((role) => canManageRole(actor, role))
}

export function isMemberRole(value: string): value is BusinessMemberRole {
  return value === 'owner' || value === 'admin' || value === 'staff'
}
