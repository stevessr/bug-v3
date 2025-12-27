function downloadJson(filename: string, payload: any) {
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
  const filename = `group-${group.id}.json`
  downloadJson(filename, emojis)
}

// Streaming zip export with memory optimization
export async function exportGroupZip(
  group: any,
  onProgress?: (_p: number) => void,
  onItem?: (_info: { index: number; name: string; preview?: string | null }) => void,
  signal?: AbortSignal | null
) {
  const emojis = group.emojis || []
  if (!Array.isArray(emojis) || emojis.length === 0) {
    onProgress?.(100)
    downloadJson(`group-${group.id}.json`, group.emojis || [])
    return
  }

  // Try streaming approach first, fallback to legacy if needed
  try {
    await exportGroupZipStreaming(group, onProgress, onItem, signal)
  } catch (error) {
    console.warn('Streaming export failed, falling back to legacy method:', error)
    await exportGroupZipLegacy(group, onProgress, onItem, signal)
  }
}

// New streaming implementation with memory optimization
async function exportGroupZipStreaming(
  group: any,
  onProgress?: (_p: number) => void,
  onItem?: (_info: { index: number; name: string; preview?: string | null }) => void,
  signal?: AbortSignal | null
) {
  const emojis = group.emojis || []
  onProgress?.(0)

  // Check if streaming APIs are supported
  if (
    typeof ReadableStream === 'undefined' ||
    typeof (window as any).CompressionStream === 'undefined'
  ) {
    throw new Error('Streaming APIs not supported')
  }

  const encoder = new TextEncoder()

  // Helper functions for TAR format
  const {
    pad,
    numberToOctal,
    computeChecksum,
    createTarHeader,
    fetchEmojiBlob,
    generateSafeFilename
  } = createTarHelpers(encoder)

  let processedCount = 0
  const totalFiles = emojis.length

  // Create a streaming TAR generator
  const tarStream = new ReadableStream({
    async start(controller) {
      try {
        for (let idx = 0; idx < emojis.length; idx++) {
          if (signal?.aborted) {
            controller.close()
            return
          }

          const emoji = emojis[idx]
          const url = emoji.url || emoji.src || emoji.icon
          if (!url) continue

          // Generate safe filename
          const displayName = (emoji.name || `emoji-${idx}`) as string
          const filename = generateSafeFilename(displayName, url, idx)

          try {
            // Fetch image data with streaming
            const blob = await fetchEmojiBlob(url, signal)
            if (!blob) continue

            // Create preview URL for UI
            try {
              const blobUrl = URL.createObjectURL(blob)
              onItem?.({ index: idx, name: displayName, preview: blobUrl })
            } catch {
              onItem?.({ index: idx, name: displayName, preview: null })
            }

            // Stream the file content in chunks to avoid memory buildup
            const fileSize = blob.size
            const header = createTarHeader(
              filename,
              fileSize,
              encoder,
              pad,
              numberToOctal,
              computeChecksum
            )

            // Enqueue header
            controller.enqueue(header)

            // Stream file content in chunks
            const reader = blob.stream().getReader()
            let bytesRead = 0

            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break

                controller.enqueue(value)
                bytesRead += value.length
              }

              // Add padding to 512-byte boundary
              const remainder = fileSize % 512
              if (remainder !== 0) {
                controller.enqueue(new Uint8Array(512 - remainder))
              }
            } finally {
              reader.releaseLock()
            }
          } catch (error) {
            console.warn(`Failed to process emoji ${idx}:`, error)
          }

          processedCount++
          const progress = Math.round((processedCount / totalFiles) * 70) // 0-70% for processing
          onProgress?.(progress)
        }

        // Add TAR end markers (two 512-byte zero blocks)
        controller.enqueue(new Uint8Array(512))
        controller.enqueue(new Uint8Array(512))

        controller.close()
      } catch (error) {
        controller.error(error)
      }
    }
  })

  onProgress?.(75)

  // Compress stream with gzip
  const compressionStream = new CompressionStream('gzip')
  const compressedStream = tarStream.pipeThrough(compressionStream)

  onProgress?.(85)

  // Convert to blob and download
  const compressedBlob = await new Response(compressedStream).blob()

  onProgress?.(95)

  // Download the file
  const url = URL.createObjectURL(compressedBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = `group-${group.id}-${group.name || 'group'}.tar.gz`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  onProgress?.(100)
}

