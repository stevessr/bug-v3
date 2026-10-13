import { selectXVideoVariant, type XVideoContext } from '../../content/x/video/videoMetadata'
import { resolveXVideoUrl } from '../../content/x/video/resolveVideo'

export async function handleXVideoRequest(
  message: { marker: string; download?: boolean } & Partial<XVideoContext>,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: any) => void
) {
  try {
    const host = new URL(sender.url || '').hostname
    if (
      !['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'].includes(host) ||
      sender.tab?.id === undefined
    ) {
      throw new Error('仅支持 X/Twitter 页面')
    }
    if (typeof message.marker !== 'string' || !/^[\w-]{1,100}$/.test(message.marker))
      throw new Error('无效的视频标识')
    const results = await chrome.scripting.executeScript({
      target: { tabId: sender.tab.id, frameIds: [sender.frameId || 0] },
      world: 'MAIN',
      func: resolveXVideoUrl,
      args: [message.marker]
    })
    let url = results[0]?.result
    if (!url && message.tweetId && /^\d{1,40}$/.test(message.tweetId)) {
      // Public tweet metadata contains MP4 variants even before playback. Fetch
      // in the extension background to avoid the page's CORS/CSP restrictions.
      const endpoint = new URL('https://cdn.syndication.twimg.com/tweet-result')
      endpoint.searchParams.set('id', message.tweetId)
      endpoint.searchParams.set('lang', 'en')
      endpoint.searchParams.set(
        'token',
        ((Number(message.tweetId) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '')
      )
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(12000),
        credentials: 'omit'
      })
      if (!response.ok) throw new Error(`视频元数据请求失败（${response.status}）`)
      url = selectXVideoVariant(await response.json(), {
        poster: typeof message.poster === 'string' ? message.poster : '',
        mediaIndex: Number.isInteger(message.mediaIndex) ? (message.mediaIndex as number) : 0,
        mediaCount: Number.isInteger(message.mediaCount) ? (message.mediaCount as number) : 1
      })
    }
    if (!url) throw new Error('未找到可下载的 MP4；此推文可能未公开，或 X 未返回视频元数据')
    // Treat MAIN-world results as untrusted; never download arbitrary URLs.
    const parsed = new URL(url)
    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname !== 'video.twimg.com' ||
      !parsed.pathname.endsWith('.mp4')
    ) {
      throw new Error('无效的 MP4 地址')
    }
    if (message.download) {
      const downloadId = await chrome.downloads.download({
        url,
        filename: `x-video-${Date.now()}.mp4`,
        saveAs: false
      })
      sendResponse({ success: true, url, downloadId })
    } else sendResponse({ success: true, url })
  } catch (error) {
    sendResponse({ success: false, error: error instanceof Error ? error.message : String(error) })
  }
}
