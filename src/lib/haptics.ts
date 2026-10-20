/**
 * A tiny buzz when something is ticked off. Android only: iPhones don't allow
 * websites to vibrate, so this quietly does nothing there (and on computers).
 */
export function tapFeedback() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(12)
  } catch {
    // Some browsers throw when vibration is blocked; it's only a nicety.
  }
}
