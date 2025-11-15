/**
 * Universal Sync Service
 * Handles multiple sync targets (WebDAV, S3, Cloudflare)
 */

import { cloudflareSyncService, type ExtendedCloudflareConfig } from './cloudflareSync'
import {
  type SyncConfig as ExtensionSyncConfig,
  type SyncResult,
  createSyncTarget
} from './extensionSync'

// Extend the config interface to include all sync types
export type UniversalSyncConfig = ExtensionSyncConfig | ExtendedCloudflareConfig

class UniversalSyncService {
  private config: UniversalSyncConfig | null = null
  private static instance: UniversalSyncService | null = null

  private constructor() {}

  public static getInstance(): UniversalSyncService {
    if (!UniversalSyncService.instance) {
      UniversalSyncService.instance = new UniversalSyncService()
    }
    return UniversalSyncService.instance
  }

  public async initialize(config?: UniversalSyncConfig): Promise<boolean> {
    if (config) {
      this.config = config
      return true
    } else {
      // Try to load from storage
      const storedConfig = await this.loadConfig()
      if (storedConfig) {
        this.config = storedConfig
        return true
      }
      return false
    }
  }

  public getConfig(): UniversalSyncConfig | null {
    return this.config
  }

  public async saveConfig(config: UniversalSyncConfig): Promise<void> {
    this.config = config
    // Store sync config separately
    const chromeAPI = typeof chrome !== 'undefined' ? chrome : (globalThis as any).chrome
    if (chromeAPI?.storage?.local) {
      await new Promise(resolve => {
        chromeAPI.storage.local.set({ [SYNC_CONFIG_KEY]: config }, () => {
          resolve(undefined)
        })
      })
    }
  }

  public async loadConfig(): Promise<UniversalSyncConfig | null> {
    try {
      // Load sync config separately
      const chromeAPI = typeof chrome !== 'undefined' ? chrome : (globalThis as any).chrome
      if (chromeAPI?.storage?.local) {
        const config = await new Promise<any>(resolve => {
          chromeAPI.storage.local.get([SYNC_CONFIG_KEY], (result: any) => {
            resolve(result[SYNC_CONFIG_KEY] || null)
          })
        })

        if (
          config &&
          typeof config === 'object' &&
          ['webdav', 's3', 'cloudflare'].includes(config.type)
        ) {
          this.config = config
          return config
        }
      }
    } catch (error) {
      console.error('[UniversalSync] Failed to load config:', error)
    }
    return null
  }

  public async clearConfig(): Promise<void> {
    this.config = null
    const chromeAPI = typeof chrome !== 'undefined' ? chrome : (globalThis as any).chrome
    if (chromeAPI?.storage?.local) {
      await new Promise(resolve => {
        chromeAPI.storage.local.remove([SYNC_CONFIG_KEY], () => {
          resolve(undefined)
        })
      })
    }
  }

  /**
   * Executes an async operation with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000,
    exponentialBackoff: boolean = true
  ): Promise<T> {
    let lastError: any = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error
        if (attempt === maxRetries) {
          // Last attempt, throw the error
          break
        }

        // Calculate delay with exponential backoff
        const currentDelay = exponentialBackoff ? delay * Math.pow(2, attempt) : delay
        console.warn(
          `[UniversalSync] Attempt ${attempt + 1} failed, retrying in ${currentDelay}ms...`,
          error
        )

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, currentDelay))
      }
    }

    // If we get here, all retries failed
    throw lastError
  }

  // Since sync operations require access to the store's data,
  // we'll implement the actual sync methods in the emoji store
  // and just provide type definitions and delegation here

  public async testConnection(): Promise<SyncResult> {
    if (!this.config) {
      return {
        success: false,
        message: 'No sync configuration available',
        error: 'Missing configuration'
      }
    }

    try {
      const target = createSyncTarget(this.config)
      return await target.test()
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error}`,
        error
      }
    }
  }

  public isConfigured(): boolean {
    return !!this.config && this.config.enabled
  }
}

// Key for storing sync configuration in extension storage
const SYNC_CONFIG_KEY = 'emoji_extension_universal_sync_config'

// Export a singleton instance
export const universalSyncService = UniversalSyncService.getInstance()
