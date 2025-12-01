import { type AppSettings } from '../types/type'
import {
  createSyncTarget,
  type CloudflareConfig,
  type SyncData,
  type SyncResult
} from '../userscript/plugins/syncTargets'

import { newStorageHelpers } from './newStorage'

// Use the CloudflareConfig from syncTargets and extend it with sync times
export interface ExtendedCloudflareConfig extends CloudflareConfig {
  lastSyncTime?: number
  lastPullTime?: number
  lastPushTime?: number
}

// Extend the SyncData interface to include favorites explicitly
export interface ExtendedSyncData extends SyncData {
  settings: AppSettings & {
    favorites?: string[]
  }
}

export interface SyncProgress {
  current: number
  total: number
  action: 'push' | 'pull' | 'test'
  message: string
}

export type ProgressCallback = (progress: SyncProgress) => void

export class CloudflareSyncService {
  private config: ExtendedCloudflareConfig | null = null
  private static instance: CloudflareSyncService | null = null

  private constructor() {}

  public static getInstance(): CloudflareSyncService {
    if (!CloudflareSyncService.instance) {
      CloudflareSyncService.instance = new CloudflareSyncService()
    }
    return CloudflareSyncService.instance
  }

  public async initialize(config?: ExtendedCloudflareConfig): Promise<boolean> {
    if (config) {
      this.config = {
        type: 'cloudflare',
        enabled: config.enabled,
        url: config.url,
        authToken: config.authToken,
        authTokenReadonly: config.authTokenReadonly,
        lastSyncTime: config.lastSyncTime,
        lastPullTime: config.lastPullTime,
        lastPushTime: config.lastPushTime
      }
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

  public getConfig(): ExtendedCloudflareConfig | null {
    return this.config
  }

  public async saveConfig(config: ExtendedCloudflareConfig): Promise<void> {
    this.config = config
    // Store sync config separately
    const chromeAPI = typeof chrome !== 'undefined' ? chrome : (globalThis as any).chrome
    console.log('[CloudflareSync] Saving config, chromeAPI available:', !!chromeAPI?.storage?.local)
    console.log('[CloudflareSync] Config to save:', config)

    if (chromeAPI?.storage?.local) {
      // Use Chrome storage in extension context
      await new Promise(resolve => {
        chromeAPI.storage.local.set({ [SYNC_CONFIG_KEY]: config }, () => {
          console.log('[CloudflareSync] Config saved to Chrome storage')
          resolve(undefined)
        })
      })
    } else {
      // Fallback to localStorage in development/standalone mode
      console.log('[CloudflareSync] Using localStorage fallback')
      try {
        localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config))
        console.log('[CloudflareSync] Config saved to localStorage')
      } catch (e) {
        console.error('[CloudflareSync] Failed to save to localStorage:', e)
      }
    }
  }

