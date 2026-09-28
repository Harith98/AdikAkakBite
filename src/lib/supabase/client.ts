import { createBrowserClient, type SupabaseClient } from '@supabase/ssr'
import type { Database } from './database.types'

/**
 * Supabase client for use in Client Components ("use client").
 * Safe to call repeatedly — @supabase/ssr manages the singleton internally.
 */
export function createClient(): SupabaseClient<Database, 'public'> {
  return createBrowserClient<Database, 'public'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
