import { type ReactNode } from 'react'
import clsx from '@/lib/clsx'

type Tone = 'neutral' | 'sage' | 'amber' | 'clay' | 'raspberry'

interface BadgeProps {
  children: ReactNode
  tone?: Tone
  className?: string
}

const toneStyles: Record<Tone, string> = {
  neutral: 'bg-ink/5 text-ink-muted',
  sage: 'bg-sage-soft text-sage-dark',
  amber: 'bg-amber-soft text-amber-dark',
  clay: 'bg-clay-soft text-clay-dark',
  raspberry: 'bg-raspberry-soft text-raspberry-dark',
}

export function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium',
        toneStyles[tone],
        className
      )}
    >
      {children}
    </span>
  )
}
