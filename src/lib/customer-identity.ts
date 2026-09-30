// How an order's customer is identified. Phone number first (it's unique to a
// person), name as the fallback. Pure functions so the same rules run in the
// order form (live hint) and the server action (the actual save).

/**
 * A comparable key for a phone number: digits only, with Malaysian local
 * numbers ("012…") and "00" international prefixes rewritten to the full
 * country-code form ("6012…"). "012-345 6789", "+60 12-345 6789" and
 * "0060123456789" all give "60123456789".
 *
 * MUST match the generated column customers.phone_key (migration 0012).
 */
export function normalizePhone(phone: string | null | undefined, countryCode = '60'): string | null {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return null
  if (digits.startsWith('00')) return digits.slice(2) || null
  if (digits.startsWith('0')) return countryCode + digits.slice(1)
  return digits
}

/** Plausible phone length after normalising (country code included). */
export function isValidPhoneKey(key: string): boolean {
  return key.length >= 9 && key.length <= 15
}

const WALK_IN_NAMES = new Set(['walk-in', 'walk in', 'walkin', 'walk-in customer', 'walk in customer'])

/** Anonymous counter sales: no customer record is created for these. */
export function isWalkInName(name: string): boolean {
  return WALK_IN_NAMES.has(name.trim().toLowerCase())
}

export interface CustomerCandidate {
  id: string
  name: string
  phone: string | null
}

export type CustomerMatch =
  | { kind: 'existing'; id: string; name: string; /** Save this phone onto the customer (they had none). */ setPhone: boolean; matchedBy: 'phone' | 'name' }
  | { kind: 'new'; reason: 'no_match' | 'different_phone' }
  | { kind: 'anonymous' }
  | { kind: 'ambiguous'; count: number }

/**
 * Decide which customer an order belongs to.
 *
 *  1. "Walk-in" → no customer (unless the phone matches someone we know).
 *  2. Phone given and it matches a customer → that customer, whatever name
 *     was typed (names get misspelt; numbers don't).
 *  3. Phone given, no phone match:
 *       - exactly one same-name customer with NO phone → them, and save the phone
 *       - otherwise → a new customer (same name + different number = different person)
 *  4. No phone:
 *       - one same-name customer → them
 *       - several → ambiguous: ask for the phone rather than guess
 *       - none → a new customer
 */
export function resolveCustomer(input: {
  name: string
  phone: string | null
  candidates: CustomerCandidate[]
}): CustomerMatch {
  const phoneKey = normalizePhone(input.phone)
  const lowerName = input.name.trim().toLowerCase()
  const byPhone = phoneKey ? input.candidates.filter((c) => normalizePhone(c.phone) === phoneKey) : []
  const byName = input.candidates.filter((c) => c.name.trim().toLowerCase() === lowerName)

  if (byPhone.length > 0) {
    // Prefer the record whose name also matches, if a number was ever shared.
    const pick = byPhone.find((c) => c.name.trim().toLowerCase() === lowerName) ?? byPhone[0]!
    return { kind: 'existing', id: pick.id, name: pick.name, setPhone: false, matchedBy: 'phone' }
  }

  if (isWalkInName(input.name)) return { kind: 'anonymous' }

  if (phoneKey) {
    const withoutPhone = byName.filter((c) => !normalizePhone(c.phone))
    if (withoutPhone.length === 1) {
      const only = withoutPhone[0]!
      return { kind: 'existing', id: only.id, name: only.name, setPhone: true, matchedBy: 'name' }
    }
    return { kind: 'new', reason: byName.length > 0 ? 'different_phone' : 'no_match' }
  }

  if (byName.length === 1) {
    const only = byName[0]!
    return { kind: 'existing', id: only.id, name: only.name, setPhone: false, matchedBy: 'name' }
  }
  if (byName.length > 1) return { kind: 'ambiguous', count: byName.length }
  return { kind: 'new', reason: 'no_match' }
}
