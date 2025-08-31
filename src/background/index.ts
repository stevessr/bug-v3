// background/index.ts - background broker
// Listens for runtime messages and supports broadcasting to other extension contexts and content scripts.

declare const chrome: any
declare const browser: any

import { getRuntimeSyncConfig } from '../data/sync-config'
import { createBackgroundCommService } from '../services/communication'
import { appendTelemetry } from './utils/storage-utils'
import { setupChromeMessageListener, setupFirefoxMessageListener, setupChromeConnectListener } from './handlers/message-handlers'
import globalDataManager from './data-manager'
import globalBroadcaster from './message-broadcaster'

// 创建通信服务实例
const commService = createBackgroundCommService()

// runtime-configurable sync params (will be populated async)
const CONFIG: { ACK_TIMEOUT_MS: number; MAX_RETRIES: number; POLL_INTERVAL_MS: number } = {
  ACK_TIMEOUT_MS: 3000,
  MAX_RETRIES: 3,
  POLL_INTERVAL_MS: 1000,
}

// populate from chrome.storage.local if available
try {
  getRuntimeSyncConfig().then((cfg) => {
    try {
      Object.assign(CONFIG, cfg)
      log('Sync config loaded', CONFIG)
    } catch (_) {}
  })
} catch (_) {}

// Simple sync manager
const SyncManager = {
  onLocalPayloadUpdated(payload: any) {
    try {
      // 使用全局数据管理器更新状态
      globalDataManager.handlePayloadUpdate(payload)
      log('SyncManager: local updated via data manager')
      appendTelemetry({ event: 'local_payload_updated' })
      
      // 广播更新到所有页面
      globalBroadcaster.broadcastMessage('payload-updated', payload, 'background')
    } catch (error) {
      log('SyncManager error:', error)
    }
  }
}

function log(...args: any[]) {
  try {
    console.log('[background]', ...args)
  } catch (_) {}
}

// Initialize data manager and set up broadcasting
;(async () => {
  try {
    log('🚀 Initializing background service...')
    
    // 初始化全局数据管理器
    await globalDataManager.initialize()
    
    const stats = globalDataManager.getStats()
    log('✅ Background service initialized successfully:', stats)
    
    // 设置数据更新监听器
    globalDataManager.addUpdateListener(() => {
      const newStats = globalDataManager.getStats()
      log('📡 Data updated, broadcasting to connected clients:', newStats)
      
      // 广播数据更新到所有连接的页面
      try {
        const data = globalDataManager.getData()
        
        // 使用新的广播系统发送更新
        globalBroadcaster.broadcastMessage('app:groups-changed', data.emojiGroups, 'background')
        globalBroadcaster.broadcastMessage('app:settings-changed', data.settings, 'background')
        globalBroadcaster.broadcastMessage('app:ungrouped-changed', { 
          emojis: data.ungroupedEmojis, 
          timestamp: Date.now() 
        }, 'background')
        
        // 分别广播不同类型的表情组
        const normalGroups = data.emojiGroups.filter((g: any) => g.UUID !== 'common-emoji-group')
        const commonGroup = data.emojiGroups.find((g: any) => g.UUID === 'common-emoji-group')
        
        if (normalGroups.length > 0) {
          globalBroadcaster.broadcastMessage('app:normal-groups-changed', { 
            groups: normalGroups, 
            timestamp: Date.now() 
          }, 'background')
        }
        
        if (commonGroup) {
          globalBroadcaster.broadcastMessage('app:common-group-changed', { 
            group: commonGroup, 
            timestamp: Date.now() 
          }, 'background')
        }
        
        log('📡 All data updates broadcast via new system')
      } catch (broadcastError) {
        log('Failed to broadcast data update:', broadcastError)
      }
    })
    
    // 设置定期状态广播
    setInterval(() => {
      const status = globalBroadcaster.getQueueStatus()
      if (status.queueSize > 10) {
        log('⚠️ Message broadcaster queue status:', status)
      }
      
      // 定期广播心跳以保持连接
      globalBroadcaster.broadcastMessage('background:heartbeat', {
        timestamp: Date.now(),
        stats: globalDataManager.getStats()
      }, 'background')
    }, 30000) // 每30秒
    
  } catch (err) {
    log('❌ Failed to initialize background service:', err)
  }
})()

// Setup message listeners with data manager and broadcaster
setupChromeMessageListener(
  globalDataManager,
  commService,
  SyncManager
)

setupFirefoxMessageListener(
  globalDataManager,
  commService,
  SyncManager
)

setupChromeConnectListener()

// Export for debugging
if (typeof globalThis !== 'undefined') {
  (globalThis as any).debugBackground = {
    dataManager: globalDataManager,
    broadcaster: globalBroadcaster,
    getStats: () => ({
      dataManager: globalDataManager.getStats(),
      broadcaster: globalBroadcaster.getQueueStatus()
    })
  }
}