/**
 * Sync Store
 * Handles cloud synchronization with Cloudflare, WebDAV, S3, etc.
 */

import type { Ref } from 'vue'

import type { ProgressCallback } from './core/types'

import type { EmojiGroup, AppSettings } from '@/types/type'
import { cloudflareSyncService } from '@/utils/cloudflareSync'
import {
  saveSyncConfig as saveSyncConfigToStorage,
  loadSyncConfig as loadSyncConfigFromStorage
} from '@/utils/syncConfigStorage'
import { createSyncTarget } from '@/utils/syncTargets'
import type { SyncTargetConfig } from '@/utils/syncTargets'

export interface SyncStoreOptions {
  groups: Ref<EmojiGroup[]>
  settings: Ref<AppSettings>
  favorites: Ref<Set<string>>
}

export interface SyncResult {
  success: boolean
  message: string
  error?: unknown
}

export function useSyncStore(_options: SyncStoreOptions) {
  // Note: _options is prefixed with underscore to indicate it may be used in future
  // when we need to pass store data directly to sync functions

  // --- Sync Configuration ---

  /**
   * Initialize sync services
   */
  const initializeSync = async (): Promise<void> => {
    await cloudflareSyncService.initialize()
  }

  /**
   * Save sync configuration
   */
  const saveSyncConfig = async (config: SyncTargetConfig): Promise<void> => {
    await saveSyncConfigToStorage(config)
    if (config.type === 'cloudflare') {
      await cloudflareSyncService.saveConfig(config)
    }
  }

  /**
   * Load sync configuration
   */
  const loadSyncConfig = async (): Promise<SyncTargetConfig | null> => {
    return await loadSyncConfigFromStorage()
  }

  /**
   * Test sync connection
   * @param tempConfig - Optional temporary configuration to test (uses saved config if not provided)
   */
  const testSyncConnection = async (tempConfig?: SyncTargetConfig): Promise<SyncResult> => {
    const config = tempConfig || (await loadSyncConfig())
    if (!config) {
      return {
        success: false,
        message: 'No sync configuration found',
        error: 'Missing configuration'
      }
    }

    try {
      const target = createSyncTarget(config)
      return await target.test()
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error}`,
        error
      }
    }
  }

  /**
   * Check if sync is configured
   */
  const isSyncConfigured = (): boolean => {
    return cloudflareSyncService.isConfigured()
  }

  // --- Cloudflare Sync Operations ---

  /**
   * Sync with Cloudflare (push/pull/both)
   */
  const syncToCloudflare = async (
    direction: 'push' | 'pull' | 'both' = 'both',
    onProgress?: ProgressCallback
  ): Promise<SyncResult> => {
    return await cloudflareSyncService.sync(direction, onProgress)
  }

  /**
   * Preview cloud data without applying changes
   */
  const previewCloudData = async (onProgress?: ProgressCallback) => {
    return await cloudflareSyncService.previewCloudData(onProgress)
  }

  /**
   * Preview cloud config
   */
  const previewCloudConfig = async (onProgress?: ProgressCallback) => {
    return await cloudflareSyncService.previewCloudConfig(onProgress)
  }

  /**
   * Load group details from cloud
   */
  const loadGroupDetails = async (groupName: string, onProgress?: ProgressCallback) => {
    return await cloudflareSyncService.loadGroupDetails(groupName, onProgress)
  }

  /**
   * Push data to Cloudflare
   */
  const pushToCloudflare = async (): Promise<SyncResult> => {
    return await cloudflareSyncService.pushData()
  }

  /**
   * Pull data from Cloudflare
   */
  const pullFromCloudflare = async (): Promise<SyncResult> => {
    return await cloudflareSyncService.pullData()
  }

  return {
    // Configuration
    initializeSync,
    saveSyncConfig,
    loadSyncConfig,
    testSyncConnection,
    isSyncConfigured,

    // Cloudflare operations
    syncToCloudflare,
    previewCloudData,
    previewCloudConfig,
    loadGroupDetails,
    pushToCloudflare,
    pullFromCloudflare
  }
}

export type SyncStore = ReturnType<typeof useSyncStore>
