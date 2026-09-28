'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from '@/lib/clsx'
import { NAV_ITEMS } from '@/lib/constants'
import { NavIcon } from './NavIcon'

/**
 * Mobile navigation, fixed to the bottom of the screen. Large touch targets
 * per spec §44, and padded for the iOS home-indicator safe area.
 */
export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/8 bg-base-card/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Primary"
    >
      <ul className="flex items-stretch justify-between">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={clsx(
                  'flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium',
                  isActive ? 'text-raspberry' : 'text-ink-muted'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <NavIcon name={item.icon} active={isActive} />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
