import clsx from '@/lib/clsx'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { formatTime12 } from '@/lib/time'
import type { RecommendedTask } from '@/lib/services/types'
import type { BlockProgress, ScheduleBlockLike, TaskLike } from '@/lib/services/schedule'
import { TaskRow } from './TaskRow'
import { categoryStyle } from '@/lib/category-style'

interface CurrentActivityProps {
  time: string
  block: ScheduleBlockLike | null
  blockTasks: TaskLike[]
  progress: BlockProgress | null
  recommendation: RecommendedTask
  focusTask: TaskLike | null
  /** True when an urgent order is asking for attention first. */
  deprioritized: boolean
  nextBlock: ScheduleBlockLike | null
}

/**
 * The current schedule block at a glance: where you are, how far along, and
 * its tasks. Informational — ticking a task's circle is the only action. The
 * recommended task is marked "Next" in the list instead of repeated in a panel.
 */
export function CurrentActivity({ time, block, blockTasks, progress, focusTask, deprioritized, nextBlock }: CurrentActivityProps) {
  // A recommended task from outside this block (e.g. an overdue priority) joins the list at the top.
  const outside = focusTask && !blockTasks.some((t) => t.id === focusTask.id) ? focusTask : null
  const tasks = outside ? [outside, ...blockTasks] : blockTasks
  const open = tasks.filter((t) => t.status !== 'completed' && t.status !== 'skipped').length

  const style = categoryStyle(block?.category, block?.title)
  const next = nextBlock ? categoryStyle(nextBlock.category, nextBlock.title) : null

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
          {progress && <ProgressBar className="mt-4" percent={progress.percent} label={progress.label} />}
        </div>
      ) : (
        <EmptyState compact emoji="🌿" title="Nothing scheduled right now" text="Free time. Check what's coming up, or take a breather." />
      )}

      {deprioritized && (
        <p className="mt-3 rounded-card bg-clay-soft px-3 py-2 text-sm text-clay-dark">
          An order is due soon. It&apos;s at the top of the page; these tasks will wait.
        </p>
      )}

      {tasks.length > 0 ? (
        <ul className={clsx('mt-3 flex flex-col', deprioritized && 'opacity-60')}>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              id={task.id}
              title={task.title}
              status={task.status}
              isPriority={task.dailyPriorityRank !== null}
              tag={task.id === outside?.id ? 'Overdue' : !deprioritized && task.id === focusTask?.id ? 'Next' : undefined}
            />
          ))}
        </ul>
      ) : (
        block && <p className="mt-3 text-sm text-ink-muted">No tasks in this block. Enjoy it ☕</p>
      )}

      {tasks.length > 0 && open === 0 && <p className="mt-2 text-sm font-medium text-sage-dark">✓ All done for this block</p>}

      {nextBlock && next && (
        <p className="mt-4 flex items-center gap-2 border-t border-ink/5 pt-3 text-xs text-ink-muted">
          <span aria-hidden="true" className={clsx('flex h-6 w-6 items-center justify-center rounded-pill text-sm', next.soft)}>
            {next.emoji}
          </span>
          Then <span className="font-medium text-ink">{nextBlock.title}</span> at {formatTime12(nextBlock.startTime)}
        </p>
      )}
    </Card>
  )
}
