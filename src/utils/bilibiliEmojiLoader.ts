/**
 * 加载并解压缩 brotli 压缩的 bilibili 表情索引数据
 * 破坏性更新：只支持压缩版本，不提供降级方案
 */
export async function loadCompressedBilibiliEmojiIndex(): Promise<Record<string, Record<string, string>>> {
  // 检查浏览器支持
  if (!isBrotliSupported()) {
    throw new Error('❌ 浏览器不支持 Brotli 解压缩，无法加载 bilibili 表情索引数据')
  }

  const compressedUrl = '/assets/bilibiliEmojiIndex.json.br'
  
  try {
    const response = await fetch(compressedUrl)
    
    if (!response.ok) {
      throw new Error(`❌ 无法获取压缩的 bilibili 表情索引文件: HTTP ${response.status}`)
    }

    const compressedData = await response.arrayBuffer()
    const decompressed = await decompressBrotli(compressedData)
    const jsonString = new TextDecoder().decode(decompressed)
    const data = JSON.parse(jsonString)
    
    if (!data || typeof data !== 'object') {
      throw new Error('❌ 压缩文件格式无效：不是有效的对象')
    }

    console.log(`✅ 成功加载压缩的 bilibili 表情索引：${Object.keys(data).length} 个表情包`)
    return data
    
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`❌ 加载压缩的 bilibili 表情索引失败: ${error.message}`)
    }
    throw new Error('❌ 加载压缩的 bilibili 表情索引时发生未知错误')
  }
}

/**
 * 检查浏览器是否支持 brotli 解压缩
 * 严格检查：只有真正支持 DecompressionStream 才返回 true
 */
export function isBrotliSupported(): boolean {
  try {
    // 严格检查 DecompressionStream API 和 brotli 支持
    if (typeof DecompressionStream === 'undefined') {
      return false
    }
    
    // 尝试创建 brotli 解压缩流来验证支持
    const stream = new DecompressionStream('br')
    stream.readable.cancel() // 立即取消以避免资源泄漏
    return true
  } catch {
    return false
  }
}

/**
 * 使用浏览器原生 DecompressionStream API 解压缩 brotli 数据
 * 严格模式：不提供降级方案
 */
async function decompressBrotli(compressedData: ArrayBuffer): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream API 不可用')
  }

  try {
    const stream = new DecompressionStream('br')
    const writer = stream.writable.getWriter()
    const reader = stream.readable.getReader()
    
    // 写入压缩数据
    await writer.write(new Uint8Array(compressedData))
    await writer.close()
    
    // 读取解压缩后的数据
    const chunks: Uint8Array[] = []
    let done = false
    
    while (!done) {
      const { value, done: readerDone } = await reader.read()
      done = readerDone
      if (value) {
        chunks.push(value)
      }
    }
    
    // 合并所有数据块
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    
    return result
    
  } catch (error) {
    throw new Error(`Brotli 解压缩失败: ${error instanceof Error ? error.message : '未知错误'}`)
  }
}