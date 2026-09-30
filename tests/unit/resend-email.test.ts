import { describe, it, expect } from 'vitest'
import { friendlyEmailError } from '@/components/auth/ResendEmailButton'

describe('friendlyEmailError', () => {
  it('turns the per-address cooldown into a clear wait time', () => {
    expect(friendlyEmailError('For security purposes, you can only request this after 42 seconds.')).toBe(
      'Please wait 42 seconds before asking for another email.'
    )
  })

  it('explains the project-wide email limit', () => {
    expect(friendlyEmailError('email rate limit exceeded')).toMatch(/Too many emails/)
  })

  it('points people without an account to their invite link', () => {
    expect(friendlyEmailError('Signups not allowed for otp')).toMatch(/invite link/)
  })

  it('passes anything else through unchanged', () => {
    expect(friendlyEmailError('Invalid login credentials')).toBe('Invalid login credentials')
  })
})
