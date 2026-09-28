# Architecture

## Layers

```
Database (Supabase/PostgreSQL, RLS)
  ↓
Service layer (src/lib/services) — structured, typed functions
  ↓
UI (Server Components fetch via the service layer; Client Components handle interaction)
  ↓
(Future, Phase 8) AI Provider — reads structured service-layer output, never raw rows
```

The rule that shapes this whole layering (product spec §32–34): **the database and service layer must fully answer "what should I do, how am I doing, what's likely next" using ordinary code — SQL, arithmetic, statistics — with zero AI dependency.** An AI layer, when it's eventually added, sits *on top of* this layer as an explainer/summarizer. It never becomes a second source of truth for a number the app already calculates deterministically.

## Why Next.js App Router + Supabase SSR

- Server Components fetch business data directly (via `src/lib/supabase/server.ts`), so the browser never needs a service-role key or a hand-rolled API layer for reads.
- `src/middleware.ts` + `src/lib/supabase/middleware.ts` refresh the Supabase session on every request and gate every route except `/login`, `/signup`, and static assets — auth is enforced once, centrally, rather than per-page.
- Server Actions (`'use server'` files like `src/app/onboarding/actions.ts`) handle writes without a separate REST/GraphQL layer.

## Multi-tenancy

Every business-owned table has a `business_id` column and a Row Level Security policy that checks the caller is a member of that business, via the `is_business_member()` SQL helper (`supabase/migrations/0003_rls_policies.sql`). `src/lib/services/current-business.ts` resolves "the current user's business" server-side and is the single place that logic lives — pages never query `business_members` directly.

V1 assumes one business per owner (the product spec doesn't ask for a business switcher), but the schema already supports a user belonging to multiple businesses without a migration, if that's needed later.

## Directory layout

```
src/
  app/
    (app)/            # authenticated route group — wrapped in AppShell
      today/
      orders/
      business/
      content/
      settings/
    login/, signup/    # public auth routes
    onboarding/        # first-run business setup
    api/auth/callback/ # Supabase email-confirmation / magic-link exchange
  components/
    layout/            # AppShell, Sidebar, BottomNav, NavIcon, OfflineBanner, ComingSoon
    ui/                # Button, Card, Badge, ProgressBar — small, unopinionated primitives
  lib/
    supabase/          # client/server/middleware Supabase clients + generated types
    services/          # the AI-ready structured service layer (spec §32) + AI provider stub (§33)
    time.ts, constants.ts, clsx.ts
supabase/
  migrations/          # schema, indexes, RLS — numbered, run in order
  seed_demo_data.sql   # optional, labeled, deletable demo data
tests/unit/            # Vitest; grows alongside each phase's calculations
```

## Development phases

This follows the phase plan from the original product spec (§58) exactly:

1. **Foundation** — Next.js/TS, Supabase, auth, schema, RLS, layout, PWA. *(done)*
2. **Daily operations** — Today screen, schedule, tasks, the deterministic task recommendation engine, order priority. *(done — see `docs/today-engine.md`)*
3. **Business data** — Products & costing, Orders, Customers *(3A done — see `docs/orders-products-customers.md`)*; Sales, Inventory *(3B, next)*.
4. **Content** — planner, tracking, analytics.
5. **Analytics** — dashboard, daily/weekly/monthly summaries, product/customer/inventory analytics.
6. **Forecasting** — moving average, day-of-week average, trend, inventory days-remaining, confidence indicators.
7. **Polish** — responsive/mobile QA, loading/error/empty states, performance, full test coverage.
8. **Future AI** — *not implemented*; only the interfaces in `src/lib/services/ai-provider.ts` exist.

After each phase: run `npm run typecheck`, `npm run lint`, `npm run test`, verify migrations apply cleanly to a fresh database, verify RLS with a second test user, and check both a phone-width and desktop-width viewport before moving on (spec §59).

## Design system

See `tailwind.config.ts` for the full token set. Summary: a warm, non-generic base palette (`#FFFBF5` base / `#2E1F16` ink / `#D64550` raspberry accent), Fraunces for the few "moment" headlines (the Today screen's greeting and current task), Inter for everything operational. Status color is semantic and consistent everywhere: sage = healthy/OK, amber = monitor/low, clay = reorder/urgent/negative.

## Security

- Row Level Security on every business-owned table (`supabase/migrations/0003_rls_policies.sql`).
- Supabase Auth (email/password + magic link); no third-party OAuth required in V1.
- `SUPABASE_SERVICE_ROLE_KEY` exists only as a `.env.example` placeholder and is only ever read server-side (`createServiceRoleClient()` in `src/lib/supabase/server.ts`) — it is not used anywhere in Phase 1's actual code paths yet, and should only be reached for from trusted server contexts (e.g. a future scheduled job), never from a request handler that hasn't independently re-verified the caller.
- No secrets committed — `.env.local` is git-ignored; `.env.example` holds placeholders only.
- Baseline HTTP security headers set in `next.config.js`.

## Performance

- Server Components fetch data directly, close to the database, avoiding client-side request waterfalls.
- Business-scoped indexes on every table that's filtered by `business_id`, plus the specific indexes each analytics query needs (`0002_indexes.sql`).
- Aggregation (sums, averages, comparisons) is intended to happen in SQL/service-layer code, not by pulling full tables into the browser — this is the pattern to follow starting in Phase 5.
