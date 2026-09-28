import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessContext } from '@/lib/services/current-business'
import { formatTime12 } from '@/lib/time'
import { Card } from '@/components/ui/Card'
import { ScheduleBlockForm } from '@/components/settings/ScheduleBlockForm'
import type { Database } from '@/lib/supabase/database.types'

export default async function SchedulePage() {
  const { business } = await getCurrentBusinessContext()
  const supabase = createClient()

  const { data: blocks, error } = await supabase
    .from('schedule_blocks')
    .select('*')
    .eq('business_id', business.id)
    .order('start_time', { ascending: true })
  if (error) throw new Error(`Could not load your schedule: ${error.message}`)

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <Link href="/settings" className="text-sm text-ink-muted">
          ← Settings
        </Link>
        <p className="mt-2 font-display text-3xl text-ink">Daily schedule</p>
        <p className="mt-1 text-sm text-ink-muted">
          These blocks repeat every working day and drive the Today screen. Changes apply to tasks created
          from now on — tasks already created for today stay as they are.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {(blocks ?? []).map((block: Database['public']['Tables']['schedule_blocks']['Row']) => (
          <details key={block.id} className="rounded-card bg-base-card shadow-card open:pb-4">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3">
              <span>
                <span className="block text-sm font-medium text-ink">{block.title}</span>
                <span className="block text-xs text-ink-muted">
                  {formatTime12(block.start_time)} – {formatTime12(block.end_time)}
                  {!block.is_active && ' · inactive'}
                </span>
              </span>
              <span className="text-xs text-ink-faint">Edit</span>
            </summary>
            <div className="px-5">
              <ScheduleBlockForm
                block={{
                  id: block.id,
                  title: block.title,
                  category: block.category,
                  startTime: block.start_time.slice(0, 5),
                  endTime: block.end_time.slice(0, 5),
                  defaultTasks: block.default_tasks,
                  isActive: block.is_active,
                }}
              />
            </div>
          </details>
        ))}
        {(blocks ?? []).length === 0 && (
          <Card>
            <p className="text-sm text-ink-muted">No blocks yet. Add your first one below.</p>
          </Card>
        )}
      </div>

      <Card>
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">Add a block</p>
        <ScheduleBlockForm />
      </Card>
    </div>
  )
}
