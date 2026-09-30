/**
 * PostgREST puts `.in(...)` values in the URL, and URLs have a length limit
 * (roughly 8 KB). A few hundred UUIDs would exceed it, so large id lists are
 * fetched in chunks. Small businesses rarely hit this — but "rarely" becomes
 * a mysterious failure a year in, so it's handled up front.
 */
export async function selectInChunks<T>(
  ids: string[],
  run: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  size = 80
): Promise<T[]> {
  const results: T[] = []
  for (let i = 0; i < ids.length; i += size) {
    const { data, error } = await run(ids.slice(i, i + size))
    if (error) throw new Error(error.message)
    results.push(...(data ?? []))
  }
  return results
}

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
