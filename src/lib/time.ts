/**
 * Business-timezone helpers. `now` is injectable so behaviour can be tested
 * at exact moments (e.g. just before midnight) without fake timers.
 */
export function getBusinessNow(timezone: string, now: Date = new Date()) {
  // hourCycle 'h23' guarantees 00:00–23:59 (hour12:false can yield "24:05" in some engines).
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(now)

  // en-CA formats as YYYY-MM-DD.
  const isoDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)

  const dateLabel = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now)

  // 1 (Mon) .. 7 (Sun), matching schedule_blocks/working_days convention.
  const weekdayLong = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long' }).format(now)
  const weekdayIndex = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].indexOf(
    weekdayLong
  )

  return { time, isoDate, dateLabel, isoWeekday: weekdayIndex + 1 }
}

/** Compares "HH:mm" strings lexically, which works fine for zero-padded 24h time. */
export function isTimeWithin(current: string, start: string, end: string): boolean {
  return current >= start.slice(0, 5) && current < end.slice(0, 5)
}

/** "HH:mm" or "HH:mm:ss" → minutes since midnight. */
export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':')
  return Number(hours) * 60 + Number(minutes)
}

/** "16:00" or "16:00:00" → "4:00 PM". */
export function formatTime12(value: string): string {
  const [hourStr, minuteStr] = value.split(':')
  const hour = Number(hourStr)
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 === 0 ? 12 : hour % 12
  return `${displayHour}:${(minuteStr ?? '00').slice(0, 2)} ${period}`
}

/** 45 → "45 min", 90 → "1 h 30 min", 120 → "2 h". */
export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/** Whole days from one YYYY-MM-DD date to another (negative if `to` is earlier). */
export function daysBetweenISO(from: string, to: string): number {
  const parse = (value: string) => {
    const [y, m, d] = value.split('-').map(Number)
    return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)
  }
  return Math.round((parse(to) - parse(from)) / 86_400_000)
}

/** "2026-09-28" → "Mon, 28 Sep" (date-only, so timezone can't shift it). */
export function formatDateShort(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** A YYYY-MM-DD date moved by a whole number of days (date-only, so timezone can't shift it). */
export function addDaysISO(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
