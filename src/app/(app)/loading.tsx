export default function Loading() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-56 rounded-card bg-ink/10" />
      <div className="grid grid-cols-3 gap-3">
        <div className="h-20 rounded-card bg-ink/5" />
        <div className="h-20 rounded-card bg-ink/5" />
        <div className="h-20 rounded-card bg-ink/5" />
      </div>
      <div className="h-64 rounded-card bg-ink/5" />
    </div>
  )
}
