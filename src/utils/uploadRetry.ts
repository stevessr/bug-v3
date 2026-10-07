// Shared classification for direct uploads and authenticated page-proxy uploads.
export const DEFAULT_UPLOAD_RETRY_MS = 60_000

export function getUploadRetryDelay(
  payload: unknown,
  retryAfter?: unknown,
  now = Date.now()
): number | null {
  const data = payload as { extras?: { wait_seconds?: unknown }; wait_seconds?: unknown } | null
  for (const value of [data?.extras?.wait_seconds, data?.wait_seconds, retryAfter]) {
    if (value === undefined || value === null || (typeof value === 'string' && !value.trim()))
      continue
    const seconds = Number(value)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.max(1000, Math.ceil(seconds * 1000))
  }
  if (typeof retryAfter === 'string') {
    const timestamp = Date.parse(retryAfter)
    if (Number.isFinite(timestamp)) return Math.max(1000, timestamp - now)
  }
  return null
}

export function isUploadChallenge(
  status: number | undefined,
  payload: unknown,
  mitigation?: string
): boolean {
  if (status !== 403 && status !== 429) return false
  if (mitigation?.toLowerCase() === 'challenge') return true
  const text = typeof payload === 'string' ? payload : JSON.stringify(payload ?? '')
  return /just a moment|cf-chl-|challenge-platform|verify you are human/i.test(text)
}
