// Sync target interface and implementations for WebDAV and S3
// This module provides the plugin infrastructure for syncing emoji data

export interface SyncConfig {
  type: 'webdav' | 's3'
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

export type SyncTargetConfig = WebDAVConfig | S3Config

export interface SyncResult {
  success: boolean
  message: string
  error?: any
  timestamp?: number
}

export interface SyncData {
  emojiGroups: any[]
  settings: any
  timestamp: number
  version: string
}

// Base sync target interface
export interface ISyncTarget {
  config: SyncTargetConfig
  push(data: SyncData): Promise<SyncResult>
  pull(): Promise<{ success: boolean; data?: SyncData; error?: any; message: string }>
  test(): Promise<SyncResult> // Test connection
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

  async push(data: SyncData): Promise<SyncResult> {
    try {
      const url = this.getFullUrl()
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: this.getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data, null, 2)
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

  async pull(): Promise<{ success: boolean; data?: SyncData; error?: any; message: string }> {
    try {
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
    method: string,
    url: string,
    body?: string
  ): Promise<Record<string, string>> {
    // Simple AWS Signature V4 implementation
    // For production, consider using a proper AWS SDK or library
    const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = date.substring(0, 8)

    const headers: Record<string, string> = {
      'x-amz-date': date,
      'x-amz-content-sha256': 'UNSIGNED-PAYLOAD'
    }

    if (body) {
      headers['Content-Type'] = 'application/json'
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

  async push(data: SyncData): Promise<SyncResult> {
    try {
      const url = this.getS3Url()
      const body = JSON.stringify(data, null, 2)
      const headers = await this.signRequest('PUT', url, body)

      const response = await fetch(url, {
        method: 'PUT',
        headers,
        body
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

  async pull(): Promise<{ success: boolean; data?: SyncData; error?: any; message: string }> {
    try {
      const url = this.getS3Url()
      const headers = await this.signRequest('GET', url)

      const response = await fetch(url, {
        method: 'GET',
        headers
      })

      if (response.ok) {
        const data = await response.json()
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
}

// Factory function to create sync target instances
export function createSyncTarget(config: SyncTargetConfig): ISyncTarget {
  switch (config.type) {
    case 'webdav':
      return new WebDAVSyncTarget(config)
    case 's3':
      return new S3SyncTarget(config)
    default:
      throw new Error(`Unknown sync target type: ${(config as any).type}`)
  }
}
