/**
 * Platform Module Loader
 * 动态加载平台特定模块，减少初始 content script 体积
 */

import type { Platform } from './platformDetector'

import { createLogger } from '@/utils/logger'

const log = createLogger('PlatformLoader')

// Track loaded platforms to avoid duplicate loading
const loadedPlatforms = new Set<Platform>()

/**
 * 动态加载并初始化平台模块
 */
export async function loadPlatformModule(platform: Platform): Promise<void> {
  // Skip if already loaded
  if (loadedPlatforms.has(platform)) {
    log.info(`Platform ${platform} already loaded, skipping`)
    return
  }

  try {
    log.info(`Loading platform module: ${platform}`)

    switch (platform) {
      case 'discourse':
        // Discourse 模块已在主脚本中静态加载（因为是最常用的）
        log.info('Discourse module loaded statically')
        break

      case 'pixiv':
        {
          const { initPixiv } = await import('../../pixiv/detector')
          initPixiv()
          log.info('Pixiv module loaded and initialized')
        }
        break

      case 'bilibili':
        {
          const { initBilibili } = await import('../../bilibili/bilibili')
          initBilibili()
          log.info('Bilibili module loaded and initialized')
        }
        break

      case 'reddit':
        {
          const { initReddit } = await import('../../reddit/reddit')
          initReddit()
          log.info('Reddit module loaded and initialized')
        }
        break

      case 'x':
        {
          // X (Twitter) 需要检查设置
          const { initXIfEnabled } = await import('../Uninject')
          await initXIfEnabled()
          log.info('X module loaded and initialized')
        }
        break

      case 'xhs':
        {
          const { initXhs } = await import('../../xhs/init')
          initXhs()
          log.info('XHS (小红书) module loaded and initialized')
        }
        break

      case 'tieba':
        {
          const { initTieba } = await import('../../tieba/tieba')
          initTieba()
          log.info('Tieba module loaded and initialized')
        }
        break

      default:
        log.warn(`Unknown platform: ${platform}`)
        return
    }

    loadedPlatforms.add(platform)
  } catch (error) {
    log.error(`Failed to load platform module ${platform}:`, error)
    throw error
  }
}

/**
 * 批量加载多个平台模块
 */
export async function loadPlatformModules(platforms: Platform[]): Promise<void> {
  const loadPromises = platforms.map(platform => loadPlatformModule(platform))
  await Promise.allSettled(loadPromises)
}

/**
 * 获取已加载的平台列表
 */
export function getLoadedPlatforms(): Platform[] {
  return Array.from(loadedPlatforms)
}

/**
 * 清除已加载平台记录（用于测试）
 */
export function clearLoadedPlatforms(): void {
  loadedPlatforms.clear()
}
