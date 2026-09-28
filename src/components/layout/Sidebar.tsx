'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from '@/lib/clsx'
import { NAV_ITEMS } from '@/lib/constants'
import { NavIcon } from './NavIcon'

interface SidebarProps {
  businessName?: string
}

export function Sidebar({ businessName = 'Business' }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-ink/8 bg-base-card px-4 py-6 md:flex">
      <div className="px-2 pb-8">
        <p className="font-display text-lg leading-tight text-ink">{businessName}</p>
        <p className="text-xs text-ink-muted">Business control centre</p>
      </div>
      <nav aria-label="Primary" className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={clsx(
                'flex items-center gap-3 rounded-card px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-raspberry-soft text-raspberry' : 'text-ink-muted hover:bg-base-soft hover:text-ink'
              )}
            >
              <NavIcon name={item.icon} active={isActive} />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
