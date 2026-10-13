/**
 * Resolve X/Twitter's progressive MP4 URL instead of downloading an MSE blob
 * or a silent HLS track. Uses the public syndication endpoint (public tweets
 * only); no private GraphQL keys, user cookies or third-party proxy.
 */
import { fetchXVideoTweetResult, selectXVideoTweetVariant } from './xVideoMetadata.ts'
import type { XVideoTweetResult } from './xVideoMetadata.ts'

import type { MessageResponse, XVideoMediaMessage } from '@/types/messages'

export { syndicationToken } from './xVideoMetadata.ts'

interface Variant {
  url?: unknown
  content_type?: unknown
  bitrate?: unknown
}
interface Media {
  type?: unknown
  media_url_https?: string
  media_url?: string
  video_info?: { variants?: Variant[] }
  variants?: Variant[]
}
interface TweetResult {
  user?: { screen_name?: string }
  mediaDetails?: Media[]
  video?: Media
}

const TWEET_ID = /^\d{15,22}$/

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
  const mediaList = (Array.isArray(data.mediaDetails) ? data.mediaDetails : []).filter(
    media => media.video_info?.variants || media.variants
  )
  // Some syndication responses expose only data.video instead of mediaDetails.
  if (!mediaList.length && data.video) mediaList.push(data.video)
  const tweet = { ...data, mediaDetails: mediaList } as XVideoTweetResult

  return mediaList.flatMap((media, mediaIndex) => {
    const poster = media.media_url_https || media.media_url || ''
    const url = selectXVideoTweetVariant(tweet, {
      poster,
      mediaIndex,
      mediaCount: mediaList.length
    })
    return url ? [url] : []
  })
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
  const data = (await fetchXVideoTweetResult(tweetId)) as TweetResult
  return { videos: extractMp4Videos(data), author: data.user?.screen_name || 'x' }
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

    const fallback =
      typeof message.fallbackUrl === 'string' && isTwimgMp4(message.fallbackUrl)
        ? message.fallbackUrl
        : null
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
