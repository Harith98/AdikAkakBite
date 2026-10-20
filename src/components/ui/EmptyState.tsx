import Link from 'next/link'
import type { ReactNode } from 'react'
import clsx from '@/lib/clsx'

interface EmptyStateProps {
  emoji: string
  title: string
  text?: ReactNode
  action?: { href: string; label: string }
  /** Smaller, for inside a card. */
  compact?: boolean
  className?: string
}

/** A friendly "nothing here yet" with an emoji, a line of encouragement and an optional next step. */
export function EmptyState({ emoji, title, text, action, compact, className }: EmptyStateProps) {
  return (
    <div className={clsx('flex flex-col items-center text-center', compact ? 'gap-1 py-3' : 'gap-2 py-6', className)}>
      <span
        aria-hidden="true"
        className={clsx('flex items-center justify-center rounded-pill bg-base-soft', compact ? 'h-11 w-11 text-2xl' : 'h-14 w-14 text-3xl')}
      >
        {emoji}
      </span>
      <p className={clsx('font-medium text-ink', compact ? 'text-sm' : 'text-base')}>{title}</p>
      {text && <p className="max-w-xs text-sm text-ink-muted">{text}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-1 inline-flex h-10 items-center rounded-pill bg-raspberry-soft px-4 text-sm font-medium text-raspberry-dark transition-colors hover:bg-raspberry/20"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
