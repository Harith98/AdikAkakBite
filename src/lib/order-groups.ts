/**
 * Groups active orders by when they're due, relative to today, for the Orders
 * list and the "Coming up" card on Today. Pure: dates are YYYY-MM-DD strings.
 */
import { addDaysISO, daysBetweenISO, formatDateShort } from '@/lib/time'

export type DueGroupKey = 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'later' | 'no_date'

export interface DueGroup<T> {
  key: DueGroupKey
  label: string
  orders: T[]
}

const LABELS: Record<DueGroupKey, string> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  this_week: 'Next 7 days',
  next_week: 'The week after',
  later: 'Later',
  no_date: 'No date set',
}
const ORDER: DueGroupKey[] = ['overdue', 'today', 'tomorrow', 'this_week', 'next_week', 'later', 'no_date']

export function dueGroupOf(requiredDate: string | null, today: string): DueGroupKey {
  if (!requiredDate) return 'no_date'
  const days = daysBetweenISO(today, requiredDate)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days <= 7) return 'this_week'
  if (days <= 14) return 'next_week'
  return 'later'
}

/** Non-empty groups in time order; orders inside keep the order they came in (due date, then time). */
export function groupOrdersByDue<T extends { requiredDate: string | null }>(orders: T[], today: string): DueGroup<T>[] {
  const groups = new Map<DueGroupKey, T[]>()
  for (const order of orders) {
    const key = dueGroupOf(order.requiredDate, today)
    groups.set(key, [...(groups.get(key) ?? []), order])
  }
  return ORDER.filter((key) => groups.has(key)).map((key) => ({ key, label: LABELS[key], orders: groups.get(key)! }))
}

export interface UpcomingDay<T> {
  date: string
  /** "Tomorrow · Wed, 21 Oct" or "Fri, 23 Oct". */
  label: string
  orders: T[]
}

/** Orders due from tomorrow through `days` days ahead, one entry per day that has any. */
export function upcomingByDay<T extends { requiredDate: string | null }>(orders: T[], today: string, days = 7): UpcomingDay<T>[] {
  const last = addDaysISO(today, days)
  const byDate = new Map<string, T[]>()
  for (const order of orders) {
    const date = order.requiredDate
    if (!date || date <= today || date > last) continue
    byDate.set(date, [...(byDate.get(date) ?? []), order])
  }
  return Array.from(byDate.keys())
    .sort()
    .map((date) => ({
      date,
      label: daysBetweenISO(today, date) === 1 ? `Tomorrow · ${formatDateShort(date)}` : formatDateShort(date),
      orders: byDate.get(date)!,
    }))
}
