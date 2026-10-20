/**
 * The Today header's personality: a greeting and colour wash for the time of
 * day, and one friendly line about what the day holds. Pure, so it's tested.
 * (Tailwind classes are written out in full so they're kept in the CSS build.)
 */

export interface DayPart {
  greeting: string
  emoji: string
  /** Background gradient classes for the header. */
  wash: string
}

export function dayPart(time: string): DayPart {
  const hour = Number(time.slice(0, 2))
  if (hour >= 5 && hour < 12) {
    return { greeting: 'Good morning', emoji: '☀️', wash: 'bg-gradient-to-br from-amber-soft via-base-soft to-raspberry-soft' }
  }
  if (hour >= 12 && hour < 17) {
    return { greeting: 'Good afternoon', emoji: '🌤️', wash: 'bg-gradient-to-br from-raspberry-soft via-base-soft to-amber-soft' }
  }
  if (hour >= 17 && hour < 21) {
    return { greeting: 'Good evening', emoji: '🌇', wash: 'bg-gradient-to-br from-raspberry-soft via-[#F3E8F4] to-[#E6E9F7]' }
  }
  return { greeting: 'Good night', emoji: '🌙', wash: 'bg-gradient-to-br from-[#EDE7F6] via-[#F3EEF8] to-[#E3E8F6]' }
}

export interface DayFacts {
  overdueOrders: number
  ordersDueToday: number
  lowStock: number
  tasksDone: number
  tasksSoFar: number
  isWorkingDay: boolean
  /** YYYY-MM-DD, so the quiet-day line changes daily but not on every refresh. */
  isoDate: string
}

/** Sweet lines for quiet moments, one per day. */
const QUIET_LINES = [
  'Semanis senyuman kamu 💕',
  'Small batches, big smiles 🧁',
  'A good day to try a new flavour ✨',
  'Every order is someone’s happy moment 🎉',
  'Bake it till you make it 🍰',
  'Quiet now. Perfect time to post on Instagram 📸',
  'Sweet things take time ⏳',
]

/** One line about the day, most pressing thing first. */
export function dayHeadline(f: DayFacts): string {
  if (f.overdueOrders > 0) {
    return `⚠️ ${f.overdueOrders} order${f.overdueOrders === 1 ? ' is' : 's are'} overdue. Let’s sort ${f.overdueOrders === 1 ? 'it' : 'them'} first.`
  }
  if (f.ordersDueToday > 0) {
    return `🧾 ${f.ordersDueToday} order${f.ordersDueToday === 1 ? '' : 's'} due today. You’ve got this!`
  }
  if (!f.isWorkingDay) return 'It’s your day off. Rest up 🌿'
  if (f.lowStock > 0) {
    return `📦 ${f.lowStock} item${f.lowStock === 1 ? ' needs' : 's need'} restocking soon.`
  }
  if (f.tasksSoFar > 0 && f.tasksDone >= f.tasksSoFar) return '🎉 All caught up. Nice work!'
  if (f.tasksSoFar > 0 && f.tasksDone / f.tasksSoFar >= 0.5) return `💪 ${f.tasksDone} of ${f.tasksSoFar} done. Keep going!`
  const [y, m, d] = f.isoDate.split('-').map(Number)
  const dayNumber = Math.floor(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) / 86_400_000)
  return QUIET_LINES[dayNumber % QUIET_LINES.length]!
}
