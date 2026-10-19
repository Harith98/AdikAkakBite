import { NextResponse, type NextRequest } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron-auth'
import { runPostingReminders } from '@/lib/notifications/posting-reminders'

export const dynamic = 'force-dynamic'

/** Called once a day by Vercel Cron (see vercel.json): the 8pm "still to post today" reminder. */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    return NextResponse.json(await runPostingReminders())
  } catch (err) {
    console.error('Posting reminders failed:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
