import './utils/main.ts'

import { setupOnInstalledListener } from './init'
import {
  setupMcpBridge,
  setupMessageListener,
  setupStorageChangeListener,
  setupContextMenu,
  setupPeriodicCleanup
} from './utils/handlers'
import { setupScheduledLikes } from './handlers/scheduledLikes'
import { setupScheduledBrowse } from './handlers/scheduledBrowse'

console.log('Emoji Extension Background script loaded.')

// 必须同步初始化的核心监听
setupOnInstalledListener()
setupMessageListener()
setupStorageChangeListener()
setupContextMenu()
setupPeriodicCleanup()

// Service Worker 里不能使用 Vite 的 DOM-based dynamic-import preload helper。
// 模块静态打包，初始化仍放到微任务里，避免阻塞核心监听注册。
void Promise.resolve().then(() => {
  try {
    void setupMcpBridge()
    setupScheduledLikes()
    setupScheduledBrowse()
  } catch (err) {
    console.error('[Background] Failed to initialize background modules:', err)
  }
})
