'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition, type ReactNode } from 'react'
import clsx from '@/lib/clsx'

export function DataLink({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <Link
      href={href}
      onClick={(event) => {
        if (isPending) {
          event.preventDefault()
          return
        }
        event.preventDefault()
        startTransition(() => {
          router.push(href)
        })
      }}
      className={clsx('relative block', className)}
      aria-busy={isPending}
    >
      {children}
      {isPending && (
        <span className="absolute inset-x-3 bottom-3 flex items-center justify-end text-[10px] font-medium uppercase tracking-[0.12em] text-raspberry">
          <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-raspberry" />
          Loading
        </span>
      )}
    </Link>
  )
}
