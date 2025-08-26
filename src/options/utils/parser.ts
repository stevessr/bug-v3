export type ParsedEmoji = {
  UUID?: string
  id?: string
  displayName: string
  displayUrl: string
  realUrl: string
  variants?: Record<string, string>
  width?: number
  height?: number
  scale?: number
}

function simpleHash(s: string) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return 'u' + h.toString(16)
}

export function parseEmojisFromText(input: string): ParsedEmoji[] {
  if (!input) return []
  const out: ParsedEmoji[] = []
  const trimmed = input.trim()
  // detect HTML
  if (trimmed.indexOf('<') >= 0 && trimmed.indexOf('>') >= 0) {
    try {
      const doc = new DOMParser().parseFromString(input, 'text/html')
      // find anchors with class lightbox or images
      const anchors = Array.from(doc.querySelectorAll('a.lightbox'))
      if (anchors.length) {
        for (const a of anchors) {
          const href = (a.getAttribute('href') || '').trim()
          const img = a.querySelector('img')
          if (img) {
            const src = (img.getAttribute('src') || '').trim()
            const alt = (img.getAttribute('alt') || '').trim() || ''
            // parse srcset for variants
            const srcset = img.getAttribute('srcset') || ''
            const variants: Record<string, string> = {}
            if (srcset) {
              const parts = srcset.split(',').map((s) => s.trim())
              for (const p of parts) {
                const [u, q] = p.split(/\s+/)
                if (!q) {
                  variants['1x'] = u
                } else if (q.endsWith('x')) {
                  variants[q] = u
                }
              }
            }
            const displayUrl = src || variants['1x'] || ''
            const realUrl = href || displayUrl
            out.push({
              UUID: simpleHash(realUrl + alt),
              id: simpleHash(realUrl),
              displayName: alt || '',
              displayUrl,
              realUrl,
              variants,
            })
          }
        }
      } else {
        // fallback: find all img tags
        const imgs = Array.from(doc.querySelectorAll('img'))
        imgs.forEach((img) => {
          const src = (img.getAttribute('src') || '').trim()
          const alt = (img.getAttribute('alt') || '').trim() || ''
          const href = (img.closest('a')?.getAttribute('href') || '').trim()
          const displayUrl = src
          const realUrl = href || src
          out.push({
            UUID: simpleHash(realUrl + alt),
            id: simpleHash(realUrl),
            displayName: alt || '',
            displayUrl,
            realUrl,
            variants: {},
          })
        })
      }
      if (out.length) return out
    } catch (e) {
      // ignore
    }
  }

  // detect markdown image pattern: ![alt](url) or [![alt](thumb)](orig)
  const mdRegex = /!\[([^\]]*)\]\(([^)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = mdRegex.exec(input))) {
    const rawAlt = m[1] || ''
    const url = m[2] || ''
    // support alt metadata like: "label|490x500,30%" where 30% is scale
    let displayName = rawAlt
    let width: number | undefined = undefined
    let height: number | undefined = undefined
    let scale: number | undefined = undefined
    const pipeIdx = rawAlt.indexOf('|')
    if (pipeIdx >= 0) {
      displayName = rawAlt.slice(0, pipeIdx)
      const meta = rawAlt.slice(pipeIdx + 1).trim()
      // meta could be "490x500,30%" or "490x500" or ",30%"
      const parts = meta
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      for (const p of parts) {
        const dimMatch = p.match(/^(\d{1,5})x(\d{1,5})$/)
        if (dimMatch) {
          width = parseInt(dimMatch[1], 10)
          height = parseInt(dimMatch[2], 10)
          continue
        }
        const scaleMatch = p.match(/^(\d{1,3})%$/)
        if (scaleMatch) {
          scale = parseInt(scaleMatch[1], 10)
          continue
        }
      }
    }
    out.push({
      UUID: simpleHash(url + rawAlt),
      id: simpleHash(url),
      displayName: displayName,
      displayUrl: url,
      realUrl: url,
      variants: {},
      width,
      height,
      scale,
    })
  }
  if (out.length) return out

  // detect bbcode [img]url[/img]
  const bbRegex = /\[img\]([^\[]+)\[\/img\]/gi
  while ((m = bbRegex.exec(input))) {
    const url = (m[1] || '').trim()
    out.push({
      UUID: simpleHash(url),
      id: simpleHash(url),
      displayName: '',
      displayUrl: url,
      realUrl: url,
      variants: {},
    })
  }
  if (out.length) return out

  // fallback: lines of URLs
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  for (const line of lines) {
    if (/^https?:\/\//i.test(line)) {
      out.push({
        UUID: simpleHash(line),
        id: simpleHash(line),
        displayName: '',
        displayUrl: line,
        realUrl: line,
        variants: {},
      })
    }
  }
  return out
}
