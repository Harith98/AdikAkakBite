export default function Loading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading business data">
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-raspberry" />
        <span>Loading business data…</span>
      </div>

      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded-card bg-ink/10" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-20 rounded-card bg-ink/5" />
          <div className="h-20 rounded-card bg-ink/5" />
          <div className="h-20 rounded-card bg-ink/5" />
        </div>
        <div className="h-52 rounded-card bg-ink/5" />
      </div>
    </div>
  )
}
