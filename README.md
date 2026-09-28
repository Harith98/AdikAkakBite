# Dessert OS

An AI-ready business control centre for a small dessert business — a mobile-first PWA that answers "what should I be working on right now?" using deterministic schedules, orders, and business rules. No AI API is used or required in V1; the architecture is built so an AI layer can be added later without redesigning the database or business logic. See `docs/ai-readiness.md`.

**Status: Phase 3A — Orders, products & customers.** (Phase 2 daily operations and Phase 1 foundation are done too.) Phase 1 (auth, schema, RLS, app shell, onboarding, PWA) plus the Today screen, editable daily schedule, task controls, today's three priorities, order-priority alerts and the deterministic recommendation engine (`docs/today-engine.md`). Inventory, Sales (Phase 3B), Content, Analytics and Forecasting are still honest "coming in Phase N" placeholders — see `docs/architecture.md` for the full phase plan and section 58 of the original product spec.

## Tech stack

- **Frontend:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS
- **Backend/database:** Supabase (PostgreSQL, Auth, Row Level Security)
- **Hosting:** Vercel (recommended)

No paid AI API, no external analytics platform, no other paid third-party service is used.

## Local setup

### 1. Prerequisites

- Node.js 18.18+ and npm
- A free [Supabase](https://supabase.com) account
- The [Supabase CLI](https://supabase.com/docs/guides/cli) (optional but recommended, for running migrations locally): `npm install -g supabase`

### 2. Install dependencies

```bash
npm install
```

### 3. Set up Supabase

1. Create a new Supabase project (free tier is fine).
2. In the Supabase SQL Editor, run the migrations in `supabase/migrations/` **in order**:
   - `0001_init_schema.sql`
   - `0002_indexes.sql`
   - `0003_rls_policies.sql`
   - `0004_onboarding_membership_policy.sql`
   - `0005_task_priorities_and_ordering.sql`
   - `0006_customer_name_index.sql`

   Or, if you have the Supabase CLI linked to your project:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
3. Copy your project's URL and anon key from **Project Settings → API**.

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from step 3. Leave `SUPABASE_SERVICE_ROLE_KEY` unset unless you specifically need server-side RLS-bypass access (see the comment in `src/lib/supabase/server.ts`).

### 5. Run it

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, and complete onboarding. This creates your business, seeds the default daily schedule (product spec §8), and takes you to the Today screen.

### 6. Optional demo data

`supabase/seed_demo_data.sql` adds a handful of sample products, costs, inventory items and customers, all tagged `[DEMO]` so they're identifiable and removable later. See the comment at the top of that file for usage — you need your `business_id` first (visible in the Supabase Table Editor after onboarding).

## Development commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the local dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build locally |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Run the Vitest unit tests |
| `npm run db:types` | Regenerate `src/lib/supabase/database.types.ts` from your live Supabase schema |

Run `lint`, `typecheck`, and `test` before every commit — see `docs/architecture.md` for the full "after each phase" checklist this project is built against (spec §59).

## Testing

Phase 1 ships tests for the utilities that exist today (currency/percent formatting, schedule time-window logic) in `tests/unit/`. As each phase adds real calculations — product costing, inventory forecasting, sales comparisons, the task recommendation engine — its tests land in the same commit, covering the edge cases called out in the product spec (zero sales, no orders, insufficient history, cancelled orders, deleted products, missing optional fields).

## PWA testing

1. Run `npm run build && npm run start` (the service worker only registers in production mode — see `src/app/service-worker-registration.tsx`).
2. Open the app in Chrome/Edge on desktop or Android, or Safari on iOS.
3. **Android/desktop Chrome:** look for the install icon in the address bar, or Menu → "Install app".
4. **iOS Safari:** Share → "Add to Home Screen".
5. Confirm the app opens standalone (no browser chrome), the splash/icon look correct, and it loads instantly on a second open.

## Deploying to Vercel

See `docs/deployment.md`.

## Security

See `docs/architecture.md#security` and the RLS policies in `supabase/migrations/0003_rls_policies.sql`. In short: every business-owned table is protected by Row Level Security keyed on `business_members`, the service-role key is never exposed to the browser, and there are no secrets in this repository — only placeholders in `.env.example`.

## Future AI integration

Read `docs/ai-readiness.md` before adding any AI provider. The short version: AI explains numbers, it never calculates them.
