import { getSettings } from '@/utils/simpleStorage'
import { normalizeEmbedding, rankSemanticMatches } from '@/utils/semanticRanking'

export interface SemanticEmojiCandidate {
  id: string
  text: string
  usageCount?: number
}

export interface SemanticEmojiRequest {
  type: 'SEMANTIC_EMOJI_SEARCH'
  query: string
  items: SemanticEmojiCandidate[]
}

const MAX_CANDIDATES = 1000
const BATCH_SIZE = 64
const MAX_CACHE_SIZE = 1200
// Cache only library metadata vectors, never a user's query. MV3 worker restarts clear it.
const vectorCache = new Map<string, number[]>()

function embeddingUrl(endpoint: string): string {
  const url = new URL(endpoint.trim())
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (
    (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
    url.username || url.password || url.search || url.hash
  ) {
    throw new Error('Embedding endpoint must be HTTPS (or local HTTP), without credentials')
  }
  url.pathname = url.pathname.replace(/\/+$/, '')
  if (!url.pathname.endsWith('/embeddings')) {
    url.pathname += url.pathname.endsWith('/v1') ? '/embeddings' : '/v1/embeddings'
  }
  return url.toString()
}

async function embedBatch(
  url: string,
  model: string,
  key: string,
  texts: string[]
): Promise<number[][]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { Authorization: 'Bearer ' + key } : {})
      },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
      body: JSON.stringify({ model, input: texts })
    })
    if (!response.ok) throw new Error('Embedding provider returned HTTP ' + response.status)
    const json = await response.json()
    if (!Array.isArray(json?.data) || json.data.length !== texts.length) {
      throw new Error('Embedding provider returned an invalid response')
    }
    const vectors: Array<number[] | null> = Array(texts.length).fill(null)
    for (const entry of json.data) {
      if (!Number.isInteger(entry.index) || entry.index < 0 || entry.index >= texts.length) {
        throw new Error('Embedding provider returned an invalid index')
      }
      vectors[entry.index] = normalizeEmbedding(entry.embedding)
    }
    if (vectors.some(vector => !vector)) throw new Error('Embedding vector is invalid')
    return vectors as number[][]
  } finally {
    clearTimeout(timeout)
  }
}

function remember(key: string, vector: number[]) {
  if (vectorCache.has(key)) vectorCache.delete(key)
  vectorCache.set(key, vector)
  while (vectorCache.size > MAX_CACHE_SIZE) {
    const oldest = vectorCache.keys().next().value
    if (oldest === undefined) break
    vectorCache.delete(oldest)
  }
}

/**
 * Remote calls are permitted only after opt-in in extension settings.
 * No page content or image bytes are read here; only the explicit query and library
 * name/tag/group descriptions supplied by the picker are sent to the configured provider.
 */
export async function handleSemanticEmojiSearch(
  request: SemanticEmojiRequest,
  sendResponse: (response: { success: boolean; data?: Array<{ id: string; score: number }>; error?: string }) => void
) {
  try {
    const settings = await getSettings()
    if (!settings?.semanticSearchEnabled) {
      sendResponse({ success: false, error: '语义联想尚未启用' })
      return
    }
    const query = typeof request.query === 'string' ? request.query.trim().slice(0, 120) : ''
    if (query.length < 2 || !Array.isArray(request.items)) {
      sendResponse({ success: true, data: [] })
      return
    }
    const endpoint = embeddingUrl(settings.semanticEmbeddingEndpoint || '')
    const model = (settings.semanticEmbeddingModel || '').trim()
    const key = (settings.semanticEmbeddingApiKey || '').trim()
    if (!model || (!key && !/^http:\/\//.test(endpoint))) {
      throw new Error('请先配置 Embedding 模型和 API Key')
    }

    const candidates: SemanticEmojiCandidate[] = []
    const seen = new Set<string>()
    for (const entry of request.items.slice(0, MAX_CANDIDATES)) {
      if (typeof entry?.id !== 'string' || !entry.id || seen.has(entry.id) ||
          typeof entry.text !== 'string' || !entry.text.trim()) continue
      seen.add(entry.id)
      candidates.push({
        id: entry.id.slice(0, 200),
        text: entry.text.trim().slice(0, 160),
        usageCount: Number.isFinite(entry.usageCount) ? Math.max(0, entry.usageCount || 0) : 0
      })
    }
    if (!candidates.length) {
      sendResponse({ success: true, data: [] })
      return
    }

    const queryVector = (await embedBatch(endpoint, model, key, [query]))[0]
    const prefix = endpoint + '\u0000' + model + '\u0000'
    const missing = [...new Set(candidates.map(item => item.text))]
      .filter(text => !vectorCache.has(prefix + text))
    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE)
      const vectors = await embedBatch(endpoint, model, key, batch)
      batch.forEach((text, index) => remember(prefix + text, vectors[index]))
    }
    const ranked = rankSemanticMatches(
      query,
      queryVector,
      candidates.flatMap(item => {
        const vector = vectorCache.get(prefix + item.text)
        return vector && vector.length === queryVector.length
          ? [{ ...item, vector }]
          : []
      })
    )
    sendResponse({ success: true, data: ranked })
  } catch (error) {
    // Do not include an API key, remote response body or user's input in logs.
    sendResponse({ success: false, error: error instanceof Error ? error.message : '语义搜索失败' })
  }
}
