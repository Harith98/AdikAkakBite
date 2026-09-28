# Deployment

## Vercel (recommended)

1. Push this repository to GitHub.
2. In Vercel, "Add New Project" → import the GitHub repo. Vercel auto-detects Next.js; no build configuration is required.
3. Add environment variables (Project Settings → Environment Variables), matching `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (only if/when something server-side actually needs it — see `src/lib/supabase/server.ts`)
   - `NEXT_PUBLIC_DEFAULT_CURRENCY`, `NEXT_PUBLIC_DEFAULT_TIMEZONE` (optional; fall back to MYR / Asia/Kuala_Lumpur)
4. Deploy. Vercel's free/hobby tier is sufficient for V1 (spec §5's cost-minimization requirement).
5. In your Supabase project's Auth settings, add your Vercel deployment URL (and `http://localhost:3000` for local dev) to **Redirect URLs**, so `emailRedirectTo` in the signup/magic-link flows works.

## Database migrations in production

Run new migrations against your Supabase project the same way as local setup (`docs/../README.md#3-set-up-supabase`) — either paste them into the Supabase SQL Editor, or `supabase db push` if the CLI is linked. There is no automatic migration-on-deploy step in V1; run migrations deliberately, before deploying code that depends on them.

## HTTPS / PWA requirements

Vercel serves everything over HTTPS by default, which satisfies the PWA requirement (spec §42) with no extra configuration.

## Before going live, sanity-check

- [ ] Migrations `0001`–`0006` applied, in order, to the production database
- [ ] RLS verified with two separate test accounts/businesses (one must never see the other's data)
- [ ] `.env.local` values are not the same ones committed anywhere — production uses its own Supabase project
- [ ] Auth redirect URLs updated in Supabase to match the production domain
- [ ] `npm run build` succeeds with no type or lint errors
