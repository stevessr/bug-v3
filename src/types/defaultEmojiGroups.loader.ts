import type { DefaultEmojiData, EmojiGroup } from './emoji'

/**
 * 运行时加载默认表情组数据
 * 从 gzipLoader 加载压缩的默认数据
 */
export async function loadDefaultEmojiGroups(): Promise<EmojiGroup[]> {
  const { loadDefaultGroups } = await import('../utils/gzipLoader')
  return await loadDefaultGroups()
}

/**
 * 运行时加载打包的默认数据
 * 包含表情组和设置配置
 */
export async function loadPackagedDefaults(): Promise<DefaultEmojiData> {
  const { loadDefaultGroups } = await import('../utils/gzipLoader')
  const groups = await loadDefaultGroups()

  // 返回固定的设置配置
  return {
    groups,
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
