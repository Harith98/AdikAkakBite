import { PageSkeleton } from '@/components/ui/PageSkeleton'

// Standalone page (no app shell), so it brings its own page padding.
export default function Loading() {
  return (
    <div className="flex min-h-dvh justify-center bg-base px-4 py-6">
      <div className="w-full max-w-md">
        <PageSkeleton variant="form" />
      </div>
    </div>
  )
}
