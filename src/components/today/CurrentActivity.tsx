import clsx from '@/lib/clsx'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { formatTime12 } from '@/lib/time'
import type { RecommendedTask } from '@/lib/services/types'
import type { BlockProgress, ScheduleBlockLike, TaskLike } from '@/lib/services/schedule'
import { TaskRow } from './TaskRow'

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

  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Right now · {formatTime12(time)}</p>

      {block ? (
        <div className="mt-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <p className="font-display text-2xl text-ink">{block.title}</p>
            <p className="text-sm text-ink-muted">
              {formatTime12(block.startTime)} – {formatTime12(block.endTime)}
            </p>
          </div>
          {progress && <ProgressBar className="mt-3" percent={progress.percent} label={progress.label} />}
        </div>
      ) : (
        <p className="mt-2 font-display text-2xl text-ink">Nothing scheduled right now</p>
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
        block && <p className="mt-3 text-sm text-ink-muted">No tasks in this block.</p>
      )}

      {tasks.length > 0 && open === 0 && <p className="mt-2 text-sm font-medium text-sage-dark">✓ All done for this block</p>}

      {nextBlock && (
        <p className="mt-3 text-xs text-ink-faint">
          Then: {nextBlock.title} at {formatTime12(nextBlock.startTime)}
        </p>
      )}
    </Card>
  )
}
