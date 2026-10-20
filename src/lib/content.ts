import type { ContentPlatform } from '@/lib/supabase/database.types'
import { addDaysISO } from '@/lib/time'

/** Platforms on the Content page's daily posting checklist, in display order. */
export const CHECKLIST_PLATFORMS = ['instagram', 'facebook', 'whatsapp'] as const
export type ChecklistPlatform = (typeof CHECKLIST_PLATFORMS)[number]

export const PLATFORM_LABELS: Record<ChecklistPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
}

/** Marks content_items rows created by the checklist (as opposed to a planned post). */
export const POSTING_CHECKLIST_NOTE = 'Daily posting checklist'

export function isChecklistPlatform(value: string): value is ChecklistPlatform {
  return (CHECKLIST_PLATFORMS as readonly string[]).includes(value)
}

/** True when every checklist platform was posted that day. */
export function isCompleteDay(day: string, postedByDay: Map<string, Set<ContentPlatform>>): boolean {
  return CHECKLIST_PLATFORMS.every((p) => postedByDay.get(day)?.has(p))
}

/** Longest run of consecutive complete days ever. */
export function bestStreak(postedByDay: Map<string, Set<ContentPlatform>>): number {
  const complete = Array.from(postedByDay.keys())
    .filter((day) => isCompleteDay(day, postedByDay))
    .sort()
  let best = 0
  let run = 0
  let previous: string | null = null
  for (const day of complete) {
    run = previous !== null && addDaysISO(previous, 1) === day ? run + 1 : 1
    best = Math.max(best, run)
    previous = day
  }
  return best
}

export interface PostSuggestion {
  emoji: string
  title: string
  text: string
  imageUrl: string | null
}

/** Ideas for days with nothing on the shelf and no recent sales to show off; one per day. */
const POST_IDEAS: Omit<PostSuggestion, 'imageUrl'>[] = [
  { emoji: '🎥', title: 'Behind the scenes', text: 'A short video of you mixing, baking or decorating. People love seeing how it’s made.' },
  { emoji: '💬', title: 'Share a happy customer', text: 'Screenshot a nice message or review (hide their number) and say thank you.' },
  { emoji: '🔪', title: 'The cut shot', text: 'A close-up of a slice being cut: the layers sell it better than any words.' },
  { emoji: '🛵', title: 'How to order', text: 'Remind people how easy it is: pick from the menu, send the form on WhatsApp, done. Add your menu link.' },
  { emoji: '🎁', title: 'Packed and ready', text: 'Show an order boxed up and ready for pickup or delivery.' },
  { emoji: '🗳️', title: 'Ask your followers', text: 'A poll: which flavour should come next, or which is their favourite?' },
]

/**
 * What to post today, from what the shop has right now: finished stock on the
 * shelf first (sell it while it's fresh), then the recent best seller, then a
 * general idea that changes daily.
 */
export function postSuggestion(input: {
  readyStock: { name: string; category: string | null; imageUrl: string | null; readyStock: number }[]
  bestSeller: { name: string; quantity: number } | null
  isoDate: string
}): PostSuggestion {
  const inStock = input.readyStock.filter((p) => p.readyStock > 0)
  if (inStock.length > 0) {
    const shown = inStock.slice(0, 3)
    // Same name in two categories ("Chocolate 8″"): add the category so it's clear which.
    const label = (p: (typeof shown)[number]) =>
      shown.filter((o) => o.name === p.name).length > 1 && p.category ? `${p.name} (${p.category})` : p.name
    const list = shown.map((p) => `${p.readyStock}× ${label(p)}`).join(', ')
    const more = inStock.length > shown.length ? ` and ${inStock.length - shown.length} more` : ''
    return {
      emoji: '🧁',
      title: 'Post what’s ready',
      text: `${list}${more} ready to sell. A photo today can sell them while they’re fresh.`,
      imageUrl: shown.find((p) => p.imageUrl)?.imageUrl ?? null,
    }
  }
  if (input.bestSeller && input.bestSeller.quantity > 0) {
    return {
      emoji: '🏆',
      title: 'Show off your best seller',
      text: `${input.bestSeller.name} is your best seller lately (${input.bestSeller.quantity} sold in 30 days). Remind people they can order it.`,
      imageUrl: null,
    }
  }
  const [y, m, d] = input.isoDate.split('-').map(Number)
  const dayNumber = Math.floor(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1) / 86_400_000)
  return { ...POST_IDEAS[dayNumber % POST_IDEAS.length]!, imageUrl: null }
}

/**
 * Days in a row, ending today (or yesterday, if today isn't posted yet), on
 * which every checklist platform was posted. `postedByDay` maps YYYY-MM-DD to
 * the platforms posted that day; `days` lists dates newest first.
 */
export function postingStreak(days: string[], postedByDay: Map<string, Set<ContentPlatform>>): number {
  const complete = (day: string) => CHECKLIST_PLATFORMS.every((p) => postedByDay.get(day)?.has(p))
  let streak = 0
  for (const [index, day] of days.entries()) {
    if (complete(day)) streak++
    else if (index === 0) continue // today still in progress
    else break
  }
  return streak
}
