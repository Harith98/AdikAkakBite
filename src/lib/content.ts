import type { ContentPlatform } from '@/lib/supabase/database.types'

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
