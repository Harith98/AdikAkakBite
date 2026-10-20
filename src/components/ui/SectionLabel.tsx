import type { ReactNode } from 'react'
import clsx from '@/lib/clsx'

/** A card's heading: small icon + label, so cards are told apart at a glance. */
export function SectionLabel({ icon, children, className }: { icon: string; children: ReactNode; className?: string }) {
  return (
    <p className={clsx('flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted', className)}>
      <span aria-hidden="true" className="text-sm leading-none">
        {icon}
      </span>
      {children}
    </p>
  )
}
