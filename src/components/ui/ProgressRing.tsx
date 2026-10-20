import clsx from '@/lib/clsx'

interface ProgressRingProps {
  /** 0–100 */
  percent: number
  /** Shown in the middle, e.g. "2/4" or "60%". */
  label: string
  size?: number
  /** Tailwind text-colour class for the filled arc (the arc uses currentColor). */
  colorClass?: string
  className?: string
  ariaLabel?: string
}

/** A round progress indicator that fills clockwise, with a short label inside. */
export function ProgressRing({ percent, label, size = 56, colorClass = 'text-raspberry', className, ariaLabel }: ProgressRingProps) {
  const clamped = Math.max(0, Math.min(100, percent))
  const stroke = 5
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r
  const complete = clamped >= 100

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel ?? label}
      className={clsx('relative shrink-0', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-ink/10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className={clsx('transition-[stroke-dashoffset] duration-500 ease-out', complete ? 'text-sage-dark' : colorClass)}
        />
      </svg>
      <span
        className={clsx(
          'absolute inset-0 flex items-center justify-center font-display text-sm leading-none tabular-nums',
          complete ? 'text-sage-dark' : 'text-ink'
        )}
      >
        {complete ? '✓' : label}
      </span>
    </div>
  )
}
