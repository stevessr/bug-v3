/**
 * 加载并解压缩 brotli 压缩的 bilibili 表情索引数据
 * 破坏性更新：只支持压缩版本，不提供降级方案
 */
import { isGzipSupported, decompressGzip } from './gzipLoader'

export async function loadCompressedBilibiliEmojiIndex(): Promise<Record<string, Record<string, string>>> {
  if (!isGzipSupported()) {
    throw new Error('❌ 浏览器不支持 Gzip 解压缩，无法加载 bilibili 表情索引数据')
  }

  const compressedUrl = '/assets/bilibiliEmojiIndex.json.gz'
  try {
    const response = await fetch(compressedUrl)
    if (!response.ok) throw new Error(`❌ 无法获取压缩的 bilibili 表情索引文件: HTTP ${response.status}`)

    const compressedData = await response.arrayBuffer()
    const decompressed = await decompressGzip(compressedData)
    const jsonString = new TextDecoder().decode(decompressed)
    const data = JSON.parse(jsonString)

    if (!data || typeof data !== 'object') throw new Error('❌ 压缩文件格式无效：不是有效的对象')

    console.log(`✅ 成功加载压缩的 bilibili 表情索引：${Object.keys(data).length} 个表情包`)
    return data
  } catch (error) {
    if (error instanceof Error) throw new Error(`❌ 加载压缩的 bilibili 表情索引失败: ${error.message}`)
    throw new Error('❌ 加载压缩的 bilibili 表情索引时发生未知错误')
  }
}