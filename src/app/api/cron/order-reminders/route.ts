import { NextResponse, type NextRequest } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { runOrderReminders } from '@/lib/notifications/order-reminders'

export const dynamic = 'force-dynamic'

/** Called once a day by Vercel Cron (see vercel.json): orders due in the next 2 days. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await runOrderReminders())
  } catch (err) {
    console.error('Order reminders failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
