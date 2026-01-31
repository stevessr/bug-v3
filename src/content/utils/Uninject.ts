/**
 * Platform Module Initializer (重构版)
 * 移除静态导入，改为动态加载
 * 保留向后兼容的 API
 */

import { requestSettingFromBackground } from './core'

import { createLogger } from '@/utils/logger'

const log = createLogger('Uninject')

/**
 * @deprecated 使用 platformLoader.ts 中的 loadPlatformModule 替代
 * 保留此函数仅用于向后兼容
 */
export async function Uninject(): Promise<void> {
  log.warn('Uninject() is deprecated, use platformLoader.loadPlatformModule() instead')

  // 动态加载所有平台模块
  const platforms = ['pixiv', 'bilibili', 'reddit', 'xhs'] as const

  const loadPromises = platforms.map(async platform => {
    try {
      const { loadPlatformModule } = await import('./core/platformLoader')
      await loadPlatformModule(platform)
    } catch (e) {
      log.error(`Failed to load ${platform}:`, e)
    }
  })

  // 特殊处理 X (需要检查设置)
  loadPromises.push(initXIfEnabled())

  await Promise.allSettled(loadPromises)
}

/**
 * 检查设置并初始化 X 平台功能
 */
export async function initXIfEnabled(): Promise<void> {
  try {
    const val = await requestSettingFromBackground('enableXcomExtraSelectors')
    const enabled = val === null || val === undefined || val === true

    if (val === null || val === undefined) {
      log.info('enableXcomExtraSelectors unavailable; defaulting to enabled for X injection')
    } else {
      log.info('Fetched enableXcomExtraSelectors from background:', val)
    }

    log.info('X init decision - enabled:', enabled)

    if (enabled) {
      try {
        const { initX } = await import('../x/init')
        initX()
        log.info('X module initialized')
      } catch (innerErr) {
        log.error('initX threw an error during invocation', innerErr)
      }
    } else {
      log.info('Skipping X init: enableXcomExtraSelectors disabled in settings')
    }
  } catch (err) {
    log.error('initX check failed', err)
  }
}
