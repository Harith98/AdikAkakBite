import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Supabase client for use in Client Components ("use client").
 * Safe to call repeatedly — @supabase/ssr manages the singleton internally.
 *
 * The cast below is deliberate, and isolated to this one line: @supabase/ssr
 * 0.5.2's createBrowserClient<Database>() is typed against an older, simpler
 * SupabaseClient<Database, SchemaName, Schema> shape (3 type params). The
 * installed @supabase/supabase-js (2.117.2) has since changed that class's
 * generic signature, so TypeScript sees the two as structurally different
 * instantiations and refuses the assignment even though they're the same
 * class at runtime. Recast once here to the type this codebase actually
 * wants, and every call site downstream (every `.from('table')...`) gets
 * full, real type-checking against `Database` — nothing past this line is
 * untyped. Re-check this cast (and its twin in server.ts) after upgrading
 * either package; if a future @supabase/ssr release fixes the generic
 * mismatch, this cast becomes unnecessary and safe to remove.
 */
export function createClient(): SupabaseClient<Database> {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as unknown as SupabaseClient<Database>
}
