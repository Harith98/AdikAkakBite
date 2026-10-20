import clsx from '@/lib/clsx'

/** A person's profile photo, or the first letter of their name on pink when there's none. */
export function Avatar({ url, name, size = 48, className }: { url: string | null; name: string; size?: number; className?: string }) {
  const style = { width: size, height: size }
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" style={style} className={clsx('shrink-0 rounded-pill bg-base-soft object-cover', className)} />
    )
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...style, fontSize: size * 0.42 }}
      className={clsx('flex shrink-0 items-center justify-center rounded-pill bg-raspberry-soft font-display text-raspberry-dark', className)}
    >
      {(name.trim().charAt(0) || '?').toUpperCase()}
    </span>
  )
}
