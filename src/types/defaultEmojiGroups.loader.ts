import type { DefaultEmojiData, EmojiGroup } from './emoji'

/**
 * 加载默认表情组数据
 * 破坏性更新：只支持压缩版本，不提供降级方案
 */
export async function loadDefaultEmojiGroups(): Promise<EmojiGroup[]> {
  const { loadGzipDefaultGroups } = await import('../utils/gzipLoader')
  return await loadGzipDefaultGroups()
}

/**
 * 加载打包的默认数据
 * 破坏性更新：只支持压缩版本，不提供降级方案
 */
export async function loadPackagedDefaults(): Promise<DefaultEmojiData> {
  const { loadGzipDefaultGroups } = await import('../utils/gzipLoader')
  const groups = await loadGzipDefaultGroups()
  
  // 返回固定的设置配置（不再从文件读取）
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
