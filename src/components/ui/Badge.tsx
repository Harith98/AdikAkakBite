import { type ReactNode } from 'react'
import clsx from '@/lib/clsx'

export type BadgeTone = 'neutral' | 'sage' | 'amber' | 'clay' | 'clay-solid' | 'raspberry'

interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  /** A small status dot before the label, in the badge's own colour. */
  dot?: boolean
  className?: string
}

const toneStyles: Record<BadgeTone, string> = {
  neutral: 'bg-ink/5 text-ink-muted',
  sage: 'bg-sage-soft text-sage-dark',
  amber: 'bg-amber-soft text-amber-dark',
  clay: 'bg-clay-soft text-clay-dark',
  'clay-solid': 'bg-clay text-white', // the most severe state: out of stock, overdue
  raspberry: 'bg-raspberry-soft text-raspberry-dark',
}

export function Badge({ children, tone = 'neutral', dot, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex shrink-0 items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium',
        toneStyles[tone],
        className
      )}
    >
      {dot && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}
