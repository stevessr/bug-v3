// Sync target interface and implementations for WebDAV and S3
// This module provides the plugin infrastructure for syncing emoji data

export interface SyncConfig {
  type: 'webdav' | 's3' | 'cloudflare'
  enabled: boolean
  lastSyncTime?: number
}

export interface WebDAVConfig extends SyncConfig {
  type: 'webdav'
  url: string
  username: string
  password: string
  path?: string // Optional path on the WebDAV server
}

export interface S3Config extends SyncConfig {
  type: 's3'
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  path?: string // Optional path prefix in the bucket
}

export interface CloudflareConfig extends SyncConfig {
  type: 'cloudflare'
  url: string
  authToken: string
  authTokenReadonly?: string
}

export type SyncTargetConfig = WebDAVConfig | S3Config | CloudflareConfig

export interface SyncResult {
  success: boolean
  message: string
  error?: unknown
  timestamp?: number
}

export interface SyncData {
  emojiGroups: unknown[]
  settings: unknown
  timestamp: number
  version: string
}

// Helper type for accessing group properties
export interface GroupLike {
  id?: string
  name?: string
  emojis?: unknown[]
  [key: string]: unknown
}

// Helper type for settings
interface SettingsLike {
  version?: string
  timestamp?: number
  [key: string]: unknown
}

export interface Progress {
  current: number
  total: number
  action: 'push' | 'pull' | 'test'
  message?: string // 可选的详细消息
}

export type ProgressCallback = (progress: Progress) => void

// Base sync target interface
export interface ISyncTarget {
  config: SyncTargetConfig
  push(data: SyncData, onProgress?: ProgressCallback): Promise<SyncResult>
  pull(
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; data?: SyncData; error?: unknown; message: string }>
  test(): Promise<SyncResult> // Test connection
  preview(
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; data?: SyncData; error?: unknown; message: string }> // Preview metadata only
  getGroupDetails(
    groupId: string,
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; group?: unknown; error?: unknown; message: string }>
}

// WebDAV implementation
export class WebDAVSyncTarget implements ISyncTarget {
  config: WebDAVConfig

  constructor(config: WebDAVConfig) {
    this.config = config
  }

  private getAuthHeader(): string {
    const credentials = btoa(`${this.config.username}:${this.config.password}`)
    return `Basic ${credentials}`
  }

  private getFullUrl(): string {
    const baseUrl = this.config.url.replace(/\/$/, '')
    const path = this.config.path || 'emoji-data.json'
    return `${baseUrl}/${path}`
  }

  async test(): Promise<SyncResult> {
    try {
      const url = this.getFullUrl()
      const response = await fetch(url, {
        method: 'HEAD',
        headers: {
          Authorization: this.getAuthHeader()
        }
      })

      if (response.ok || response.status === 404) {
        return {
          success: true,
          message: 'WebDAV connection successful',
          timestamp: Date.now()
        }
      }

      return {
        success: false,
        message: `WebDAV connection failed: ${response.statusText}`,
        error: response.statusText
      }
    } catch (error) {
      return {
        success: false,
        message: `WebDAV connection error: ${error}`,
        error
      }
    }
  }

