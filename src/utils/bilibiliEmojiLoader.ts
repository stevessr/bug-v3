/**
 * 加载 bilibili 表情索引的未压缩 JSON 版本
 */
export async function loadBilibiliEmojiIndex(): Promise<Record<string, Record<string, string>>> {
  const url = '/assets/bilibiliEmojiIndex.json'
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`无法获取 bilibili 表情索引 JSON: HTTP ${res.status}`)
    const data = await res.json()
    if (!data || typeof data !== 'object') throw new Error('bilibili 表情索引格式无效')
    console.log(`✅ 成功加载 bilibili 表情索引：${Object.keys(data).length} 个条目`)
    return data as Record<string, Record<string, string>>
  } catch (e) {
    if (e instanceof Error) throw e
    throw new Error('加载 bilibili 表情索引时发生未知错误')
  }
}
