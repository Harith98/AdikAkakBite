import { cookies } from 'next/headers'
import { createServerClient, type SupabaseClient } from '@supabase/ssr'
import type { Database } from './database.types'

/**
 * Supabase client for use in Server Components, Route Handlers and Server
 * Actions. Always uses the anon key + the caller's own session cookies, so
 * every query still goes through Row Level Security as that user — this is
 * NOT a service-role bypass.
 */
export function createClient(): SupabaseClient<Database, 'public'> {
  const cookieStore = cookies()

  return createServerClient<Database, 'public'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
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
  )
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
 */
export function createServiceRoleClient(): SupabaseClient<Database, 'public'> {
  return createServerClient<Database, 'public'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // Service-role client is not tied to a user session.
        },
      },
    }
  )
}
