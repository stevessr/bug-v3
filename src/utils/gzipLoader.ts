import type { EmojiGroup } from '../types/emoji'

/**
 * 加载并解压缩 gzip 压缩的默认表情组数据
 * 非 https 下可能无法使用 DecompressionStream('gzip')，调用方应处理异常
 */
export async function loadGzipDefaultGroups(): Promise<EmojiGroup[]> {
  if (!isGzipSupported()) {
    throw new Error('❌ 浏览器不支持 Gzip 解压缩，无法加载配置数据')
  }

  const compressedUrl = '/assets/defaultEmojiGroups.json.gz'
  try {
    const response = await fetch(compressedUrl)
    if (!response.ok) {
      throw new Error(`❌ 无法获取压缩配置文件: HTTP ${response.status}`)
    }

    const compressedData = await response.arrayBuffer()
    const decompressed = await decompressGzip(compressedData)
    const jsonString = new TextDecoder().decode(decompressed)
    const data = JSON.parse(jsonString)

    if (!data || !Array.isArray(data.groups)) {
      throw new Error('❌ 压缩文件格式无效：缺少 groups 数组')
    }

    console.log(`✅ 成功加载 gzip 配置：${data.groups.length} 个表情组`)
    return data.groups
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`❌ 加载 gzip 配置失败: ${error.message}`)
    }
    throw new Error('❌ 加载 gzip 配置时发生未知错误')
  }
}

export function isGzipSupported(): boolean {
  try {
    if (typeof DecompressionStream === 'undefined') return false
    const stream = new DecompressionStream('gzip')
    stream.readable.cancel()
    return true
  } catch {
    return false
  }
}

export async function decompressGzip(compressedData: ArrayBuffer): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream API 不可用')
  }
  try {
    const stream = new DecompressionStream('gzip')
    const writer = stream.writable.getWriter()
    const reader = stream.readable.getReader()

    await writer.write(new Uint8Array(compressedData))
    await writer.close()

    const chunks: Uint8Array[] = []
    let done = false
    while (!done) {
      const { value, done: readerDone } = await reader.read()
      done = readerDone
      if (value) chunks.push(value)
    }

    const totalLength = chunks.reduce((s, c) => s + c.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    return result
  } catch (error) {
    throw new Error(`Gzip 解压缩失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}
