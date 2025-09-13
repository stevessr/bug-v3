import type { DefaultEmojiData, EmojiGroup } from './emoji'

// 在运行时从打包的 JSON 动态加载默认表情分组。
// 优先使用 fetch('/assets/defaultEmojiGroups.json')，若失败则尝试回退到构建时自动生成的模块（仅在开发/构建环境中可用）。

async function fetchPackagedJSON(): Promise<DefaultEmojiData | null> {
  try {
    if (typeof fetch === 'undefined') return null
    const res = await fetch('/assets/defaultEmojiGroups.json', { cache: 'no-cache' })
    if (!res.ok) return null
    const data = await res.json()
    // 期望结构为 { groups: EmojiGroup[], settings: {...} }
    return data as DefaultEmojiData
  } catch (err) {
    return null
  }
}

// 不再动态导入自动生成的模块（它包含大量数据，会被打包进 JS chunk）。
// 如果 fetch 不可用或失败，直接返回 null/空数据作为回退。

export async function loadDefaultEmojiGroups(): Promise<EmojiGroup[]> {
  const packaged = await fetchPackagedJSON()
  if (packaged && Array.isArray(packaged.groups)) return packaged.groups
  return []
}

export async function loadPackagedDefaults(): Promise<DefaultEmojiData> {
  const packaged = await fetchPackagedJSON()
  if (packaged) return packaged
  // fetch 不可用时返回空结构的兜底值
  return {
    groups: [],
    settings: {
      imageScale: 30,
      defaultGroup: 'nachoneko',
      showSearchBar: true,
      gridColumns: 4,
      outputFormat: 'markdown',
      forceMobileMode: false,
      enableLinuxDoInjection: false,
      enableXcomExtraSelectors: true,
      lastModified: Date.now(),
      tenorApiKey: 'AIzaSyC-P6_qz3FzCoXGLk6tgitZo4jEJ5mLzD8'
    }
  } as unknown as DefaultEmojiData
}
