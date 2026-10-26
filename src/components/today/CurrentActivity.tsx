import Link from 'next/link'
import clsx from '@/lib/clsx'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { formatTime12 } from '@/lib/time'
import type { BlockProgress, ScheduleBlockLike } from '@/lib/services/schedule'
import { categoryStyle } from '@/lib/category-style'

interface CurrentActivityProps {
  time: string
  block: ScheduleBlockLike | null
  /** Time-based: how far into the block we are. */
  progress: BlockProgress | null
  /** The rest of the day: the next block, then the one after. */
  upcoming: ScheduleBlockLike[]
  /** When an order is due soon, e.g. "Sharifah's order is due at 5:00 PM.", so it comes first. */
  orderFirst: string | null
}

/**
 * The timetable at a glance: what this time of day is for, how long is left,
 * and what comes next. Nothing to tick: the block's tasks are shown as ideas.
 */
export function CurrentActivity({ time, block, progress, upcoming, orderFirst }: CurrentActivityProps) {
  const style = categoryStyle(block?.category, block?.title)
  const ideas = block?.ideas ?? []

  return (
    <Card className={clsx('!border-l-4', style.stripe)}>
      <SectionLabel icon="⏱️">Right now · {formatTime12(time)}</SectionLabel>

      {block ? (
        <div className="mt-3">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className={clsx('flex h-12 w-12 shrink-0 items-center justify-center rounded-card text-2xl', style.soft)}>
              {style.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-2xl leading-tight text-ink">{block.title}</p>
              <p className={clsx('text-sm font-medium', style.text)}>
                {formatTime12(block.startTime)} – {formatTime12(block.endTime)}
              </p>
            </div>
          </div>

          {progress && (
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-pill bg-ink/10" role="meter" aria-valuenow={progress.percent} aria-valuemin={0} aria-valuemax={100} aria-label={progress.label}>
                <div className={clsx('h-full rounded-pill bg-current transition-[width]', style.accent)} style={{ width: `${Math.max(progress.percent, 2)}%` }} />
              </div>
              <p className="mt-1 text-xs text-ink-muted">{progress.label}</p>
            </div>
          )}

          {ideas.length > 0 && (
            <p className="mt-3 text-sm text-ink-muted">
              <span className="font-medium text-ink">Ideas for this time:</span> {ideas.join(' · ')}
            </p>
          )}
        </div>
      ) : (
        <EmptyState compact emoji="🌿" title="Nothing scheduled right now" text="Free time. Check what's coming up, or take a breather." />
      )}

      {orderFirst && (
        <Link href="#orders-due" className="mt-3 block rounded-card bg-clay-soft px-3 py-2 text-sm text-clay-dark">
          ⚠️ {orderFirst} Do that first.
        </Link>
      )}

      {upcoming.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1.5 border-t border-ink/5 pt-3">
          {upcoming.map((b, i) => {
            const s = categoryStyle(b.category, b.title)
            return (
              <li key={b.id} className="flex items-center gap-2 text-xs text-ink-muted">
                <span className="w-9 shrink-0 font-medium uppercase tracking-wide text-ink-faint">{i === 0 ? 'Next' : 'Later'}</span>
                <span aria-hidden="true" className={clsx('flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-sm', s.soft)}>
                  {s.emoji}
                </span>
                <span className="font-medium text-ink">{b.title}</span>
                <span>· {formatTime12(b.startTime)}</span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
