import clsx from '@/lib/clsx'

/**
 * Placeholder shown by each route's loading.tsx while its server data loads,
 * shaped like the page that's coming (with a soft shimmer) so the layout
 * doesn't jump when it lands.
 */
type Variant = 'today' | 'list' | 'detail' | 'form' | 'receipt'

/** A shimmering grey shape. */
function Bone({ className }: { className?: string }) {
  return <div className={clsx('skeleton rounded-card', className)} />
}

function Card({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={clsx('rounded-card border border-raspberry/10 bg-base-card p-5 shadow-card', className)}>{children}</div>
}

/** Heading + a few lines, like most cards. */
function TextLines({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Bone className="h-3 w-28" />
      {Array.from({ length: lines }, (_, i) => (
        <Bone key={i} className={clsx('h-4', i % 2 ? 'w-3/5' : 'w-4/5')} />
      ))}
    </div>
  )
}

/** A list row: round picture + two lines + something on the right. */
function Row() {
  return (
    <Card className="flex items-center gap-3 !p-4">
      <Bone className="h-11 w-11 shrink-0 !rounded-pill" />
      <div className="flex flex-1 flex-col gap-2">
        <Bone className="h-4 w-2/5" />
        <Bone className="h-3 w-3/5" />
      </div>
      <Bone className="h-5 w-14" />
    </Card>
  )
}

export function PageSkeleton({ variant = 'list', back = true }: { variant?: Variant; back?: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>

      {variant === 'today' ? (
        <>
          {/* The pink greeting band with its three chips */}
          <div className="rounded-card bg-gradient-to-br from-raspberry-soft via-base-soft to-amber-soft p-5 shadow-card">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 shrink-0 rounded-card bg-white/70" />
              <div className="flex flex-1 flex-col gap-2">
                <Bone className="h-6 w-3/4 bg-white/50" />
                <Bone className="h-3 w-1/2 bg-white/50" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-16 rounded-card bg-white/60" />
              ))}
            </div>
          </div>
          {/* Ready stock strip */}
          <Card className="!px-0">
            <Bone className="mx-5 h-3 w-28" />
            <div className="mt-3 flex gap-3 overflow-hidden px-5">
              {[0, 1, 2].map((i) => (
                <Bone key={i} className="h-44 w-40 shrink-0" />
              ))}
            </div>
          </Card>
          {/* Right now, with its ring */}
          <Card className="border-l-4">
            <Bone className="h-3 w-32" />
            <div className="mt-3 flex items-center gap-3">
              <Bone className="h-12 w-12 shrink-0" />
              <div className="flex flex-1 flex-col gap-2">
                <Bone className="h-6 w-1/2" />
                <Bone className="h-3 w-1/3" />
              </div>
              <Bone className="h-14 w-14 shrink-0 !rounded-pill" />
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Bone className="h-7 w-7 shrink-0 !rounded-pill" />
                  <Bone className={clsx('h-4', i === 1 ? 'w-1/2' : 'w-2/3')} />
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : (
        <header className="flex flex-col gap-2">
          {back && <Bone className="h-4 w-20" />}
          <Bone className="h-9 w-48" />
          <Bone className="h-4 w-64 opacity-60" />
        </header>
      )}

      {variant === 'list' && (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Row key={i} />
          ))}
        </div>
      )}

      {variant === 'detail' && (
        <>
          <Card>
            <TextLines lines={4} />
          </Card>
          <Bone className="h-11 w-full !rounded-pill" />
          <Card>
            <TextLines lines={6} />
          </Card>
        </>
      )}

      {variant === 'form' && (
        <Card className="flex flex-col gap-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Bone className="h-3 w-24" />
              <Bone className="h-11 w-full" />
            </div>
          ))}
          <Bone className="h-14 w-full !rounded-pill" />
        </Card>
      )}

      {variant === 'receipt' && (
        <Card className="mx-auto flex w-full max-w-md flex-col items-center gap-3">
          <Bone className="h-14 w-14 !rounded-pill" />
          <Bone className="h-6 w-40" />
          <div className="mt-4 flex w-full flex-col gap-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex justify-between">
                <Bone className="h-4 w-1/2" />
                <Bone className="h-4 w-16" />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