  public async loadConfig(): Promise<ExtendedCloudflareConfig | null> {
    try {
      // Load sync config separately
      const chromeAPI = typeof chrome !== 'undefined' ? chrome : (globalThis as any).chrome
      console.log(
        '[CloudflareSync] Loading config, chromeAPI available:',
        !!chromeAPI?.storage?.local
      )

      if (chromeAPI?.storage?.local) {
        // Use Chrome storage in extension context
        const config = await new Promise<any>(resolve => {
          chromeAPI.storage.local.get([SYNC_CONFIG_KEY], (result: any) => {
            console.log('[CloudflareSync] Chrome storage result:', result)
            resolve(result[SYNC_CONFIG_KEY] || null)
          })
        })

        console.log('[CloudflareSync] Loaded config from Chrome storage:', config)
        if (config && typeof config === 'object' && config.type === 'cloudflare') {
          this.config = config
          return config
        }
      } else {
        // Fallback to localStorage in development/standalone mode
        console.log('[CloudflareSync] Using localStorage fallback')
        const stored = localStorage.getItem(SYNC_CONFIG_KEY)
        if (stored) {
          const config = JSON.parse(stored)
          console.log('[CloudflareSync] Loaded config from localStorage:', config)
          if (config && typeof config === 'object' && config.type === 'cloudflare') {
            this.config = config
            return config
          }
        }
      }
    } catch (error) {
      console.error('[CloudflareSync] Failed to load config:', error)
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
    } else {
      // Fallback to localStorage
      localStorage.removeItem(SYNC_CONFIG_KEY)
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
          `[CloudflareSync] Attempt ${attempt + 1} failed, retrying in ${currentDelay}ms...`,
          error
        )

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, currentDelay))
      }
    }

    // If we get here, all retries failed
    throw lastError
  }

  public async testConnection(): Promise<SyncResult> {
    if (!this.config) {
      return {
        success: false,
        message: 'No Cloudflare configuration available',
        error: 'Missing configuration'
      }
    }

    try {
      return await this.executeWithRetry(
        async () => {
          const target = createSyncTarget(this.config!)
          return await target.test()
        },
        3,
        1000
      )
    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error}`,
        error
      }
    }
  }

  public async pushData(onProgress?: ProgressCallback): Promise<SyncResult> {
    if (!this.config) {
      return {
        success: false,
        message: 'No Cloudflare configuration available',
        error: 'Missing configuration'
      }
    }

    try {
      onProgress?.({ current: 0, total: 1, action: 'push', message: 'Preparing data...' })

      // Get current data from storage
      const [groups, settings] = await Promise.all([
        newStorageHelpers.getAllEmojiGroups(),
        newStorageHelpers.getSettings()
      ])

      // Include favorites in the settings, ensure it's serializable
      const syncSettings: AppSettings = {
        ...settings,
        lastModified: Date.now()
      }

      // Clean up any non-serializable data
      try {
        JSON.stringify(syncSettings)
      } catch (e) {
        console.error('[CloudflareSync] Settings contains non-serializable data:', e)
        // Try to salvage what we can
        const cleanSettings: any = {}
        for (const key in syncSettings) {
          try {
            JSON.stringify((syncSettings as any)[key])
            cleanSettings[key] = (syncSettings as any)[key]
          } catch {
            console.warn(`[CloudflareSync] Skipping non-serializable setting: ${key}`)
          }
        }
        Object.assign(syncSettings, cleanSettings)
      }

      const syncData: SyncData = {
        emojiGroups: groups,
        settings: syncSettings,
        timestamp: Date.now(),
        version: '3.0'
      }

      onProgress?.({ current: 0.5, total: 1, action: 'push', message: 'Uploading data...' })

      return await this.executeWithRetry(
        async () => {
          const target = createSyncTarget(this.config!)
          return await target.push(syncData, progress => {
            onProgress?.({
              current: progress.current,
              total: progress.total,
              action: 'push',
              message: `Uploading data (${progress.current}/${progress.total})...`
            })
          })
        },
        3,
        2000
      )
    } catch (error) {
      return {
        success: false,
        message: `Push failed: ${error}`,
        error
      }
    }
  }

  public async pullData(
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; data?: SyncData; error?: any; message: string }> {
    if (!this.config) {
      return {
        success: false,
        message: 'No Cloudflare configuration available',
        error: 'Missing configuration'
      }
    }

    try {
      onProgress?.({ current: 0, total: 1, action: 'pull', message: 'Fetching data...' })

      return await this.executeWithRetry(
        async () => {
          const target = createSyncTarget(this.config!)
          const result = await target.pull(progress => {
            onProgress?.({
              current: progress.current,
              total: progress.total,
              action: 'pull',
              message: `Downloading data (${progress.current}/${progress.total})...`
            })
          })

          if (result.success && result.data) {
            // Update sync time in config
            const updatedConfig = { ...this.config!, lastPullTime: Date.now() }
            await this.saveConfig(updatedConfig)

            // Merge the pulled data with local data
            await this.mergeSyncData(result.data)

            result.message = `Data pulled successfully. ${result.message}`
          }

          return result
        },
        3,
        2000
      )
    } catch (error) {
      return {
        success: false,
        message: `Pull failed: ${error}`,
        error
      }
    }
  }

  private async mergeSyncData(remoteData: SyncData): Promise<void> {
    try {
      // Get current local data
      const [localGroups, localSettings, localFavorites] = await Promise.all([
        newStorageHelpers.getAllEmojiGroups(),
        newStorageHelpers.getSettings(),
        newStorageHelpers.getFavorites()
      ])

      // Merge groups: prefer remote groups but preserve local-only groups if needed
      const remoteGroupIds = new Set(remoteData.emojiGroups.map(g => g.id))
      const localOnlyGroups = localGroups.filter(g => !remoteGroupIds.has(g.id))

      // For overlapping groups, prefer remote data (more recent sync)
      const mergedGroups = [
        ...localOnlyGroups, // Keep local-only groups
        ...remoteData.emojiGroups // Add remote groups (potentially overwriting local)
      ]

      // Merge settings: prefer remote settings but preserve local-only settings
      const mergedSettings = { ...localSettings, ...remoteData.settings }
      // Ensure lastModified is updated to avoid sync conflicts
      mergedSettings.lastModified = Date.now()

      // Get favorites from remote data (they might be in settings or separate)
      let remoteFavorites: string[] = []
      if (
        (remoteData as ExtendedSyncData).settings &&
        Array.isArray((remoteData as ExtendedSyncData).settings.favorites)
      ) {
        remoteFavorites = (remoteData as ExtendedSyncData).settings.favorites as string[]
      }

      // Merge favorites: combine both sets
      const mergedFavorites = Array.from(new Set([...localFavorites, ...remoteFavorites]))

      // Save merged data
      await Promise.all([
        newStorageHelpers.setAllEmojiGroups(mergedGroups),
        newStorageHelpers.setSettings(mergedSettings),
        newStorageHelpers.setFavorites(mergedFavorites)
      ])
    } catch (error) {
      console.error('[CloudflareSync] Error merging sync data:', error)
      throw error
    }
  }

  public async sync(
    direction: 'push' | 'pull' | 'both',
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; message: string }> {
    if (!this.config) {
      return { success: false, message: 'No Cloudflare configuration available' }
    }

    try {
      const result: { success: boolean; message: string } = { success: true, message: '' }

      if (direction === 'push' || direction === 'both') {
        const pushResult = await this.pushData(onProgress)
        if (!pushResult.success) {
          return { success: false, message: `Push failed: ${pushResult.message}` }
        }
        result.message += 'Push completed. '
      }

      if (direction === 'pull' || direction === 'both') {
        const pullResult = await this.pullData(onProgress)
        if (!pullResult.success) {
          return { success: false, message: `Pull failed: ${pullResult.message}` }
        }
        result.message += 'Pull completed. '
      }

      if (direction === 'both') {
        result.message = 'Bidirectional sync completed.'
      } else if (direction === 'push') {
        result.message = 'Push completed.'
      } else if (direction === 'pull') {
        result.message = 'Pull completed.'
      }

      // Update last sync time
      const updatedConfig = { ...this.config, lastSyncTime: Date.now() }
      await this.saveConfig(updatedConfig)

      return result
    } catch (error) {
      return { success: false, message: `Sync failed: ${error}` }
    }
  }

  public isConfigured(): boolean {
    return !!this.config && this.config.enabled
  }

  // Preview cloud data without merging
  public async previewCloudData(
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; data?: SyncData; error?: any; message: string }> {
    if (!this.config) {
      return {
        success: false,
        message: 'No Cloudflare configuration available',
        error: 'Missing configuration'
      }
    }

    try {
      onProgress?.({ current: 0, total: 1, action: 'pull', message: 'Fetching cloud data...' })

      return await this.executeWithRetry(
        async () => {
          const target = createSyncTarget(this.config!)
          const result = await target.pull(progress => {
            onProgress?.({
              current: progress.current,
              total: progress.total,
              action: 'pull',
              message: `Previewing cloud data (${progress.current}/${progress.total})...`
            })
          })

          if (result.success && result.data) {
            result.message = `Cloud data previewed successfully. ${result.message}`
          }

          return result
        },
        3,
        2000
      )
    } catch (error) {
      return {
        success: false,
        message: `Preview failed: ${error}`,
        error
      }
    }
  }

  // Preview cloud config only (get group list without detailed emoji data)
  public async previewCloudConfig(
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; config?: any; error?: any; message: string }> {
    if (!this.config) {
      return {
        success: false,
        message: 'No Cloudflare configuration available',
        error: 'Missing configuration'
      }
    }

    try {
      onProgress?.({ current: 0, total: 1, action: 'test', message: 'Fetching cloud config...' })

      return await this.executeWithRetry(
        async () => {
          const target = createSyncTarget(this.config!)

          // First test connection
          const testResult = await target.test(progress => {
            onProgress?.({
              current: progress.current,
              total: progress.total,
              action: 'test',
              message: `Checking cloud config (${progress.current}/${progress.total})...`
            })
          })

          if (!testResult.success) {
            return {
              success: false,
              message: `Cloud config check failed: ${testResult.message}`,
              error: testResult.error
            }
          }

          // If connection test passes, try to fetch group list only
          onProgress?.({ current: 1, total: 2, action: 'pull', message: 'Fetching group list...' })

          try {
            const previewResult = await target.preview(progress => {
              onProgress?.({
                current: progress.current + 1,
                total: progress.total + 1,
                action: 'pull',
                message: `Fetching cloud data (${progress.current + 1}/${progress.total + 1})...`
              })
            })

            if (previewResult.success && previewResult.data) {
              const data = previewResult.data

              // Extract group list without emoji details for faster loading
              const groupList = (data.emojiGroups || []).map((group: any) => ({
                id: group.id,
                name: group.name,
                createdAt: group.createdAt,
                lastModified: group.lastModified,
                emojiCount: group.emojiCount || 0,
                // Don't include the actual emojis array for preview
                _hasEmojis: (group.emojiCount || 0) > 0
              }))

              return {
                success: true,
                config: {
                  timestamp: data.timestamp || Date.now(),
                  version: data.version || '1.0',
                  hasData: true,
                  connectionTest: true,
                  // Include settings and group list only
                  settings: data.settings || {},
                  emojiGroups: groupList,
                  metadata: {
                    totalGroups: groupList.length,
                    totalEmojis: groupList.reduce(
                      (total: number, group: any) => total + group.emojiCount,
                      0
                    ),
                    favoritesCount: data.settings?.favorites?.length || 0,
                    lastModified: data.settings?.lastModified || data.timestamp,
                    // Flag to indicate this is preview data (no emoji details)
                    isPreview: true
                  }
                },
                message: 'Cloud configuration previewed successfully'
              }
            } else {
              // Connection successful but no data available
              return {
                success: true,
                config: {
                  timestamp: Date.now(),
                  version: '1.0',
                  hasData: false,
                  connectionTest: true,
                  settings: {},
                  emojiGroups: [],
                  metadata: {
                    totalGroups: 0,
                    totalEmojis: 0,
                    favoritesCount: 0,
                    lastModified: null,
                    isPreview: true
                  }
                },
                message: 'Cloud configuration accessible but no data available'
              }
            }
          } catch (pullError) {
            // Connection test passed but data fetch failed
            return {
              success: true,
              config: {
                timestamp: Date.now(),
                version: '1.0',
                hasData: false,
                connectionTest: true,
                error: 'Data fetch failed',
                settings: {},
                emojiGroups: [],
                metadata: {
                  totalGroups: 0,
                  totalEmojis: 0,
                  favoritesCount: 0,
                  lastModified: null,
                  isPreview: true
                }
              },
              message: 'Cloud configuration accessible but could not fetch data'
            }
          }
        },
        3,
        2000
      )
    } catch (error) {
      return {
        success: false,
        message: `Config preview failed: ${error}`,
        error
      }
    }
  }

  // Load specific group details (lazy loading)
  public async loadGroupDetails(
    groupName: string,
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; group?: any; error?: any; message: string }> {
    if (!this.config) {
      return {
        success: false,
        message: 'No Cloudflare configuration available',
        error: 'Missing configuration'
      }
    }

    try {
      return await this.executeWithRetry(
        async () => {
          const target = createSyncTarget(this.config!)
          if (target.getGroupDetails) {
            return await target.getGroupDetails(groupName, onProgress)
          } else {
            return {
              success: false,
              message: 'Sync target does not support loading group details',
              error: 'Not implemented'
            }
          }
        },
        3,
        2000
      )
    } catch (error) {
      return {
        success: false,
        message: `Failed to load group details for ${groupName}: ${error}`,
        error
      }
    }
  }
}

// Key for storing sync configuration in extension storage
const SYNC_CONFIG_KEY = 'emoji_extension_cloudflare_sync_config'

// Export a singleton instance
export const cloudflareSyncService = CloudflareSyncService.getInstance()
