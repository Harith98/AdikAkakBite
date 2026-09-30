import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Supabase client for use in Server Components, Route Handlers and Server
 * Actions. Always uses the anon key + the caller's own session cookies, so
 * every query still goes through Row Level Security as that user — this is
 * NOT a service-role bypass.
 *
 * See the matching comment in client.ts: the cast below isolates a generic
 * signature mismatch between the installed @supabase/ssr (0.5.2) and
 * @supabase/supabase-js (2.117.2) to this one line. Everything downstream is
 * fully typed against `Database`.
 */
export function createClient(): SupabaseClient<Database> {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component that can't set cookies (e.g. a
            // page render, as opposed to a Route Handler/Server Action).
            // Safe to ignore as long as middleware.ts is refreshing the
            // session on every request, which it does.
          }
        },
      },
    }
  ) as unknown as SupabaseClient<Database>
}

/**
 * Service-role client. Bypasses Row Level Security entirely.
 *
 * Server-only — importing this from a Client Component would fail at build
 * time since SUPABASE_SERVICE_ROLE_KEY is not a NEXT_PUBLIC_ variable, but
 * treat that as a last line of defence, not the plan: only ever call this
 * from trusted server code (e.g. a scheduled job, or a route handler that
 * has already re-verified the request), never in response to arbitrary
 * user-triggered requests without your own authorization check first.
 *
 * Returns null when SUPABASE_SERVICE_ROLE_KEY isn't configured, so callers
 * can show a setup message instead of crashing.
 */
export function createServiceRoleClient(): SupabaseClient<Database> | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  // Plain supabase-js client: no cookies and no session of its own, so every
  // request carries the service key — which the auth.admin API requires.
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
