import clsx from '@/lib/clsx'

/**
 * Placeholder shown by each route's loading.tsx while its server data loads,
 * shaped like the page that's coming so the layout doesn't jump when it lands.
 */
type Variant = 'today' | 'list' | 'detail' | 'form' | 'receipt'

function Bar({ className }: { className?: string }) {
  return <div className={clsx('rounded-card bg-ink/10', className)} />
}

function Block({ className }: { className?: string }) {
  return <div className={clsx('rounded-card border border-raspberry/10 bg-base-card shadow-card', className)} />
}

export function PageSkeleton({ variant = 'list', back = true }: { variant?: Variant; back?: boolean }) {
  return (
    <div className="flex max-w-2xl animate-pulse flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <header className="flex flex-col gap-2">
        {back && <Bar className="h-4 w-20" />}
        <Bar className="h-9 w-48" />
        <Bar className="h-4 w-64 bg-ink/5" />
      </header>

      {variant === 'today' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Block className="h-20" />
            <Block className="h-20" />
            <Block className="h-20" />
          </div>
          <Block className="h-56" />
          <Block className="h-40" />
        </>
      )}

      {variant === 'list' && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Block key={i} className="h-24" />
          ))}
        </div>
      )}

      {variant === 'detail' && (
        <>
          <Block className="h-40" />
          <Block className="h-14" />
          <Block className="h-72" />
        </>
      )}

      {variant === 'form' && <Block className="h-96" />}

      {variant === 'receipt' && <Block className="mx-auto h-[32rem] w-full max-w-md" />}
    </div>
  )
}
