import type { EmojiGroup } from '../types/emoji'

/**
 * 加载未压缩的默认表情组数据（plain JSON）。
 * 旧代码使用 gzip 压缩并在线解压，这里改为直接读取 JSON 文件以简化运行时逻辑。
 */
export async function loadDefaultGroups(): Promise<EmojiGroup[]> {
  const url = '/assets/defaultEmojiGroups.json'
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`无法获取默认表情组 JSON: HTTP ${res.status}`)
    const data = await res.json()
    if (!data || !Array.isArray(data.groups)) throw new Error('默认表情组格式无效')
    console.log(`✅ 成功加载默认表情组：${data.groups.length} 个组`)
    return data.groups
  } catch (e) {
    if (e instanceof Error) throw e
    throw new Error('加载默认表情组时发生未知错误')
  }
}