  async push(data: SyncData, onProgress?: ProgressCallback): Promise<SyncResult> {
    try {
      const dataStr = JSON.stringify(data, null, 2)
      const dataSizeKB = (dataStr.length / 1024).toFixed(2)
      const itemCount = 1 + (data.emojiGroups?.length || 0)

      onProgress?.({
        current: 0,
        total: 1,
        action: 'push',
        message: `正在推送数据到 WebDAV (${itemCount} 项，${dataSizeKB} KB)...`
      })

      const url = this.getFullUrl()
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json; charset=UTF-8'
        },
        body: dataStr
      })

      onProgress?.({
        current: 1,
        total: 1,
        action: 'push',
        message: `✓ 已推送所有数据 (${dataSizeKB} KB)`
      })

      if (response.ok || response.status === 201 || response.status === 204) {
        return {
          success: true,
          message: 'Data pushed to WebDAV successfully',
          timestamp: Date.now()
        }
      }

      return {
        success: false,
        message: `Failed to push to WebDAV: ${response.statusText}`,
        error: response.statusText
      }
    } catch (error) {
      return {
        success: false,
        message: `Error pushing to WebDAV: ${error}`,
        error
      }
    }
  }

  async pull(
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; data?: SyncData; error?: unknown; message: string }> {
    try {
      onProgress?.({
        current: 0,
        total: 1,
        action: 'pull',
        message: '正在从 WebDAV 拉取数据...'
      })

      const url = this.getFullUrl()
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: this.getAuthHeader(),
          Accept: 'application/json'
        }
      })

      if (response.ok) {
        const data = await response.json()
        const dataSizeKB = (JSON.stringify(data).length / 1024).toFixed(2)
        const itemCount = 1 + (data.emojiGroups?.length || 0)

        onProgress?.({
          current: 1,
          total: 1,
          action: 'pull',
          message: `✓ 已拉取所有数据 (${itemCount} 项，${dataSizeKB} KB)`
        })

        return {
          success: true,
          data,
          message: 'Data pulled from WebDAV successfully'
        }
      }

      if (response.status === 404) {
        return {
          success: false,
          message: 'No data found on WebDAV server',
          error: 'File not found'
        }
      }

      return {
        success: false,
        message: `Failed to pull from WebDAV: ${response.statusText}`,
        error: response.statusText
      }
    } catch (error) {
      return {
        success: false,
        message: `Error pulling from WebDAV: ${error}`,
        error
      }
    }
  }

  async getGroupDetails(
    groupId: string,
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; group?: unknown; error?: unknown; message: string }> {
    // WebDAV does not support fetching individual groups, so we pull all data and filter
    onProgress?.({
      current: 0,
      total: 1,
      action: 'pull',
      message: 'Fetching all data to get group details...'
    })
    const result = await this.pull(onProgress)
    if (result.success && result.data) {
      const groups = result.data.emojiGroups as GroupLike[]
      const group = groups.find(g => g.id === groupId)
      if (group) {
        return { success: true, group, message: 'Group details extracted' }
      } else {
        return { success: false, message: 'Group not found', error: 'Group not found' }
      }
    }
    return { success: false, message: 'Failed to get group details', error: result.error }
  }

  async preview(
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; data?: SyncData; error?: unknown; message: string }> {
    // WebDAV doesn't support partial fetch, so preview is same as pull
    return this.pull(onProgress)
  }
}

// S3 implementation (using pre-signed URLs or direct API calls)
export class S3SyncTarget implements ISyncTarget {
  config: S3Config

  constructor(config: S3Config) {
    this.config = config
  }

  private getObjectKey(): string {
    const path = this.config.path || 'emoji-data.json'
    return path.startsWith('/') ? path.substring(1) : path
  }

  private async signRequest(
    _method?: string,
    _url?: string,
    body?: string
  ): Promise<Record<string, string>> {
    // Simple AWS Signature V4 implementation
    // For production, consider using a proper AWS SDK or library
    const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
    // Note: dateStamp would be used for full AWS V4 signature: date.substring(0, 8)

    const headers: Record<string, string> = {
      'x-amz-date': date,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD'
    }

    if (body) {
      headers['Content-Type'] = 'application/json; charset=UTF-8'
    }

    // Note: Full AWS Signature V4 implementation would be needed here
    // This is a simplified version
    return headers
  }

  private getS3Url(): string {
    const endpoint = this.config.endpoint.replace(/\/$/, '')
    const bucket = this.config.bucket
    const key = this.getObjectKey()

    // Support both path-style and virtual-hosted-style URLs
    // Check if endpoint ends with amazonaws.com for proper AWS URL construction
    if (endpoint.endsWith('.amazonaws.com') || endpoint === 's3.amazonaws.com') {
      return `https://${bucket}.${endpoint}/${key}`
    }
    return `${endpoint}/${bucket}/${key}`
  }

