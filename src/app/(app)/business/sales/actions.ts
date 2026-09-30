'use server'

import { revalidatePath } from 'next/cache'
import { getActionContext } from '@/lib/services/action-context'
import { getSalesSummary, saveDailyClose } from '@/lib/services/sales'
import { getBusinessNow } from '@/lib/time'
import { parseMoney, str } from '@/lib/validation/common'

export interface CloseDayState {
  error: string | null
  nonce: number
}

/** Records today's waste + notes and snapshots today's revenue/orders alongside it (spec §8 Closing block, §61). */
export async function closeDay(_prev: CloseDayState, formData: FormData): Promise<CloseDayState> {
  const waste = parseMoney(str(formData, 'wasteValue'), 'Waste value')
  if (!waste.ok) return { error: waste.error, nonce: 0 }
  const notes = str(formData, 'notes')
  if (notes.length > 500) return { error: 'Keep notes under 500 characters.', nonce: 0 }

  const ctx = await getActionContext()
  if (!ctx.ok) return { error: ctx.error, nonce: 0 }
  const { supabase, businessId, timezone } = ctx
  const today = getBusinessNow(timezone).isoDate

  try {
    const [summary] = await getSalesSummary(supabase, businessId, today)
    await saveDailyClose(supabase, businessId, {
      reviewDate: today,
      revenue: summary?.totals.revenue ?? 0,
      ordersCount: summary?.totals.orders ?? 0,
      wasteValue: waste.value,
      notes: notes || null,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save.', nonce: 0 }
  }

  revalidatePath('/business', 'layout')
  return { error: null, nonce: Date.now() }
}