// Legacy implementation (fallback)
async function exportGroupZipLegacy(
  group: any,
  onProgress?: (_p: number) => void,
  onItem?: (_info: { index: number; name: string; preview?: string | null }) => void,
  signal?: AbortSignal | null
) {
  const emojis = group.emojis || []
  onProgress?.(0)

  const encoder = new TextEncoder()
  const {
    pad,
    numberToOctal,
    computeChecksum,
    createTarHeader,
    fetchEmojiBlob,
    generateSafeFilename
  } = createTarHelpers(encoder)

  const parts: Uint8Array[] = []

  // Process files in batches to reduce memory pressure
  const BATCH_SIZE = 5

  for (let batchStart = 0; batchStart < emojis.length; batchStart += BATCH_SIZE) {
    if (signal?.aborted) throw new Error('aborted')

    const batchEnd = Math.min(batchStart + BATCH_SIZE, emojis.length)
    const batchPromises = []

    for (let idx = batchStart; idx < batchEnd; idx++) {
      const emoji = emojis[idx]
      const url = emoji.url || emoji.src || emoji.icon
      if (!url) continue

      batchPromises.push(
        processEmojiFile(
          emoji,
          idx,
          url,
          fetchEmojiBlob,
          generateSafeFilename,
          createTarHeader,
          encoder,
          pad,
          numberToOctal,
          computeChecksum,
          onItem,
          signal
        )
      )
    }

    const batchResults = await Promise.allSettled(batchPromises)

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        parts.push(...result.value)
      }
    }

    const progress = Math.round((batchEnd / emojis.length) * 70)
    onProgress?.(progress)
  }

  // Add TAR end markers
  parts.push(new Uint8Array(512), new Uint8Array(512))

  onProgress?.(75)
  const tarBlob = new Blob(parts as BlobPart[], { type: 'application/x-tar' })

  if (typeof CompressionStream === 'function') {
    try {
      const cs = new CompressionStream('gzip')
      onProgress?.(80)
      const compressedStream = tarBlob.stream().pipeThrough(cs)
      onProgress?.(90)
      const compressedBlob = await new Response(compressedStream).blob()
      onProgress?.(100)

      const url = URL.createObjectURL(compressedBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `group-${group.id}-${group.name || 'group'}.tar.gz`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return
    } catch {
      // Fallthrough to JSON export
    }
  }

  downloadJson(`group-${group.id}-${group.name || 'group'}.json`, group.emojis || [])
}

// Helper to process individual emoji files
async function processEmojiFile(
  emoji: any,
  idx: number,
  url: string,
  fetchEmojiBlob: (url: string, signal?: AbortSignal | null) => Promise<Blob | null>,
  generateSafeFilename: (displayName: string, url: string, index: number) => string,
  createTarHeader: (
    filename: string,
    fileSize: number,
    encoder: TextEncoder,
    pad: any,
    numberToOctal: any,
    computeChecksum: any
  ) => Uint8Array,
  encoder: TextEncoder,
  pad: any,
  numberToOctal: any,
  computeChecksum: any,
  onItem?: (_info: { index: number; name: string; preview?: string | null }) => void,
  signal?: AbortSignal | null
): Promise<Uint8Array[] | null> {
  try {
    const displayName = (emoji.name || `emoji-${idx}`) as string
    const filename = generateSafeFilename(displayName, url, idx)

    const blob = await fetchEmojiBlob(url, signal)
    if (!blob) return null

    // Create preview URL
    try {
      const blobUrl = URL.createObjectURL(blob)
      onItem?.({ index: idx, name: displayName, preview: blobUrl })
    } catch {
      onItem?.({ index: idx, name: displayName, preview: null })
    }

    const content = new Uint8Array(await blob.arrayBuffer())
    const fileSize = content.byteLength

    const header = createTarHeader(filename, fileSize, encoder, pad, numberToOctal, computeChecksum)

    const result: Uint8Array[] = [header, content]

    // Add padding to 512-byte boundary
    const remainder = fileSize % 512
    if (remainder !== 0) {
      result.push(new Uint8Array(512 - remainder))
    }

    return result
  } catch (error) {
    console.warn(`Failed to process emoji ${idx}:`, error)
    return null
  }
}

