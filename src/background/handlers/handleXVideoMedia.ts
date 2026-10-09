/**
 * Resolve X/Twitter's progressive MP4 URL instead of downloading an MSE blob
 * or a silent HLS track. Uses the public syndication endpoint (public tweets
 * only); no private GraphQL keys, user cookies or third-party proxy.
 */
import type { MessageResponse, XVideoMediaMessage } from '@/types/messages'

interface Variant {
  url?: unknown
  content_type?: unknown
  bitrate?: unknown
}
interface Media {
  type?: unknown
  video_info?: { variants?: Variant[] }
  variants?: Variant[]
}
interface TweetResult {
  user?: { screen_name?: string }
  mediaDetails?: Media[]
  video?: Media
}

const TWEET_ID = /^\d{15,22}$/

export function syndicationToken(tweetId: string): string {
  return ((Number(tweetId) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '')
}

export function isTwimgMp4(raw: string): boolean {
  try {
    const url = new URL(raw)
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'video.twimg.com' || url.hostname.endsWith('.twimg.com')) &&
      /\.mp4$/i.test(url.pathname)
    )
  } catch {
    return false
  }
}

/** Highest bitrate progressive MP4 for each video/GIF, in tweet media order. */
export function extractMp4Videos(data: TweetResult): string[] {
  const result: string[] = []
  const mediaList = Array.isArray(data.mediaDetails) ? data.mediaDetails : []

  const addMedia = (media: Media | undefined) => {
    if (!media) return
    const variants = media.video_info?.variants || media.variants || []
    const mp4s = variants
      .filter(
        (variant): variant is Variant & { url: string } =>
          typeof variant.url === 'string' &&
          variant.content_type === 'video/mp4' &&
          isTwimgMp4(variant.url)
      )
      .sort((a, b) => Number(b.bitrate || 0) - Number(a.bitrate || 0))
    if (mp4s.length) result.push(mp4s[0].url)
  }

  for (const media of mediaList) addMedia(media)
  // Some syndication responses expose only data.video instead of mediaDetails.
  if (!result.length) addMedia(data.video)
  return result
}

function senderIsX(sender: chrome.runtime.MessageSender): boolean {
  try {
    const url = new URL(sender.url || sender.origin || '')
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'x.com' ||
        url.hostname.endsWith('.x.com') ||
        url.hostname === 'twitter.com' ||
        url.hostname.endsWith('.twitter.com'))
    )
  } catch {
    return false
  }
}

async function lookupTweet(tweetId: string): Promise<{ videos: string[]; author: string }> {
  const url = new URL('https://cdn.syndication.twimg.com/tweet-result')
  url.searchParams.set('id', tweetId)
  url.searchParams.set('token', syndicationToken(tweetId))
  url.searchParams.set('lang', 'en')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12000)
  try {
    const response = await fetch(url, { credentials: 'omit', signal: controller.signal })
    if (!response.ok) throw new Error('X 视频信息请求失败 (HTTP ' + response.status + ')')
    const data = (await response.json()) as TweetResult
    return { videos: extractMp4Videos(data), author: data.user?.screen_name || 'x' }
  } finally {
    clearTimeout(timer)
  }
}

function filenameFor(tweetId: string, author: string, index: number, count: number): string {
  const safeAuthor = author.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 50) || 'x'
  return safeAuthor + '_' + tweetId + (count > 1 ? '_' + (index + 1) : '') + '.mp4'
}

async function saveMp4(url: string, filename: string): Promise<number> {
  return new Promise((resolve, reject) => {
    chrome.downloads.download({ url, filename, conflictAction: 'uniquify', saveAs: false }, id => {
      const error = chrome.runtime.lastError
      if (error || typeof id !== 'number') {
        reject(new Error(error?.message || '浏览器未能启动 MP4 下载'))
      } else {
        resolve(id)
      }
    })
  })
}

export async function handleXVideoMedia(
  message: XVideoMediaMessage,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse) => void
): Promise<void> {
  try {
    if (!senderIsX(sender)) throw new Error('仅允许从 X/Twitter 页面发起视频操作')
    if (!TWEET_ID.test(message.tweetId || '')) throw new Error('无法识别推文 ID')
    if (message.action !== 'copy' && message.action !== 'download') {
      throw new Error('不支持的视频操作')
    }
    const index =
      typeof message.index === 'number' && Number.isInteger(message.index) && message.index >= 0
        ? message.index
        : 0
    if (index > 20) throw new Error('视频序号超出范围')

    let videos: string[] = []
    let author = 'x'
    try {
      const tweet = await lookupTweet(message.tweetId)
      videos = tweet.videos
      author = tweet.author
    } catch (error) {
      console.warn('[XVideo] Syndication lookup failed, checking direct MP4 fallback:', error)
    }

    const fallback = typeof message.fallbackUrl === 'string' &&
      isTwimgMp4(message.fallbackUrl) ? message.fallbackUrl : null
    const url = videos.length ? videos[Math.min(index, videos.length - 1)] : fallback
    if (!url) throw new Error('无法获取完整 MP4（私密推文或 X 接口不可用）')
    const filename = filenameFor(message.tweetId, author, index, videos.length)

    if (message.action === 'copy') {
      sendResponse({ success: true, data: { url, filename } })
      return
    }

    const downloadId = await saveMp4(url, filename)
    sendResponse({ success: true, data: { url, filename, downloadId } })
  } catch (error) {
    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) })
  }
}
