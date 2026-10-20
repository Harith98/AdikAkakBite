'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import clsx from '@/lib/clsx'
import { NAV_ITEMS } from '@/lib/constants'
import { NavIcon } from './NavIcon'

/**
 * Mobile navigation, fixed to the bottom of the screen. The current tab sits in
 * a pink pill with a filled icon. Large touch targets, padded for the iOS
 * home-indicator safe area.
 */
export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/8 bg-base-card/95 shadow-[0_-4px_16px_rgba(46,31,22,0.06)] backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Primary"
    >
      <ul className="flex items-stretch justify-between px-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={clsx(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                  isActive ? 'text-raspberry-dark' : 'text-ink-muted'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                <span
                  className={clsx(
                    'flex h-8 w-14 items-center justify-center rounded-pill transition-all duration-200',
                    isActive ? 'bg-raspberry-soft' : 'bg-transparent'
                  )}
                >
                  <NavIcon name={item.icon} active={isActive} />
                </span>
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
