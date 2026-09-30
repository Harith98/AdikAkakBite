import { describe, it, expect } from 'vitest'
import { isValidPhoneKey, isWalkInName, normalizePhone, resolveCustomer, type CustomerCandidate } from '@/lib/customer-identity'

const aina1: CustomerCandidate = { id: 'a1', name: 'Aina', phone: '012-345 6789' }
const aina2: CustomerCandidate = { id: 'a2', name: 'aina', phone: '019-888 7777' }
const ainaNoPhone: CustomerCandidate = { id: 'a3', name: 'Aina', phone: null }
const ben: CustomerCandidate = { id: 'b1', name: 'Ben', phone: '+60 11-2222 3333' }

describe('normalizePhone', () => {
  it('gives one key for every common way of writing a Malaysian number', () => {
    for (const p of ['012-345 6789', '0123456789', '+60 12-345 6789', '60123456789', '0060123456789']) {
      expect(normalizePhone(p)).toBe('60123456789')
    }
  })

  it('returns null for empty input', () => {
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(' - ')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
  })

  it('rejects implausibly short or long numbers', () => {
    expect(isValidPhoneKey(normalizePhone('012')!)).toBe(false)
    expect(isValidPhoneKey(normalizePhone('012-345 6789')!)).toBe(true)
  })
})

describe('resolveCustomer', () => {
  it('matches by phone even when the name is typed differently', () => {
    const r = resolveCustomer({ name: 'Aina Rahman', phone: '+60123456789', candidates: [aina1, aina2, ben] })
    expect(r).toMatchObject({ kind: 'existing', id: 'a1', matchedBy: 'phone' })
  })

  it('treats the same name with a different phone as a different person', () => {
    const r = resolveCustomer({ name: 'Aina', phone: '017-000 0000', candidates: [aina1, aina2] })
    expect(r).toEqual({ kind: 'new', reason: 'different_phone' })
  })

  it('adds the phone to the only same-name customer who has none', () => {
    const r = resolveCustomer({ name: 'aina', phone: '017-000 0000', candidates: [aina1, ainaNoPhone] })
    expect(r).toMatchObject({ kind: 'existing', id: 'a3', setPhone: true })
  })

  it('uses the name alone when it is unique', () => {
    expect(resolveCustomer({ name: 'ben', phone: null, candidates: [aina1, ben] })).toMatchObject({ kind: 'existing', id: 'b1' })
  })

  it('refuses to guess between customers who share a name', () => {
    expect(resolveCustomer({ name: 'Aina', phone: null, candidates: [aina1, aina2] })).toEqual({ kind: 'ambiguous', count: 2 })
  })

  it('creates a new customer for an unknown name', () => {
    expect(resolveCustomer({ name: 'Chloe', phone: null, candidates: [aina1] })).toEqual({ kind: 'new', reason: 'no_match' })
  })

  it('keeps walk-ins anonymous unless their phone is already known', () => {
    expect(isWalkInName(' Walk-In ')).toBe(true)
    expect(resolveCustomer({ name: 'Walk-in', phone: null, candidates: [] })).toEqual({ kind: 'anonymous' })
    expect(resolveCustomer({ name: 'Walk-in', phone: '0112222 3333', candidates: [ben] })).toMatchObject({ kind: 'existing', id: 'b1' })
  })
})
