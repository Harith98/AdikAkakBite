// ============================================================================
// AI Provider abstraction (spec §33) — NOT implemented in V1.
//
// This interface exists purely so the rest of the app can be written against
// a stable shape from day one. Nothing in V1 calls these methods. When a
// future version adds AI, it will:
//   1. Implement AiProvider (e.g. a ClaudeAiProvider using the Anthropic API).
//   2. Feed it structured output from the analytics service layer
//      (src/lib/services/types.ts) — never raw database rows, and never let
//      it compute numbers itself (spec §34).
//   3. Swap getAiProvider() below to return that implementation.
//
// Until then, getAiProvider() returns a disabled provider whose methods
// resolve to `null`/explanatory placeholders, so any UI that optimistically
// calls them degrades gracefully instead of breaking. The rest of the
// application must never assume an AI provider is available — see spec §55.
// ============================================================================

import type {
  BusinessHealthIndicator,
  PeriodSummary,
  SalesForecast,
} from './types'

export interface AiProvider {
  readonly isEnabled: boolean

  generateBusinessSummary(input: { summary: PeriodSummary }): Promise<string | null>

  generateRecommendation(input: {
    health: BusinessHealthIndicator[]
  }): Promise<string | null>

  explainForecast(input: { forecast: SalesForecast }): Promise<string | null>

  generateContentIdeas(input: { productNames: string[] }): Promise<string[] | null>

  answerBusinessQuestion(input: { question: string }): Promise<string | null>
}

class DisabledAiProvider implements AiProvider {
  readonly isEnabled = false

  async generateBusinessSummary() {
    return null
  }

  async generateRecommendation() {
    return null
  }

  async explainForecast() {
    return null
  }

  async generateContentIdeas() {
    return null
  }

  async answerBusinessQuestion() {
    return null
  }
}

/**
 * Returns the active AI provider. Always returns the disabled provider in
 * V1 — there is intentionally no environment variable or config flag that
 * turns this on yet, per the "no AI dependency" requirement (spec §55).
 */
export function getAiProvider(): AiProvider {
  return new DisabledAiProvider()
}
