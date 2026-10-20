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

## Database changes in production

A new database is set up by running `supabase/schema.sql` once in the Supabase SQL Editor. After that, each change comes as a file in `supabase/updates/`: run it in the SQL Editor **before** deploying the code that needs it. Settings → System shows "Database: up to date" once the live database matches the code. Nothing runs automatically on deploy. See `docs/database.md`.

## HTTPS / PWA requirements

Vercel serves everything over HTTPS by default, which satisfies the PWA requirement (spec §42) with no extra configuration.

## Before going live, sanity-check

- [ ] `supabase/schema.sql` run on the production database (and any files in `supabase/updates/` newer than it)
- [ ] RLS verified with two separate test accounts/businesses (one must never see the other's data)
- [ ] `.env.local` values are not the same ones committed anywhere — production uses its own Supabase project
- [ ] Auth redirect URLs updated in Supabase to match the production domain
- [ ] `npm run build` succeeds with no type or lint errors
