import clsx from '@/lib/clsx'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { formatTime12 } from '@/lib/time'
import type { RecommendedTask } from '@/lib/services/types'
import type { BlockProgress, ScheduleBlockLike, TaskLike } from '@/lib/services/schedule'
import { TaskControls } from './TaskControls'
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

export function CurrentActivity({
  time,
  block,
  blockTasks,
  progress,
  recommendation,
  focusTask,
  deprioritized,
  nextBlock,
}: CurrentActivityProps) {
  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Right now · {formatTime12(time)}</p>

      {block ? (
        <div className="mt-2">
          <p className="font-display text-2xl text-ink">{block.title}</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {formatTime12(block.startTime)} – {formatTime12(block.endTime)}
          </p>
          {progress && <ProgressBar className="mt-3" percent={progress.percent} label={progress.label} />}
        </div>
      ) : (
        <p className="mt-2 font-display text-2xl text-ink">Nothing scheduled right now</p>
      )}

      {/* What to do next, and why (spec §12). */}
      <div className="mt-4 rounded-card bg-base-soft p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
          {deprioritized ? 'Order first' : 'Next up'}
        </p>
        <p className="mt-1 text-lg font-medium text-ink">{recommendation.title}</p>
        <p className="mt-1 text-sm text-ink-muted">{recommendation.reason}</p>
        {!deprioritized && focusTask && <TaskControls taskId={focusTask.id} status={focusTask.status} />}
      </div>

      {deprioritized && (
        <p className="mt-3 text-sm text-ink-muted">
          Your normal tasks are still here and will be waiting when the order is done.
        </p>
      )}

      {blockTasks.length > 0 && (
        <ul className={clsx('mt-4 flex flex-col', deprioritized && 'opacity-60')}>
          {blockTasks.map((task) => (
            <TaskRow
              key={task.id}
              id={task.id}
              title={task.title}
              status={task.status}
              isPriority={task.dailyPriorityRank !== null}
            />
          ))}
        </ul>
      )}

      {nextBlock && (
        <p className="mt-4 text-xs text-ink-faint">
          Then: {nextBlock.title} at {formatTime12(nextBlock.startTime)}
        </p>
      )}
    </Card>
  )
}