  async test(): Promise<SyncResult> {
    try {
      const url = this.getS3Url()
      const headers = await this.signRequest('HEAD', url)

      const response = await fetch(url, {
        method: 'HEAD',
        headers
      })

      if (response.ok || response.status === 404) {
        return {
          success: true,
          message: 'S3 connection successful',
          timestamp: Date.now()
        }
      }

      return {
        success: false,
        message: `S3 connection failed: ${response.statusText}`,
        error: response.statusText
      }
    } catch (error) {
      return {
        success: false,
        message: `S3 connection error: ${error}`,
        error
      }
    }
  }

  async push(data: SyncData, onProgress?: ProgressCallback): Promise<SyncResult> {
    try {
      const body = JSON.stringify(data, null, 2)
      const dataSizeKB = (body.length / 1024).toFixed(2)
      const itemCount = 1 + (data.emojiGroups?.length || 0)

      onProgress?.({
        current: 0,
        total: 1,
        action: 'push',
        message: `正在推送数据到 S3 (${itemCount} 项，${dataSizeKB} KB)...`
      })

      const url = this.getS3Url()
      const headers = await this.signRequest('PUT', url, body)

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body
      })

      onProgress?.({
        current: 1,
        total: 1,
        action: 'push',
        message: `✓ 已推送所有数据 (${dataSizeKB} KB)`
      })

      if (response.ok || response.status === 201 || response.status === 204) {
        return {
          success: true,
          message: 'Data pushed to S3 successfully',
          timestamp: Date.now()
        }
      }

      return {
        success: false,
        message: `Failed to push to S3: ${response.statusText}`,
        error: response.statusText
      }
    } catch (error) {
      return {
        success: false,
        message: `Error pushing to S3: ${error}`,
        error
      }
    }
  }

  async pull(
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; data?: SyncData; error?: unknown; message: string }> {
    try {
      onProgress?.({
        current: 0,
        total: 1,
        action: 'pull',
        message: '正在从 S3 拉取数据...'
      })

      const url = this.getS3Url()
      const headers = await this.signRequest('GET', url)

      const response = await fetch(url, {
        method: 'GET',
        headers
      })

      if (response.ok) {
        const data = await response.json()
        const dataSizeKB = (JSON.stringify(data).length / 1024).toFixed(2)
        const itemCount = 1 + (data.emojiGroups?.length || 0)

        onProgress?.({
          current: 1,
          total: 1,
          action: 'pull',
          message: `✓ 已拉取所有数据 (${itemCount} 项，${dataSizeKB} KB)`
        })

        return {
          success: true,
          data,
          message: 'Data pulled from S3 successfully'
        }
      }

      if (response.status === 404) {
        return {
          success: false,
          message: 'No data found on S3',
          error: 'Object not found'
        }
      }

      return {
        success: false,
        message: `Failed to pull from S3: ${response.statusText}`,
        error: response.statusText
      }
    } catch (error) {
      return {
        success: false,
        message: `Error pulling from S3: ${error}`,
        error
      }
    }
  }

  async getGroupDetails(
    groupId: string,
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; group?: unknown; error?: unknown; message: string }> {
    // S3 does not support fetching individual groups, so we pull all data and filter
    onProgress?.({
      current: 0,
      total: 1,
      action: 'pull',
      message: 'Fetching all data to get group details...'
    })
    const result = await this.pull(onProgress)
    if (result.success && result.data) {
      const groups = result.data.emojiGroups as GroupLike[]
      const group = groups.find(g => g.id === groupId)
      if (group) {
        return { success: true, group, message: 'Group details extracted' }
      } else {
        return { success: false, message: 'Group not found', error: 'Group not found' }
      }
    }
    return { success: false, message: 'Failed to get group details', error: result.error }
  }

  async preview(
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; data?: SyncData; error?: unknown; message: string }> {
    // S3 doesn't support partial fetch, so preview is same as pull
    return this.pull(onProgress)
  }
}

