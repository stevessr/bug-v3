import { addEmojisToMap, clearEmojiMap, type EmojiShortcode } from '../bbcode'
import { pageFetch, extractData } from '../utils'

let currentOrigin: string | null = null
let loadingPromise: Promise<number> | null = null

const normalizeEmojiUrl = (origin: string, url?: string | null) => {
  if (!url) return ''
  try {
    return new URL(url, origin).toString()
  } catch {
    return url
  }
}

export async function ensureEmojiShortcodesLoaded(baseUrl?: string | null): Promise<number> {
  if (!baseUrl) return 0

  let origin = ''
  try {
    origin = new URL(baseUrl).origin
  } catch {
    return 0
  }

  if (currentOrigin !== origin) {
    currentOrigin = origin
    clearEmojiMap()
    loadingPromise = null
  }

  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    const response = await pageFetch<any>(
      `${origin}/emojis.json`,
      {
        headers: {
          accept: 'application/json, text/javascript, */*; q=0.01',
          'X-Requested-With': 'XMLHttpRequest'
        }
      },
      'json'
    )

    const data = extractData(response)
    if (!response.ok || !data || typeof data !== 'object') return 0

    const list: EmojiShortcode[] = []

    Object.values(data).forEach(group => {
      if (!Array.isArray(group)) return
      group.forEach((item: any) => {
        const name = item?.name
        if (!name) return
        const url = normalizeEmojiUrl(origin, item.url || item.image_url || item.sprite_url)
        if (!url) return
        list.push({
          name,
          id: String(item.id ?? name),
          url,
          width: typeof item.width === 'number' ? item.width : undefined,
          height: typeof item.height === 'number' ? item.height : undefined
        })
      })
    })

    if (list.length > 0) {
      addEmojisToMap(list)
    }

    return list.length
  })().finally(() => {
    loadingPromise = null
  })

  return loadingPromise
}
