import './utils/main.ts'

import { setupOnInstalledListener } from './init'
import {
  setupMessageListener,
  setupStorageChangeListener,
  setupContextMenu,
  setupPeriodicCleanup
} from './utils/handlers'

console.log('Emoji Extension Background script loaded.')

// 必须同步初始化的核心监听
setupOnInstalledListener()
setupMessageListener()
setupStorageChangeListener()
setupContextMenu()
setupPeriodicCleanup()

// 大体积 / 延迟可接受的功能：异步动态加载，
// 让 Service Worker 冷启动阶段不必解析 mcpBridge、scheduledLikes/Browse 等模块
void (async () => {
  try {
    const [{ setupMcpBridge }, { setupScheduledLikes }, { setupScheduledBrowse }] =
      await Promise.all([
        import('./handlers/mcpBridge'),
        import('./handlers/scheduledLikes'),
        import('./handlers/scheduledBrowse')
      ])
    void setupMcpBridge()
    setupScheduledLikes()
    setupScheduledBrowse()
  } catch (err) {
    console.error('[Background] Failed to lazy-load background modules:', err)
  }
})()
