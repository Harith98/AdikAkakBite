import { Card } from '@/components/ui/Card'

interface ComingSoonProps {
  title: string
  phase: string
  description: string
  bullets: string[]
}

/**
 * Honest placeholder for a section whose module hasn't been built yet.
 * Per spec §59: "If a feature is not implemented, clearly label it as
 * planned/future" — never a fake screen pretending to work.
 */
export function ComingSoon({ title, phase, description, bullets }: ComingSoonProps) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <header>
        <p className="font-display text-3xl text-ink">{title}</p>
        <p className="mt-1 text-sm text-ink-muted">{description}</p>
      </header>

      <Card className="border border-dashed border-ink/15 bg-transparent shadow-none">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{phase}</p>
        <ul className="mt-3 flex flex-col gap-2">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-2.5 text-sm text-ink">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-ink-faint" />
              {bullet}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
