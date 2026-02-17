const sleep = async (ms: number) => {
  if (!ms) return
  await new Promise(resolve => setTimeout(resolve, ms))
}

const getHeaderValue = (headers: any, key: string): string | null => {
  if (!headers) return null
  const lowerKey = key.toLowerCase()

  if (typeof headers.get === 'function') {
    return headers.get(lowerKey) || headers.get(key) || null
  }

  const value = headers[key] ?? headers[lowerKey]
  return typeof value === 'string' ? value : null
}

const getRetryDelayMs = (error: any, attempt: number): number | null => {
  const status = error?.status ?? error?.statusCode
  const name = typeof error?.name === 'string' ? error.name : ''
  const message = typeof error?.message === 'string' ? error.message : ''

  const isRateLimit = status === 429 || name === 'RateLimitError' || /429|rate limit/i.test(message)
  const isTransientStreamError =
    /stream ended without producing a Message with role=assistant/i.test(message) ||
    /request ended without sending any chunks/i.test(message)
  const isServerError = typeof status === 'number' && status >= 500

  if (!isRateLimit && !isTransientStreamError && !isServerError) return null

  const retryAfter = getHeaderValue(error?.headers, 'retry-after')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds > 0) {
      return Math.min(seconds * 1000, 30000)
    }
  }

  const base = 1000
  const maxDelay = 8000
  const backoff = Math.min(base * 2 ** attempt, maxDelay)
  const jitter = Math.floor(Math.random() * 250)
  const quick = 500 + Math.floor(Math.random() * 500)

  return (isTransientStreamError ? quick : backoff) + jitter
}

export const buildRetryMessage = (attempt: number, delayMs: number, error: any) =>
  error?.status === 429 || /429|rate limit/i.test(String(error?.message || ''))
    ? `请求过于频繁，${delayMs}ms 后重试（${attempt}/3）…`
    : `连接中断，${delayMs}ms 后重试（${attempt}/3）…`

export const withRateLimitRetry = async <T>(
  task: () => Promise<T>,
  onRetry?: (attempt: number, delayMs: number, error: any) => void,
  maxRetries = 2
): Promise<T> => {
  let attempt = 0

  while (true) {
    try {
      return await task()
    } catch (error: any) {
      const delayMs = getRetryDelayMs(error, attempt)
      if (delayMs === null || attempt >= maxRetries) {
        throw error
      }

      onRetry?.(attempt + 1, delayMs, error)
      await sleep(delayMs)
      attempt += 1
    }
  }
}
