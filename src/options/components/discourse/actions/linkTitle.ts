import { extractData, pageFetch } from '../utils'

export interface ResolvedLink {
  url: string
  title: string
}

interface InlineOneboxEntry {
  url?: unknown
  title?: unknown
}

function pickInlineOnebox(data: unknown, normalized: string): string | null {
  if (!data || typeof data !== 'object') return null
  const boxes = (data as Record<string, unknown>)['inline-oneboxes']
  if (!Array.isArray(boxes)) return null
  for (const entry of boxes as InlineOneboxEntry[]) {
    if (!entry || typeof entry !== 'object') continue
    if (typeof entry.url === 'string' && entry.url !== normalized) continue
    if (typeof entry.title === 'string' && entry.title.trim()) {
      return entry.title.trim()
    }
  }
  return null
}

function pickOneboxTitle(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  // Same extraction order as Discourse composer-title.gjs: h3/h4 heading,
  // then any element carrying a title attribute.
  const heading = doc.querySelector('h3, h4')
  const headingText = heading?.textContent?.trim()
  if (headingText) return headingText
  const attr = doc.querySelector('[title]')?.getAttribute('title')?.trim()
  return attr || null
}

/**
 * Resolve a web page title for the composer title field, mirroring Discourse's
 * own behavior when an absolute link is pasted into the topic title.
 *
 * Primary: `/inline-onebox.json` (JSON, cheap, returns titles for a batch of
 * URLs). Fallback: `/onebox` (plain HTML preview) from which Discourse's
 * composer extracts `h3/h4` text or a `[title]` attribute.
 */
export async function resolveLinkTitle(
  baseUrl: string,
  url: string,
  categoryId?: number | null
): Promise<ResolvedLink | null> {
  const normalized = url.trim()
  if (!/^https?:\/\//i.test(normalized)) return null

  try {
    const params = new URLSearchParams()
    params.set('urls[]', normalized)
    if (categoryId) params.set('category_id', String(categoryId))
    const result = await pageFetch<unknown>(
      `${baseUrl}/inline-onebox.json?${params.toString()}`,
      undefined,
      'json'
    )
    if (result.ok !== false) {
      const title = pickInlineOnebox(extractData(result), normalized)
      if (title) return { url: normalized, title }
    }
  } catch {
    // fall through to the onebox preview endpoint
  }

  try {
    const params = new URLSearchParams()
    params.set('url', normalized)
    if (categoryId) params.set('category_id', String(categoryId))
    const result = await pageFetch<string>(
      `${baseUrl}/onebox?${params.toString()}`,
      undefined,
      'text'
    )
    if (result.ok === false || typeof result.data !== 'string' || !result.data.trim()) {
      return null
    }
    const title = pickOneboxTitle(result.data)
    if (title) return { url: normalized, title }
  } catch {
    // resolution is best-effort; never block typing
  }

  return null
}
