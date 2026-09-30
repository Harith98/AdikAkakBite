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
