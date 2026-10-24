/** Formats a duration as m:ss.s, e.g. 0:03.2. */
export function formatTime(ms: number): string {
  const seconds = ms / 1000
  return `0:${seconds.toFixed(1).padStart(4, '0')}`
}
