'use client'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="max-w-2xl">
      <Card>
        <p className="font-display text-2xl text-ink">Something went wrong</p>
        <p className="mt-2 text-sm text-ink-muted">
          {error.message || 'We couldn’t load this page.'} Your data is safe — this is a display problem, not a lost change.
        </p>
        <Button className="mt-4" onClick={reset}>
          Try again
        </Button>
      </Card>
    </div>
  )
}
