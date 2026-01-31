import { DQS } from '@/content/utils/dom/createEl'

// Helper to POST timings to linux.do/topics/timings
// Builds form body and sends with X-CSRF-Token pulled from page
export async function postTimings(
  topicId: number,
  timings: Record<number, number> | number[]
): Promise<Response> {
  // Resolve CSRF token from common places
  function readCsrfToken(): string | null {
    try {
      const meta = DQS('meta[name="csrf-token"]') as HTMLMetaElement | null
      if (meta && meta.content) return meta.content
      const input = DQS('input[name="authenticity_token"]') as HTMLInputElement | null
      if (input && input.value) return input.value
      const match = document.cookie.match(/csrf_token=([^;]+)/)
      if (match) return decodeURIComponent(match[1])
    } catch (e) {
      console.warn('[timingsBinder] failed to read csrf token', e)
    }
    return null
  }

  const csrf = readCsrfToken() || ''

  // Normalize timings input to an object map
  const map: Record<number, number> = {}
  if (Array.isArray(timings)) {
    for (let i = 0; i < timings.length; i++) {
      map[i] = timings[i]
    }
  } else {
    for (const k of Object.keys(timings)) {
      const key = Number(k)
      if (!Number.isNaN(key)) map[key] = (timings as Record<number, number>)[key]
    }
  }

  // Build application/x-www-form-urlencoded body like timings[10]=45998&...&topic_time=47000&topic_id=960675
  const params = new URLSearchParams()
  let maxTime = 0
  for (const idxStr of Object.keys(map)) {
    const idx = Number(idxStr)
    const val = String(map[idx])
    params.append(`timings[${idx}]`, val)
    const num = Number(val)
    if (!Number.isNaN(num) && num > maxTime) maxTime = num
  }

  // Ensure topic_time present (use max timing or 0)
  params.append('topic_time', String(maxTime))
  params.append('topic_id', String(topicId))

  const host = window.location.hostname
  const url = `https://${host}/topics/timings`

  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'x-requested-with': 'XMLHttpRequest'
  }
  if (csrf) headers['x-csrf-token'] = csrf

  const MAX_RETRIES = 5
  const BASE_DELAY = 500 // ms

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const resp = await fetch(url, {
      method: 'POST',
      body: params.toString(),
      credentials: 'same-origin',
      headers
    })

    if (resp.status !== 429) {
      return resp
    }

    // status === 429 -> handle retry
    if (attempt === MAX_RETRIES) {
      // exhausted retries, return last response for caller to inspect
      return resp
    }

    // Respect Retry-After header if present (in seconds or http-date)
    const retryAfter = resp.headers.get('Retry-After')
    let waitMs = 0
    if (retryAfter) {
      const asInt = parseInt(retryAfter, 10)
      if (!Number.isNaN(asInt)) {
        waitMs = asInt * 1000
      } else {
        const date = Date.parse(retryAfter)
        if (!Number.isNaN(date)) {
          waitMs = Math.max(0, date - Date.now())
        }
      }
    }

    if (!waitMs) {
      // exponential backoff with jitter
      const exp = Math.pow(2, attempt)
      waitMs = BASE_DELAY * exp + Math.floor(Math.random() * BASE_DELAY)
    }

    // wait before retrying
    await new Promise(resolve => setTimeout(resolve, waitMs))
  }

  // unreachable but satisfy return type
  throw new Error('postTimings: unexpected execution path')
}
