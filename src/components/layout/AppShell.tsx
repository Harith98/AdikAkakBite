import { type ReactNode } from 'react'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import { OfflineBanner } from './OfflineBanner'

interface AppShellProps {
  businessName?: string
  children: ReactNode
}

export function AppShell({ businessName = 'Business', children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh bg-base">
      <Sidebar businessName={businessName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <main
          className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 md:px-8 md:pb-10 md:pt-10"
          style={{ paddingBottom: 'max(6rem, env(safe-area-inset-bottom, 0px) + 5rem)' }}
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  )
}
