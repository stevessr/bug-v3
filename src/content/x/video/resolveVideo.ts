/** Self-contained: executed in the page's MAIN world to read React player props. */
export function resolveXVideoUrl(marker: string): string | null {
  const video = Array.from(
    document.querySelectorAll<HTMLVideoElement | HTMLImageElement>(
      'video, img[src*="/tweet_video_thumb/"]'
    )
  ).find(item => item.getAttribute('data-x-video-resolver') === marker)
  if (!video) return null
  const isMp4 = (value: unknown): value is string => {
    if (typeof value !== 'string') return false
    try {
      const url = new URL(value)
      return (
        url.protocol === 'https:' &&
        url.hostname === 'video.twimg.com' &&
        /\.mp4$/i.test(url.pathname) &&
        !/\/(?:segment|chunk)\b/i.test(url.pathname)
      )
    } catch {
      return false
    }
  }
  for (const url of [
    video instanceof HTMLVideoElement ? video.currentSrc : '',
    video.src,
    ...Array.from(video.querySelectorAll('source')).map(s => s.src)
  ]) {
    if (isMp4(url)) return url
  }
  const poster = video instanceof HTMLVideoElement ? video.poster : video.src
  // X GIFs are MP4s with a stable basename; they do not need a loaded video src.
  const gif = poster.match(
    /^https:\/\/pbs\.twimg\.com\/tweet_video_thumb\/([\w-]+)(?:\.[a-z]+|\?)/i
  )
  if (gif) return `https://video.twimg.com/tweet_video/${gif[1]}.mp4`
  const mediaId = poster.match(
    /\/(?:amplify_video_thumb|ext_tw_video_thumb|tweet_video_thumb)\/([^/.]+)/
  )?.[1]
  const candidates = new Map<string, number>()
  const seen = new WeakSet<object>()
  const playerGroups = new Map<object, Map<string, number>>()
  const player =
    video.closest('[data-testid="videoPlayer"]') || video.closest('[data-testid="videoComponent"]')
  let trustedPlayer = false
  let budget = 6000
  const visit = (value: any, depth: number, matched = false) => {
    if (!value || typeof value !== 'object' || depth > 12 || --budget < 0 || seen.has(value)) return
    seen.add(value)
    const ownPoster =
      value.media_url_https ||
      value.media_url ||
      value.poster ||
      value.posterUrl ||
      value.posterImage ||
      value.preview_image_url ||
      value.thumbnailUrl
    const matches =
      matched ||
      (Boolean(poster) &&
        typeof ownPoster === 'string' &&
        ownPoster.split('?')[0] === poster.split('?')[0])
    // Player props may use a different thumbnail/media ID. Trust a single variants
    // group on THIS player's host, not arbitrary groups found on the whole tweet.
    if (trustedPlayer && Array.isArray(value.variants)) {
      const group = new Map<string, number>()
      for (const variant of value.variants) {
        const source = variant?.url || variant?.src
        if (
          isMp4(source) &&
          (!variant.content_type || variant.content_type === 'video/mp4') &&
          (!variant.type || variant.type === 'video/mp4')
        )
          group.set(source, Number(variant.bitrate) || 0)
      }
      if (group.size) playerGroups.set(value.variants, group)
    }
    const url = value.url || value.src
    if (
      isMp4(url) &&
      (matches || (mediaId && new URL(url).pathname.split('/').includes(mediaId)))
    ) {
      if (!value.content_type || value.content_type === 'video/mp4') {
        candidates.set(url, Math.max(candidates.get(url) || 0, Number(value.bitrate) || 0))
      }
    }
    for (const key of Object.keys(value)) {
      // Do not walk React's fiber graph, DOM nodes or unrelated quoted tweets.
      if (
        [
          'return',
          'child',
          'sibling',
          'stateNode',
          'owner',
          '_owner',
          'quoted_status_result'
        ].includes(key)
      )
        continue
      if (['url', 'src'].includes(key) && value.content_type && value.content_type !== 'video/mp4')
        continue
      const next = value[key]
      if (
        isMp4(next) &&
        (matches || (mediaId && new URL(next).pathname.split('/').includes(mediaId)))
      ) {
        candidates.set(next, candidates.get(next) || 0)
      } else if (next && typeof next === 'object' && !(next instanceof Node))
        visit(next, depth + 1, matches)
    }
  }
  let node: HTMLElement | null = video
  for (let i = 0; node && i < 20; i++, node = node.parentElement) {
    for (const key of Object.getOwnPropertyNames(node)) {
      trustedPlayer = Boolean(player && player.contains(node))
      if (key.startsWith('__reactProps$')) visit((node as any)[key], 0)
      if (key.startsWith('__reactFiber$')) {
        let fiber = (node as any)[key]
        for (let j = 0; fiber && j < 40; j++, fiber = fiber.return) {
          // Composite fibers can own the player metadata several levels above
          // the video tag. Do not treat props past a different host as local.
          if (fiber.stateNode instanceof Element && player && !player.contains(fiber.stateNode))
            trustedPlayer = false
          visit(fiber.memoizedProps, 0)
          visit(fiber.pendingProps, 0)
        }
      }
    }
    if (node.matches('article, [data-testid="tweet"]')) break
  }
  if (!candidates.size && playerGroups.size === 1) {
    for (const [url, bitrate] of [...playerGroups.values()][0]) candidates.set(url, bitrate)
  }
  // Only consider full MP4 resources belonging to this poster, never HLS fragments.
  if (!candidates.size && mediaId) {
    for (const entry of performance.getEntriesByType('resource')) {
      if (
        isMp4(entry.name) &&
        new URL(entry.name).pathname.split('/').includes(mediaId) &&
        /\/vid\/(?:avc1\/)?\d+x\d+\//.test(new URL(entry.name).pathname)
      )
        candidates.set(entry.name, 0)
    }
  }
  const quality = (url: string) => {
    const size = url.match(/\/(\d+)x(\d+)\//)
    return size ? Number(size[1]) * Number(size[2]) : 0
  }
  return (
    [...candidates].sort((a, b) => b[1] - a[1] || quality(b[0]) - quality(a[0]))[0]?.[0] || null
  )
}
