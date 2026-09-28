# AI Readiness

**Read this before adding any AI provider.**

## V1 has no AI, on purpose

There is no OpenAI/Gemini/Claude/any other AI API key anywhere in this codebase, and nothing in the application depends on one existing. Every dashboard, summary, forecast, and recommendation in V1 comes from ordinary code: SQL queries, arithmetic, and basic statistics (moving averages, day-of-week averages, trend comparisons). See `docs/forecasting.md` for how the non-AI forecasting works.

This isn't a temporary shortcut — it's the intended design. The app must be fully useful with zero AI dependency, forever, even after AI is added (spec §55).

## The philosophy

```
V1 = Collect clean business data → Calculate → Analyse → Summarize → Visualize
V2 = Add AI on top of the existing structured business data
```

## The contract a future AI provider must honor

**AI explains. It never calculates.** Specifically, an AI provider must never be asked to compute:

- Revenue, profit, or margins
- Inventory quantities or days-remaining
- Forecast numbers
- Customer counts or any other aggregate

Those numbers always come from the service layer (`src/lib/services/`), which talks to PostgreSQL directly. What AI *can* do, once implemented, is take a number the service layer already computed and put it in plain language — e.g. turning `revenueChangePercent: 14.2` into "Revenue increased 14.2% compared with last week, primarily because Saturday orders increased" (spec §34's own example).

## How to actually add it later

1. **Implement `AiProvider`** (`src/lib/services/ai-provider.ts`) — e.g. a `ClaudeAiProvider` that calls the Anthropic API. The interface already defines the methods the rest of the app expects: `generateBusinessSummary`, `generateRecommendation`, `explainForecast`, `generateContentIdeas`, `answerBusinessQuestion`.
2. **Feed it structured data only.** The types in `src/lib/services/types.ts` (`PeriodSummary`, `SalesForecast`, `BusinessHealthIndicator`, etc.) are the intended payload shape — summarized numbers, not raw database rows. Never send an AI provider the whole database, or more than it needs for the specific question being asked (spec §57).
3. **Swap `getAiProvider()`** to return your new implementation instead of `DisabledAiProvider`.
4. **Make it opt-in and event-driven**, not automatic:
   - Never call it on every page load.
   - Only run it when the user explicitly requests it, a scheduled summary is due, or a meaningful event needs explaining.
   - Add configurable usage limits before shipping it broadly.
5. **Keep the disabled path working.** `DisabledAiProvider.isEnabled` is `false` and every method resolves to `null`. Any UI that calls into `AiProvider` must already handle a `null` response gracefully — that's what makes the analytics system "remain functional if the AI provider is unavailable" (spec §33), whether that's because it hasn't been built yet, the API is down, or a business has it turned off.

## What AI is meant to add, when it arrives (not yet built)

From the original product spec (§56) — these are all *future* layers on top of the data this app already collects:

- AI Business Summary — "Explain my business performance this week."
- AI Recommendations — "What should I focus on today?"
- AI Forecast Explanation — "Why is next week's forecast lower?"
- AI Content Generation — "Give me three TikTok ideas."
- AI Customer Insights — "Which customers should I follow up with?"
- AI Business Q&A — "Which product makes the most profit?"
- AI Inventory Recommendations — "What ingredients should I purchase?"

Every one of these becomes more useful the longer the business uses V1's deterministic tracking — that accumulated structured history is the actual asset. Build the foundation first; AI comes later.
