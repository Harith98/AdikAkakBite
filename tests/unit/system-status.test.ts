import { describe, it, expect } from 'vitest'
import { cronLevel, formatBytes, schemaCheck, SCHEMA_VERSION, supabaseProjectRef, usageLevel } from '@/lib/system-status'

describe('system status helpers', () => {
  it('grades usage against a limit', () => {
    expect(usageLevel(100, 500)).toBe('ok')
    expect(usageLevel(360, 500)).toBe('warn')
    expect(usageLevel(460, 500)).toBe('critical')
  })

  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(9.6 * 1024 * 1024)).toBe('9.6 MB')
    expect(formatBytes(500 * 1024 * 1024)).toBe('500 MB')
  })

  it('flags a daily job that stopped running', () => {
    const now = new Date('2026-10-20T12:00:00Z')
    expect(cronLevel('2026-10-20T00:10:00Z', now)).toBe('ok')
    expect(cronLevel('2026-10-19T00:10:00Z', now)).toBe('warn')
    expect(cronLevel('2026-10-17T00:10:00Z', now)).toBe('critical')
    expect(cronLevel(null, now)).toBe('warn')
  })

  it('checks the database version', () => {
    expect(schemaCheck(SCHEMA_VERSION).level).toBe('ok')
    expect(schemaCheck(SCHEMA_VERSION + 1).level).toBe('ok')
    expect(schemaCheck(SCHEMA_VERSION - 1).level).toBe('critical')
    expect(schemaCheck(null).level).toBe('critical')
  })

  it('reads the Supabase project ref from its URL', () => {
    expect(supabaseProjectRef('https://abcdefghijklmnopqrst.supabase.co')).toBe('abcdefghijklmnopqrst')
    expect(supabaseProjectRef('http://localhost:54321')).toBeNull()
  })
})
