/**
 * A readable name for a device from its browser's user-agent string, e.g.
 * "iPhone · Home Screen app" or "Android · Chrome", for the list of devices
 * with notifications on (Settings → System status).
 *
 * iPhones and iPads only allow web notifications from the app added to the
 * Home Screen, so that's what an Apple phone or tablet entry means.
 */
export function describeDevice(userAgent: string | null | undefined): string {
  const ua = userAgent ?? ''
  if (!ua) return 'Unknown device'

  const device = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /CrOS/.test(ua)
          ? 'Chromebook'
          : /Windows/.test(ua)
            ? 'Windows'
            : /Macintosh|Mac OS X/.test(ua)
              ? 'Mac'
              : /Linux/.test(ua)
                ? 'Linux'
                : 'Device'

  if (device === 'iPhone' || device === 'iPad') return `${device} · Home Screen app`

  const browser = /SamsungBrowser/.test(ua)
    ? 'Samsung Internet'
    : /Edg\//.test(ua)
      ? 'Edge'
      : /OPR\//.test(ua)
        ? 'Opera'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Chrome\//.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : null

  return browser ? `${device} · ${browser}` : device
}
