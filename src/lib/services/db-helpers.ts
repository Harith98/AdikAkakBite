/** Escapes % _ and \ so a name can be matched literally with ILIKE. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/** Buckets rows by key in one pass, so joining children to parents is O(n) rather than O(parents × children). */
export function groupBy<T, K>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>()
  for (const row of rows) {
    const k = key(row)
    const bucket = groups.get(k)
    if (bucket) bucket.push(row)
    else groups.set(k, [row])
  }
  return groups
}

/**
 * PostgREST returns an embedded to-one relation as an object, but falls back
 * to an array if it can't prove the relationship is one-to-one. Accept both.
 */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/** Supabase returns at most this many rows per request, silently cutting off the rest. */
export const PAGE_SIZE = 1000

/**
 * Every row of a query, fetched PAGE_SIZE at a time, so a growing table is never
 * silently cut off at Supabase's row limit. The query MUST have a fully fixed
 * order (end with a unique column such as id), or rows can be skipped or
 * repeated between pages.
 */
export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const batch = (data ?? []) as T[]
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) return rows
  }
}

/** True when a database function doesn't exist yet (its update file hasn't been run). */
export function isMissingFunction(error: { code?: string; message: string } | null | undefined): boolean {
  return Boolean(error && (error.code === 'PGRST202' || /could not find the function/i.test(error.message)))
}
