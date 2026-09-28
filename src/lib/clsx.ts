type ClassValue = string | number | null | undefined | false | Record<string, boolean | undefined>

/** Minimal classnames joiner — avoids pulling in a dependency for this alone. */
export default function clsx(...values: ClassValue[]): string {
  const classes: string[] = []
  for (const value of values) {
    if (!value) continue
    if (typeof value === 'string' || typeof value === 'number') {
      classes.push(String(value))
    } else {
      for (const key in value) {
        if (value[key]) classes.push(key)
      }
    }
  }
  return classes.join(' ')
}
