export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

/** Anything with a FormData-style `get` (so validation is testable without a browser). */
export interface FormSource {
  get(name: string): unknown
}

export function str(form: FormSource, name: string): string {
  const value = form.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error })

/** Blank counts as 0. Accepts "1,250.50". Rejects negatives, NaN and absurd values. */
export function parseMoney(raw: string, label: string, max = 1_000_000): ParseResult<number> {
  const cleaned = raw.replace(/[,\s]/g, '')
  if (cleaned === '') return { ok: true, value: 0 }
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return fail(`${label} must be a number.`)
  if (n < 0) return fail(`${label} can't be negative.`)
  if (n > max) return fail(`${label} is too large.`)
  return { ok: true, value: Math.round((n + Number.EPSILON) * 100) / 100 }
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1))
  return date.getUTCFullYear() === y && date.getUTCMonth() === (m ?? 1) - 1 && date.getUTCDate() === d
}

export function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
