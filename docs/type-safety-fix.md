# Restoring type safety (fixed alongside Phase 3B)

## What was wrong
Several files (`action-context.ts`, `today.ts`, `orders.ts`, `customers.ts`, `products.ts`, plus a handful of
`as any` casts in `orders/actions.ts` and `products/actions.ts`) had the `Database` generic stripped from the
Supabase client, replaced with `any`. This made every database call in those files untyped — a typo'd column
name or a wrong argument type would compile silently and only surface at runtime, or not at all.

## Root cause, confirmed against the real installed packages
This project's `package.json` originally specified `@supabase/supabase-js": "^2.45.4"`. Caret ranges mean every
fresh `npm install` — including Vercel's — resolves to the *latest* version matching that range, and by the
time this was installed it had drifted to **2.117.2**, a large jump in which `SupabaseClient`'s generic type
signature changed. Meanwhile `@supabase/ssr@0.5.2`'s `createServerClient`/`createBrowserClient` are still typed
against the *older*, simpler 3-parameter `SupabaseClient<Database, SchemaName, Schema>` shape. The two packages'
type signatures no longer line up, so TypeScript refused to assign the client's return value to a properly typed
variable — a real, reproducible compiler error, not a false alarm. `next build` on Vercel runs this same check
by default, which is what was actually failing.

This was confirmed by running the real TypeScript compiler in this project's own `node_modules` (not a
approximation) — see the exact error shape by temporarily reverting the fix below and running
`npm run typecheck`.

## The fix
1. **Pinned exact versions** in `package.json` — `"@supabase/supabase-js": "2.117.2"` and
   `"@supabase/ssr": "0.5.2"` (no `^`) — so every install, everywhere, resolves to the same versions and this
   can't silently drift again.
2. **Isolated the mismatch to one line per client**, in `client.ts`, `server.ts` and `middleware.ts`: the
   Supabase call is cast once, immediately, to the type this codebase actually wants
   (`as unknown as SupabaseClient<Database>`), with a comment explaining exactly why. Every call site downstream
   — every `.from('table')...` in every service, action and page — is fully type-checked against `Database`
   again. This is different in kind from the previous fix: instead of `any` spreading through business logic,
   the untyped surface is exactly one line in three files, and it's documented so it isn't mistaken for
   carelessness later.
3. **Restored explicit types** for the `setAll` cookie callbacks in `server.ts`/`middleware.ts`, which needed
   annotating once the surrounding context stopped being implicitly `any`.

Verified clean with a real `tsc --noEmit` run against this project's actual installed packages: **0 errors**.
Also verified with real ESLint: 0 errors (1 pre-existing warning, unrelated, about `<img>` on the login page).

## If you upgrade either package later
Re-run `npm run typecheck`. If a future `@supabase/ssr` release updates its generics to match modern
`@supabase/supabase-js`, the `as unknown as SupabaseClient<Database>` casts in `client.ts`/`server.ts` will
likely become unnecessary — safe to remove them and re-check.
