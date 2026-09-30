import { NextResponse, type NextRequest } from 'next/server'
import { runOrderReminders } from '@/lib/notifications/order-reminders'

export const dynamic = 'force-dynamic'

/**
 * Called once a day by Vercel Cron (see vercel.json). Vercel sends
 * "Authorization: Bearer <CRON_SECRET>" automatically when CRON_SECRET is set
 * in the project's environment variables; anything else is turned away.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json(await runOrderReminders())
  } catch (err) {
    console.error('Order reminders failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