// Helper functions for TAR creation and file processing
function createTarHelpers(encoder: TextEncoder) {
  const pad = (s: string, len: number) => {
    const bytes = encoder.encode(s)
    if (bytes.length > len) return bytes.slice(0, len)
    const out = new Uint8Array(len)
    out.set(bytes)
    return out
  }

  const numberToOctal = (num: number, length: number) => {
    const oct = num.toString(8)
    const padded = oct.padStart(length - 1, '0') + '\0'
    return encoder.encode(padded)
  }

  const computeChecksum = (header: Uint8Array) => {
    const copy = new Uint8Array(header)
    for (let i = 148; i < 156; i++) copy[i] = 0x20
    let sum = 0
    for (let i = 0; i < copy.length; i++) sum += copy[i]
    const oct = sum.toString(8)
    const padded = oct.padStart(6, '0') + '\0' + ' '
    return encoder.encode(padded)
  }

  const createTarHeader = (
    filename: string,
    fileSize: number,
    encoder: TextEncoder,
    pad: (s: string, len: number) => Uint8Array,
    numberToOctal: (num: number, length: number) => Uint8Array,
    computeChecksum: (header: Uint8Array) => Uint8Array
  ) => {
    const header = new Uint8Array(512)
    header.set(pad(filename, 100), 0) // name
    header.set(numberToOctal(0o644, 8), 100) // mode
    header.set(numberToOctal(0, 8), 108) // uid
    header.set(numberToOctal(0, 8), 116) // gid
    header.set(numberToOctal(fileSize, 12), 124) // size
    header.set(numberToOctal(Math.floor(Date.now() / 1000), 12), 136) // mtime
    header.set(encoder.encode('        '), 148) // chksum placeholder
    header[156] = 0x30 // typeflag '0'
    header.set(encoder.encode('ustar'), 257) // magic
    header.set(encoder.encode('00'), 263) // version

    const chksum = computeChecksum(header)
    header.set(chksum, 148)
    return header
  }

  const fetchEmojiBlob = async (url: string, signal?: AbortSignal | null): Promise<Blob | null> => {
    if (!url) return null

    try {
      if (signal?.aborted) throw new Error('aborted')

      if (url.startsWith('data:')) {
        const res = await fetch(url, { signal: signal || undefined })
        return res.blob()
      }

      const res = await fetch(url, {
        mode: 'cors',
        signal: signal || undefined,
        headers: {
          Accept: 'image/*'
        }
      })

      if (!res.ok) return null
      return res.blob()
    } catch (e) {
      if ((e as any)?.name === 'AbortError') throw e
      return null
    }
  }

  const generateSafeFilename = (displayName: string, url: string, index: number): string => {
    const safeBase = displayName.split('/').join('_').split('\0').join('_')
    const extMatch = (url || '').match(/\.([a-zA-Z0-9]{1,5})(?:\?|$)/)
    const ext = extMatch ? extMatch[1] : 'png'
    const extWithDot = `.${ext}`

    // TAR name field is 100 bytes max
    const maxNameBytes = 100
    let name = safeBase + extWithDot

    if (encoder.encode(name).length > maxNameBytes) {
      let out = ''
      for (const ch of safeBase) {
        const candidate = out + ch
        if (encoder.encode(candidate + extWithDot).length > maxNameBytes) break
        out = candidate
      }
      const baseFinal = out || `emoji-${index}`
      name = baseFinal + extWithDot
    }

    return name
  }

  return {
    pad,
    numberToOctal,
    computeChecksum,
    createTarHeader,
    fetchEmojiBlob,
    generateSafeFilename
  }
}

/**
 * 导出分组到云端市场格式
 * 生成多个文件：
 * 1. metadata.json - 包含所有分组的元信息
 * 2. group-{id}.json - 每个分组的详细数据
 */
export async function exportToCloudMarket(
  groups: any[],
  archivedGroups: any[],
  includeArchived: boolean = true,
  onProgress?: (current: number, total: number, groupName: string) => void
) {
  const allGroups = includeArchived ? [...groups, ...archivedGroups] : groups
  const total = allGroups.length + 1 // +1 for metadata

  // 生成 metadata
  const metadata = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    totalGroups: allGroups.length,
    includeArchived,
    groups: allGroups.map(g => ({
      id: g.id,
      name: g.name,
      icon: g.icon,
      detail: g.detail,
      order: g.order,
      emojiCount: (g.emojis || []).length,
      isArchived: archivedGroups.some(ag => ag.id === g.id)
    }))
  }

  // 下载 metadata.json
  onProgress?.(1, total, 'metadata.json')
  downloadJson('metadata.json', metadata)

  // 等待一小段时间，避免浏览器阻止多个下载
  await new Promise(resolve => setTimeout(resolve, 300))

  // 导出每个分组的详细数据
  for (let i = 0; i < allGroups.length; i++) {
    const group = allGroups[i]

    // 等待一小段时间,避免浏览器阻止多个下载
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    const groupData = {
      id: group.id,
      name: group.name,
      icon: group.icon,
      detail: group.detail,
      order: group.order,
      emojis: (group.emojis || []).map((e: any) => ({
        id: e.id,
        packet: e.packet,
        name: e.name,
        url: e.url,
        displayUrl: e.displayUrl,
        width: e.width,
        height: e.height,
        groupId: group.id
      }))
    }

    onProgress?.(i + 2, total, group.name)
    downloadJson(`group-${group.id}.json`, groupData)
  }
}