// Factory function to create sync target instances
export function createSyncTarget(config: SyncTargetConfig): ISyncTarget {
  switch (config.type) {
    case 'webdav':
      return new WebDAVSyncTarget(config)
    case 's3':
      return new S3SyncTarget(config)
    case 'cloudflare':
      return new CloudflareSyncTarget(config)
    default:
      throw new Error(`Unknown sync target type: ${(config as any).type}`)
  }
}

// Cloudflare Worker implementation
export class CloudflareSyncTarget implements ISyncTarget {
  config: CloudflareConfig

  constructor(config: CloudflareConfig) {
    this.config = config
  }

  private getWriteAuthHeader(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.config.authToken}`
    }
  }

  private getReadAuthHeader(): Record<string, string> {
    const token = this.config.authTokenReadonly || this.config.authToken
    return {
      Authorization: `Bearer ${token}`
    }
  }

  private getUrl(): string {
    return this.config.url.replace(/\/$/, '')
  }

  async test(): Promise<SyncResult> {
    try {
      const url = this.getUrl() + '/'
      // Test uses GET, so read auth is sufficient
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getReadAuthHeader()
      })

      // Expecting a JSON array of keys
      if (response.ok) {
        await response.json() // Try to parse to ensure it's valid
        return {
          success: true,
          message: 'Cloudflare Worker connection successful',
          timestamp: Date.now()
        }
      }

      return {
        success: false,
        message: `Cloudflare Worker connection failed: ${response.statusText}`,
        error: response.statusText
      }
    } catch (error) {
      return {
        success: false,
        message: `Cloudflare Worker connection error: ${error}`,
        error
      }
    }
  }

  async push(data: SyncData, onProgress?: ProgressCallback): Promise<SyncResult> {
    try {
      const baseUrl = this.getUrl()
      // Push is a write operation
      const headers = {
        ...this.getWriteAuthHeader(),
        'Content-Type': 'application/json; charset=UTF-8'
      }

      const itemsToPush = [
        { key: 'settings', data: data.settings, displayName: '设置配置' },
        ...(data.emojiGroups as GroupLike[]).map(g => ({
          key: encodeURIComponent(g.name ?? ''),
          data: g,
          displayName: `表情组：${g.name ?? ''}`
        }))
      ]

      // 计算总请求次数：每个项目需要 1 个 POST 请求
      const totalRequests = itemsToPush.length
      let completedRequests = 0

      // 初始进度
      onProgress?.({
        current: completedRequests,
        total: totalRequests,
        action: 'push',
        message: `准备推送 ${totalRequests} 个数据项...`
      })

      for (const item of itemsToPush) {
        try {
          const jsonData = JSON.stringify(item.data)
          const sizeKB = (jsonData.length / 1024).toFixed(2)
          console.log(`[CloudflareSync] Pushing ${item.key}, size: ${jsonData.length} bytes`)

          // 开始处理这个项目，增加计数器（进度条立即前进）
          completedRequests++

          // 显示正在推送的项目
          onProgress?.({
            current: completedRequests,
            total: totalRequests,
            action: 'push',
            message: `正在推送 ${item.displayName} (${sizeKB} KB)...`
          })

          const response = await fetch(`${baseUrl}/${item.key}`, {
            method: 'POST',
            headers,
            body: jsonData
          })

          if (!response.ok) {
            // Try to get error details from response body
            let errorDetail = response.statusText
            try {
              const errorBody = await response.text()
              if (errorBody) {
                errorDetail = `${response.statusText} - ${errorBody}`
              }
            } catch (e) {
              // Ignore parsing error
            }
            console.error(`[CloudflareSync] Failed to push ${item.key}:`, errorDetail)
            throw new Error(`Failed to push item ${item.key}: ${errorDetail}`)
          }

          // 报告完成（保持同样的计数，只更新消息）
          onProgress?.({
            current: completedRequests,
            total: totalRequests,
            action: 'push',
            message: `✓ 已推送 ${item.displayName}`
          })
        } catch (itemError) {
          console.error(`[CloudflareSync] Error pushing ${item.key}:`, itemError)
          throw itemError
        }
      }

      return {
        success: true,
        message: `Data pushed to Cloudflare Worker successfully (${totalRequests} items).`,
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        success: false,
        message: `Error pushing to Cloudflare Worker: ${error}`,
        error
      }
    }
  }

  // Only fetch metadata (group list without emoji details)
  async preview(
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; data?: SyncData; error?: unknown; message: string }> {
    try {
      const baseUrl = this.getUrl()
      const headers = this.getReadAuthHeader()

      onProgress?.({ current: 0, total: 2, action: 'test', message: '正在测试连接...' })

      // 1. Test connection and get list of keys
      const listResponse = await fetch(`${baseUrl}/`, { method: 'GET', headers })
      if (!listResponse.ok) {
        throw new Error(`Failed to list keys: ${listResponse.statusText}`)
      }
      const keys: { name: string }[] = await listResponse.json()

      onProgress?.({ current: 1, total: 2, action: 'pull', message: '正在获取分组列表...' })

      // 2. Fetch only settings and group metadata (not full emoji data)
      const pulledItems: { key: string; data: Record<string, unknown> }[] = []
      const emojiGroupMetadata: GroupLike[] = []

      // Separate settings and group keys
      const settingsKey = keys.find(key => key.name === 'settings')
      const groupKeys = keys.filter(
        key => key.name !== 'settings' && !key.name.startsWith('emoji-')
      )

      // Fetch settings first
      let settingsData: Record<string, unknown> = {}
      if (settingsKey) {
        const res = await fetch(`${baseUrl}/${settingsKey.name}`, { method: 'GET', headers })
        if (res.ok) {
          settingsData = await res.json()
          pulledItems.push({ key: settingsKey.name, data: settingsData })
        }
      }

      // Prepare group metadata without fetching emojis
      for (const key of groupKeys) {
        // Here we assume key.name is the group name, we need to construct metadata without fetching
        // This is a limitation of the current worker implementation, ideally worker would have a metadata endpoint
        const groupName = decodeURIComponent(key.name)
        emojiGroupMetadata.push({
          id: `group_${groupName}`, // This might not be the real ID, it's a placeholder
          name: groupName,
          // We don't know the emoji count without fetching, so we mark it as unknown
          emojiCount: '?',
          _hasEmojis: true, // Assume it has emojis
          _isLazy: true // a flag to indicate this is a lazy-loaded group
        })
      }

      // 3. Reconstruct preview data
      const pulledData: Partial<SyncData> = {
        emojiGroups: emojiGroupMetadata
      }
      let version = '1.0'
      let timestamp = Date.now()

      for (const item of pulledItems) {
        if (item.key === 'settings') {
          pulledData.settings = item.data
        }
      }

      const settings = pulledData.settings as SettingsLike | undefined
      if (settings?.version && typeof settings.version === 'string') version = settings.version
      if (settings?.timestamp && typeof settings.timestamp === 'number')
        timestamp = settings.timestamp

      const finalData: SyncData = {
        settings: pulledData.settings || {},
        emojiGroups: pulledData.emojiGroups || [],
        version,
        timestamp
      }

      return {
        success: true,
        data: finalData,
        message: 'Preview data loaded successfully'
      }
    } catch (error) {
      return {
        success: false,
        message: `Preview failed: ${error}`,
        error
      }
    }
  }

  async getGroupDetails(
    groupName: string, // assuming groupName is used as key
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; group?: GroupLike; error?: unknown; message: string }> {
    try {
      onProgress?.({
        current: 0,
        total: 1,
        action: 'pull',
        message: `Fetching details for group ${groupName}...`
      })
      const baseUrl = this.getUrl()
      const headers = this.getReadAuthHeader()
      const res = await fetch(`${baseUrl}/${encodeURIComponent(groupName)}`, {
        method: 'GET',
        headers
      })
      if (res.ok) {
        const groupData = await res.json()
        onProgress?.({
          current: 1,
          total: 1,
          action: 'pull',
          message: `Details for group ${groupName} fetched.`
        })
        return {
          success: true,
          group: groupData,
          message: 'Group details fetched successfully'
        }
      } else {
        throw new Error(`Failed to fetch group details: ${res.statusText}`)
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to fetch group details for ${groupName}: ${error}`,
        error
      }
    }
  }
  async pull(
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; data?: SyncData; error?: unknown; message: string }> {
    try {
      const baseUrl = this.getUrl()
      // Pull is a read operation
      const headers = this.getReadAuthHeader()

      // 初始进度（暂时不知道总请求数）
      onProgress?.({ current: 0, total: 1, action: 'pull', message: '正在获取云端数据列表...' })

      // 1. Get list of all keys (第 1 个请求)
      const listResponse = await fetch(`${baseUrl}/`, { method: 'GET', headers })
      if (!listResponse.ok) {
        throw new Error(`Failed to list keys: ${listResponse.statusText}`)
      }
      const keys: { name: string }[] = await listResponse.json()

      // 计算总请求次数：1 个列表请求 + N 个数据请求
      const totalRequests = 1 + keys.length
      let completedRequests = 1 // 列表请求已完成

      onProgress?.({
        current: completedRequests,
        total: totalRequests,
        action: 'pull',
        message: `找到 ${keys.length} 个数据项，需要 ${totalRequests} 个请求`
      })

      // 2. Fetch all keys sequentially to report progress
      const pulledItems: { key: string; data: Record<string, unknown> }[] = []
      for (const key of keys) {
        const displayName =
          key.name === 'settings' ? '设置配置' : `表情组：${decodeURIComponent(key.name)}`

        // 开始处理这个项目，增加计数器（进度条立即前进）
        completedRequests++

        // 显示正在拉取的项目
        onProgress?.({
          current: completedRequests,
          total: totalRequests,
          action: 'pull',
          message: `正在拉取 ${displayName}...`
        })

        const res = await fetch(`${baseUrl}/${key.name}`, { method: 'GET', headers })
        if (!res.ok) {
          console.warn(`Failed to fetch key ${key.name}, skipping.`)
          continue
        }
        const data = await res.json()
        const dataSizeKB = (JSON.stringify(data).length / 1024).toFixed(2)
        pulledItems.push({ key: key.name, data })

        // 报告完成（保持同样的计数，只更新消息）
        onProgress?.({
          current: completedRequests,
          total: totalRequests,
          action: 'pull',
          message: `✓ 已拉取 ${displayName} (${dataSizeKB} KB)`
        })
      }

      // 3. Reconstruct the data
      onProgress?.({
        current: completedRequests,
        total: totalRequests,
        action: 'pull',
        message: '正在整合数据...'
      })

      const pulledData: Partial<SyncData> = {
        emojiGroups: []
      }
      let version = '0.0.0' // Default version
      let timestamp = Date.now()

      for (const item of pulledItems) {
        if (item.key === 'settings') {
          pulledData.settings = item.data
        } else {
          pulledData.emojiGroups!.push(item.data)
        }
      }

      // Try to get top level version/timestamp if it was set
      const settings = pulledData.settings as SettingsLike | undefined
      if (settings?.version && typeof settings.version === 'string') version = settings.version
      if (settings?.timestamp && typeof settings.timestamp === 'number')
        timestamp = settings.timestamp

      const finalData: SyncData = {
        settings: pulledData.settings || {},
        emojiGroups: pulledData.emojiGroups || [],
        version,
        timestamp
      }

      return {
        success: true,
        data: finalData,
        message: `Data pulled from Cloudflare Worker successfully (${pulledItems.length} items).`
      }
    } catch (error) {
      console.error('Error pulling from Cloudflare Worker:', error)
      return {
        success: false,
        message: `Error pulling from Cloudflare Worker: ${error}`,
        error
      }
    }
  }
}
