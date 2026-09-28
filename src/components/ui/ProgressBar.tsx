import clsx from '@/lib/clsx'

interface ProgressBarProps {
  /** 0–100 */
  percent: number
  tone?: 'raspberry' | 'sage' | 'amber'
  className?: string
  label?: string
}

export function ProgressBar({ percent, tone = 'raspberry', className, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div className={className}>
      {label && <div className="mb-1.5 text-xs text-ink-muted">{label}</div>}
      <div
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-pill bg-ink/8"
      >
        <div
          className={clsx(
            'h-full rounded-pill transition-[width] duration-300',
            tone === 'raspberry' && 'bg-raspberry',
            tone === 'sage' && 'bg-sage',
            tone === 'amber' && 'bg-amber'
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}
