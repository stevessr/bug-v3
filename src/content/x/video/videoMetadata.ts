export type XVideoContext = {
  poster: string
  tweetId?: string
  mediaIndex: number
  mediaCount: number
}

export function getXVideoContext(media: HTMLVideoElement | HTMLImageElement): XVideoContext {
  const poster = media instanceof HTMLVideoElement ? media.poster : media.src
  const tweet = media.closest('[data-testid="tweet"], article')
  let tweetId: string | undefined
  // Start at the media and expand outwards, so a quoted tweet's media permalink wins.
  let node: Element | null = media.parentElement
  while (node) {
    const links = Array.from(node.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'))
    if (node.matches('a[href*="/status/"]')) links.unshift(node as HTMLAnchorElement)
    const link =
      links.find(a => /\/status\/\d+\/(?:video|photo)\/\d+/.test(a.pathname)) ||
      links.find(a => a.querySelector('time')) ||
      links[0]
    if (link) {
      tweetId = link.pathname.match(/\/status\/(\d+)/)?.[1]
      if (tweetId) break
    }
    if (node === tweet) break
    node = node.parentElement
  }
  // Only use the current URL on a standalone player, not another tweet in its replies.
  if (!tweet && !tweetId) tweetId = location.pathname.match(/\/status\/(\d+)/)?.[1]
  const scope = tweet || media.closest('[data-testid="videoPlayer"]') || media.parentElement
  const items = Array.from(scope?.querySelectorAll('video, img[src*="/tweet_video_thumb/"]') || [])
  return {
    poster,
    tweetId,
    mediaIndex: Math.max(0, items.indexOf(media)),
    mediaCount: items.length || 1
  }
}

/** Select only the clicked media, even for tweets containing several videos. */
export function selectXVideoVariant(data: any, context: XVideoContext): string | null {
  const normalize = (url: string) => {
    try {
      return new URL(url).pathname.replace(/\.(?:jpg|png|webp)(?::\w+)?$/i, '')
    } catch {
      return url
    }
  }
  const id = context.poster.match(
    /\/(?:amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb)\/([^/.?]+)/
  )?.[1]
  const media = (data?.mediaDetails || data?.extended_entities?.media || []).filter(
    (item: any) => item.video_info?.variants || item.variants
  )
  if (data?.video?.variants && !media.length) media.push(data.video)
  const posterOf = (item: any) =>
    item.media_url_https || item.media_url || item.poster || item.preview_image_url || ''
  let selected = media.find(
    (item: any) => context.poster && normalize(posterOf(item)) === normalize(context.poster)
  )
  if (!selected && id)
    selected = media.find((item: any) =>
      (item.video_info?.variants || item.variants || []).some((variant: any) => {
        try {
          return new URL(variant.url || variant.src).pathname.split('/').includes(id)
        } catch {
          return false
        }
      })
    )
  if (!selected && media.length === context.mediaCount) selected = media[context.mediaIndex]
  if (!selected) return null
  const variants = (selected.video_info?.variants || selected.variants || []).filter(
    (item: any) => {
      try {
        const url = new URL(item.url || item.src)
        return (
          url.protocol === 'https:' &&
          url.hostname === 'video.twimg.com' &&
          /\.mp4$/i.test(url.pathname) &&
          (!item.content_type || item.content_type === 'video/mp4') &&
          (!item.type || item.type === 'video/mp4')
        )
      } catch {
        return false
      }
    }
  )
  const quality = (item: any) => {
    const size = (item.url || item.src).match(/\/(\d+)x(\d+)\//)
    return size ? Number(size[1]) * Number(size[2]) : 0
  }
  variants.sort(
    (a: any, b: any) =>
      (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0) || quality(b) - quality(a)
  )
  return variants[0]?.url || variants[0]?.src || null
}
