import Link from 'next/link'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  /** Where "back" goes, e.g. { href: '/settings', label: 'Settings' }. */
  back?: { href: string; label: string }
  title: ReactNode
  subtitle?: ReactNode
  /** A button on the right, e.g. "Add product". */
  action?: ReactNode
  /** Anything under the title: badges, a status line. */
  children?: ReactNode
}

/** The same header on every page: back link, big title, optional subtitle, action and extras. */
export function PageHeader({ back, title, subtitle, action, children }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-2">
      {back && (
        <Link
          href={back.href}
          className="-ml-1 inline-flex w-fit items-center gap-1 rounded-pill px-2 py-1 text-sm text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <span aria-hidden="true" className="text-base leading-none">
            ‹
          </span>
          {back.label}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words font-display text-3xl leading-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </header>
  )
}
