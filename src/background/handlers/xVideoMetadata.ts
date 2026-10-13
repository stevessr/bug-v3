import { selectXVideoVariant, type XVideoContext } from '../../content/x/video/videoMetadata.ts'

export type XVideoTweetResult = {
  user?: { screen_name?: string }
  mediaDetails?: Array<{
    media_url_https?: string
    media_url?: string
    poster?: string
    preview_image_url?: string
    video_info?: { variants?: Array<Record<string, unknown>> }
    variants?: Array<Record<string, unknown>>
  }>
  extended_entities?: {
    media?: XVideoTweetResult['mediaDetails']
  }
  video?: {
    variants?: Array<Record<string, unknown>>
  }
}

export function syndicationToken(tweetId: string): string {
  return ((Number(tweetId) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '')
}

export async function fetchXVideoTweetResult(tweetId: string): Promise<XVideoTweetResult> {
  const endpoint = new URL('https://cdn.syndication.twimg.com/tweet-result')
  endpoint.searchParams.set('id', tweetId)
  endpoint.searchParams.set('lang', 'en')
  endpoint.searchParams.set('token', syndicationToken(tweetId))

  const response = await fetch(endpoint, {
    signal: AbortSignal.timeout(12000),
    credentials: 'omit'
  })
  if (!response.ok) throw new Error(`视频元数据请求失败（${response.status}）`)
  return (await response.json()) as XVideoTweetResult
}

export function selectXVideoTweetVariant(
  tweet: XVideoTweetResult,
  context: XVideoContext
): string | null {
  return selectXVideoVariant(tweet, context)
}
