/**
 * X.com 自动下载功能
 * 整合管理器、设置界面和图片观察器
 */

export { AutoDownloadManager, getAutoDownloadManager } from './manager'
export type { AutoDownloadSettings } from './manager'
export { AutoDownloadSettingsUI } from './settingsUI'
export { startImageObserver, stopImageObserver } from './observer'

import { getAutoDownloadManager } from './manager'
import { AutoDownloadSettingsUI } from './settingsUI'
import { startImageObserver } from './observer'

let settingsUI: AutoDownloadSettingsUI | null = null

/**
 * 初始化自动下载功能
 */
export async function initAutoDownload(): Promise<void> {
  try {
    console.log('[XAutoDownload] Initializing...')

    // 初始化管理器
    const manager = getAutoDownloadManager()
    await manager.init()

    // 创建设置界面
    settingsUI = new AutoDownloadSettingsUI()
    await settingsUI.init()

    // 启动图片观察器
    startImageObserver()

    console.log('[XAutoDownload] Initialized successfully')
  } catch (error) {
    console.error('[XAutoDownload] Initialization failed:', error)
  }
}
