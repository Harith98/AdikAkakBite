import Link from 'next/link'
import type { ReactNode } from 'react'
import clsx from '@/lib/clsx'

interface LinkButtonProps {
  href: string
  children: ReactNode
  variant?: 'primary' | 'secondary'
  className?: string
}

/** A link that looks like a Button (a real <a>, so it works with navigation, not JS). */
export function LinkButton({ href, children, variant = 'primary', className }: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={clsx(
        'inline-flex h-11 items-center justify-center rounded-pill px-5 text-sm font-medium transition-colors',
        variant === 'primary'
          ? 'bg-raspberry text-white hover:bg-raspberry-dark'
          : 'border border-ink/10 bg-base-soft text-ink hover:bg-amber-soft',
        className
      )}
    >
      {children}
    </Link>
  )
}
