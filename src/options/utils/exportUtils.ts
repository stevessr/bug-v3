/* eslint-disable @typescript-eslint/no-explicit-any */
export function downloadJson(filename: string, payload: any) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportConfigurationFile(store: any) {
  const config = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    settings: store.settings,
    groups: store.groups
  }
  const filename = `emoji-config-${new Date().toISOString().split('T')[0]}.json`
  downloadJson(filename, config)
}

export function exportGroupFile(group: any) {
  const emojis = (group.emojis || []).map((e: any) => ({
    id: e.id,
    packet: e.packet,
    name: e.name,
    url: e.url,
    width: e.width,
    height: e.height,
    groupId: group.name || group.id
  }))
  const filename = `emoji-group-${group.id}-${group.name || 'group'}.json`
  downloadJson(filename, emojis)
}

// Zip and download all emoji images in a group
export async function exportGroupZip(
  group: any,
  onProgress?: (_p: number) => void,
  onItem?: (_info: { index: number; name: string; preview?: string | null }) => void,
  signal?: AbortSignal | null
) {
  // We'll build a tar archive (simple UStar) and compress it with native CompressionStream (gzip).
  // Note: CompressionStream cannot create ZIP file containers. We produce a .tar.gz instead.
  const emojis = group.emojis || []
  if (!Array.isArray(emojis) || emojis.length === 0) {
    onProgress?.(100)
    // nothing to package -> fallback to JSON export
    downloadJson(`emoji-group-${group.id}-${group.name || 'group'}.json`, group.emojis || [])
    return
  }
  onProgress?.(0)

  // Helper to fetch and normalize data
  const fetchAsBlob = async (url: string) => {
    if (!url) return null
    if (url.startsWith('data:')) {
      if (signal?.aborted) throw new Error('aborted')
      const res = await fetch(url, { signal })
      return res.blob()
    }
    try {
      if (signal?.aborted) throw new Error('aborted')
      const res = await fetch(url, { mode: 'cors', signal })
      if (!res.ok) return null
      return await res.blob()
    } catch (e) {
      if ((e as any)?.name === 'AbortError') throw e
      return null
    }
  }

  // Convert Blob to Uint8Array
  const blobToUint8 = async (b: Blob) => new Uint8Array(await b.arrayBuffer())

  // TAR header helpers
  const encoder = new TextEncoder()
  const pad = (s: string, len: number) => {
    const bytes = encoder.encode(s)
    if (bytes.length > len) return bytes.slice(0, len)
    const out = new Uint8Array(len)
    out.set(bytes)
    return out
  }

  const numberToOctal = (num: number, length: number) => {
    // length includes trailing null
    const oct = num.toString(8)
    const padded = oct.padStart(length - 1, '0') + '\0'
    return encoder.encode(padded)
  }

  const computeChecksum = (header: Uint8Array) => {
    // checksum is sum of bytes with chksum field as spaces (0x20)
    const copy = new Uint8Array(header)
    for (let i = 148; i < 156; i++) copy[i] = 0x20
    let sum = 0
    for (let i = 0; i < copy.length; i++) sum += copy[i]
    const oct = sum.toString(8)
    const padded = oct.padStart(6, '0') + '\0' + ' '
    return encoder.encode(padded)
  }

  const parts: (Uint8Array | ArrayBuffer | string)[] = []
  // keep track of preview object URLs created for each fetched blob so they can be revoked
  // note: preview URLs are created and delivered to caller via onItem;
  // caller is responsible for revoking them when appropriate

  for (let idx = 0; idx < emojis.length; idx++) {
    const e: any = emojis[idx]
    const url = e.url || e.src || e.icon
    // Preserve display name as much as possible. Only remove path separators and NULs
    const displayName = (e.name || `emoji-${idx}`) as string
    const safeBase = displayName.split('/').join('_').split('\0').join('_')
    const extMatch = (url || '').match(/\.([a-zA-Z0-9]{1,5})(?:\?|$)/)
    const ext = extMatch ? extMatch[1] : 'png'
    const extWithDot = `.${ext}`

    // Tar name field is 100 bytes. Truncate base name by bytes if necessary.
    const maxNameBytes = 100
    const encoderLocal = encoder
    let name = safeBase + extWithDot
    if (encoderLocal.encode(name).length > maxNameBytes) {
      // build incrementally to avoid cutting multi-byte chars
      let out = ''
      for (const ch of safeBase) {
        const candidate = out + ch
        if (encoderLocal.encode(candidate + extWithDot).length > maxNameBytes) break
        out = candidate
      }
      // If out is empty (single char too large), fallback to numeric name
      const baseFinal = out || `emoji-${idx}`
      name = baseFinal + extWithDot
    }

    if (signal?.aborted) throw new Error('aborted')
    const blob = await fetchAsBlob(url)
    if (!blob) continue
    // create preview URL for UI (caller should revoke when done)
    try {
      const blobUrl = URL.createObjectURL(blob)
      onItem?.({ index: idx, name: displayName, preview: blobUrl })
    } catch {
      // ignore preview creation errors
      onItem?.({ index: idx, name: displayName, preview: null })
    }

    const content = await blobToUint8(blob)
    const size = content.byteLength

    // Build 512-byte header
    const header = new Uint8Array(512)
    header.set(pad(name, 100), 0) // name
    header.set(numberToOctal(0o644, 8), 100) // mode
    header.set(numberToOctal(0, 8), 108) // uid
    header.set(numberToOctal(0, 8), 116) // gid
    header.set(numberToOctal(size, 12), 124) // size
    header.set(numberToOctal(Math.floor(Date.now() / 1000), 12), 136) // mtime
    // chksum at 148..155
    header.set(encoder.encode('        '), 148)
    header[156] = 0x30 // typeflag '0'
    // linkname 157..256 left zero
    header.set(encoder.encode('ustar'), 257) // magic
    header.set(encoder.encode('00'), 263) // version
    // uname/gname left empty

    // compute checksum and write
    const chksum = computeChecksum(header)
    header.set(chksum, 148)

    parts.push(header)
    parts.push(content)
    // pad file content to 512-byte boundary
    const remainder = size % 512
    if (remainder !== 0) {
      parts.push(new Uint8Array(512 - remainder))
    }
    // report progress for fetch/pack stage (0..70)
    const fetchPct = Math.round(((idx + 1) / emojis.length) * 70)
    onProgress?.(fetchPct)
  }

  // Two 512-byte zero blocks at end of tar
  parts.push(new Uint8Array(512))
  parts.push(new Uint8Array(512))

  onProgress?.(75)
  const tarBlob = new Blob(parts as any, { type: 'application/x-tar' })

  if (typeof (window as any).CompressionStream === 'function') {
    try {
      // Compress tar with gzip
      // @ts-ignore - CompressionStream may not exist in TS lib
      const cs = new CompressionStream('gzip')
      onProgress?.(80)
      const compressedStream = tarBlob.stream().pipeThrough(cs)
      // we can't get granular compression progress from CompressionStream, approximate
      onProgress?.(90)
      const compressedBlob = await new Response(compressedStream).blob()
      onProgress?.(100)
      const url = URL.createObjectURL(compressedBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `emoji-group-${group.id}-${group.name || 'group'}.tar.gz`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      // previews are caller-managed; nothing to revoke here
      return
    } catch {
      // Fallthrough to fallback below
    }
  }

  // If CompressionStream is not supported or compression failed, fallback to JSON export
  downloadJson(`emoji-group-${group.id}-${group.name || 'group'}.json`, group.emojis || [])
}
