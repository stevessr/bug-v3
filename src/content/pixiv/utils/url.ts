/**
 * 将 Pixiv 的缩略图/预览 URL 解析为原图 URL。
 * 规则：
 * - 优先返回已是 img-original 的 URL
 * - 将 img-master 路径替换为 img-original，并去掉文件名中的 `_masterXXXX`/`_squareXXXX`/`_customXXXX` 等后缀
 * - 保留文件扩展名（jpg/png/gif 等）
 */
export function toPixivOriginalUrl(candidate: string): string {
  try {
    if (!candidate || !candidate.startsWith('http')) return candidate
    // 统一处理 pximg 子域
    let url = candidate
    // 已经是原图
    if (url.includes('/img-original/')) return url

    // 有些 src 在 i.pximg.net 上，但路径为 img-master 或者其他缩略图目录
    // 常见缩略：/img-master/.../_p0_master1200.jpg -> /img-original/.../_p0.jpg
    // 也可能是 *_square1200, *_custom1200 等
    url = url.replace('/img-master/', '/img-original/')

    // 去除文件名中的缩略后缀
  // 形如：xxxx_p0_master1200.jpg 或 xxxx_p0_square1200.jpg 或 xxxx_p0_custom1200.jpg
    url = url.replace(/(_p\d+)_(?:master|square|custom)\d+(\.[a-zA-Z0-9]+)$/i, '$1$2')

    // 某些场景无 _pN 标记，仅有 master 后缀：xxxx_master1200.jpg -> xxxx.jpg
    url = url.replace(/_master\d+(\.[a-zA-Z0-9]+)$/i, '$1')

    return url
  } catch {
    return candidate
  }
}

/**
 * 从容器内的 <a> 或 <img> 推断原图 URL：
 * - 优先 a[href*="/img-original/"]
 * - 否则从 img 的 data-src/src/srcset 取一个 URL，并转换为原图
 */
export function findPixivOriginalInContainer(container: Element | null): string | null {
  if (!container) return null
  try {
    const a = container.querySelector('a[href*="/img-original/"]') as HTMLAnchorElement | null
    if (a?.href) return a.href

    const img = container.querySelector(
      'img[src*="i.pximg.net"], img[src*="pximg.net"]'
    ) as HTMLImageElement | null
    if (!img) return null

    const fromData = (img.getAttribute('data-src') || img.getAttribute('data-original') || '').trim()
    const srcset = img.getAttribute('srcset') || ''
    const firstSrcset = (srcset.split(',')[0] || '').split(' ')[0]
    const candidate = fromData || img.src || firstSrcset
    if (!candidate || !candidate.startsWith('http')) return null
    return toPixivOriginalUrl(candidate)
  } catch {
    return null
  }
}
