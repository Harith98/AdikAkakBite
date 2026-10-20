import { describe, it, expect } from 'vitest'
import { cronLevel, formatBytes, missingMigrations, supabaseProjectRef, usageLevel } from '@/lib/system-status'

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

  it('lists migrations that are missing', () => {
    const applied = Object.fromEntries(['0008', '0009', '0010', '0011', '0012', '0013', '0014', '0015', '0016'].map((id) => [id, true]))
    expect(missingMigrations(applied).map((m) => m.id)).toEqual(['0017', '0018', '0019', '0020', '0021', '0022'])
  })

  it('reads the Supabase project ref from its URL', () => {
    expect(supabaseProjectRef('https://jdmyjdumxstirwzwinnu.supabase.co')).toBe('jdmyjdumxstirwzwinnu')
    expect(supabaseProjectRef('http://localhost:54321')).toBeNull()
  })
})
