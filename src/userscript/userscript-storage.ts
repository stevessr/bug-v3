// Storage adapter for userscript environment using localStorage
import { loadDefaultEmojiGroups } from '@/types/defaultEmojiGroups.loader'

export interface UserscriptStorage {
  emojiGroups: any[]
  settings: {
    imageScale: number
    gridColumns: number
    outputFormat: 'markdown' | 'html'
    forceMobileMode: boolean
    defaultGroup: string
    showSearchBar: boolean
  }
}

const STORAGE_KEY = 'emoji_extension_userscript_data'
const SETTINGS_KEY = 'emoji_extension_userscript_settings'

export function loadDataFromLocalStorage(): UserscriptStorage {
  try {
    // Load emoji groups
    const groupsData = localStorage.getItem(STORAGE_KEY)
    let emojiGroups: any[] = []

    if (groupsData) {
      try {
        const parsed = JSON.parse(groupsData)
        if (Array.isArray(parsed) && parsed.length > 0) {
          emojiGroups = parsed
        }
      } catch (e) {
        console.warn('[Userscript] Failed to parse stored emoji groups:', e)
      }
    }

    // If no valid groups, start with empty list (fast sync fallback)
    if (emojiGroups.length === 0) {
      emojiGroups = []
    }

    // Load settings
    const settingsData = localStorage.getItem(SETTINGS_KEY)
    let settings = {
      imageScale: 30,
      gridColumns: 4,
      outputFormat: 'markdown' as const,
      forceMobileMode: false,
      defaultGroup: 'nachoneko',
      showSearchBar: true
    }

    if (settingsData) {
      try {
        const parsed = JSON.parse(settingsData)
        if (parsed && typeof parsed === 'object') {
          settings = { ...settings, ...parsed }
        }
      } catch (e) {
        console.warn('[Userscript] Failed to parse stored settings:', e)
      }
    }

    // 在 userscript 模式下，不显示常用 (favorites) 分组
    emojiGroups = emojiGroups.filter(g => g.id !== 'favorites')

    console.log('[Userscript] Loaded data from localStorage:', {
      groupsCount: emojiGroups.length,
      emojisCount: emojiGroups.reduce((acc, g) => acc + (g.emojis?.length || 0), 0),
      settings
    })

    return { emojiGroups, settings }
  } catch (error) {
    console.error('[Userscript] Failed to load from localStorage:', error)

    // Return defaults on error: empty groups and default settings
    console.error('[Userscript] Failed to load from localStorage:', error)
    return {
      emojiGroups: [],
      settings: {
        imageScale: 30,
        gridColumns: 4,
        outputFormat: 'markdown',
        forceMobileMode: false,
        defaultGroup: 'nachoneko',
        showSearchBar: true
      }
    }
  }
}

// 异步版本：在本地无数据时，尝试从远程 URL 拉取默认配置（localStorage key: emoji_extension_remote_config_url）
export async function loadDataFromLocalStorageAsync(): Promise<UserscriptStorage> {
  try {
    // Try synchronous load first (fast path)
    const local = loadDataFromLocalStorage()
    if (local.emojiGroups && local.emojiGroups.length > 0) {
      return local
    }

    // If no groups locally, check for remote config URL in localStorage
    const remoteKey = 'emoji_extension_remote_config_url'
    const remoteUrl = localStorage.getItem(remoteKey)
    if (remoteUrl && typeof remoteUrl === 'string' && remoteUrl.trim().length > 0) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const res = await fetch(remoteUrl, { signal: controller.signal })
        clearTimeout(timeout)
        if (res && res.ok) {
          const json = await res.json()
          // Expecting an object with emojiGroups or groups array
          const groups = Array.isArray(json.emojiGroups)
            ? json.emojiGroups
            : Array.isArray(json.groups)
              ? json.groups
              : null

          const settings =
            json.settings && typeof json.settings === 'object' ? json.settings : local.settings

          if (groups && groups.length > 0) {
            // Save fetched groups to localStorage for offline use
            try {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(groups))
            } catch (e) {
              console.warn('[Userscript] Failed to persist fetched remote groups to localStorage', e)
            }

            // Filter out favorites for userscript mode
            const filtered = groups.filter((g: any) => g.id !== 'favorites')
            return { emojiGroups: filtered, settings }
          }
        }
      } catch (err) {
        console.warn('[Userscript] Failed to fetch remote default config:', err)
        // fall through to generated defaults
      }
    }

    // No remote or failed: try runtime loader, then fallback to empty list
    try {
      const runtime = await loadDefaultEmojiGroups()
      const source = runtime && runtime.length ? runtime : []
      const cloned = JSON.parse(JSON.stringify(source))
      const filtered = cloned.filter((g: any) => g.id !== 'favorites')
      // Save to localStorage for future fast loads
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
      } catch (e) {
        /* ignore */
      }
      return { emojiGroups: filtered, settings: local.settings }
    } catch (e) {
      console.error('[Userscript] Failed to load default groups in async fallback:', e)
      return { emojiGroups: [], settings: local.settings }
    }
  } catch (error) {
    console.error('[Userscript] loadDataFromLocalStorageAsync failed:', error)
    return {
      emojiGroups: [],
      settings: {
        imageScale: 30,
        gridColumns: 4,
        outputFormat: 'markdown',
        forceMobileMode: false,
        defaultGroup: 'nachoneko',
        showSearchBar: true
      }
    }
  }
}

export function saveDataToLocalStorage(data: Partial<UserscriptStorage>): void {
  try {
    if (data.emojiGroups) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.emojiGroups))
    }
    if (data.settings) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings))
    }
  } catch (error) {
    console.error('[Userscript] Failed to save to localStorage:', error)
  }
}

export function addEmojiToUserscript(emojiData: { name: string; url: string }): void {
  try {
    const data = loadDataFromLocalStorage()

    // Find or create "用户添加" group
    let userGroup = data.emojiGroups.find(g => g.id === 'user_added')
    if (!userGroup) {
      userGroup = {
        id: 'user_added',
        name: '用户添加',
        icon: '⭐',
        order: 999,
        emojis: []
      }
      data.emojiGroups.push(userGroup)
    }

    // Check if emoji already exists
    const exists = userGroup.emojis.some(
      (e: any) => e.url === emojiData.url || e.name === emojiData.name
    )

    if (!exists) {
      userGroup.emojis.push({
        packet: Date.now(),
        name: emojiData.name,
        url: emojiData.url
      })

      saveDataToLocalStorage({ emojiGroups: data.emojiGroups })
      console.log('[Userscript] Added emoji to user group:', emojiData.name)
    } else {
      console.log('[Userscript] Emoji already exists:', emojiData.name)
    }
  } catch (error) {
    console.error('[Userscript] Failed to add emoji:', error)
  }
}

export function exportUserscriptData(): string {
  try {
    const data = loadDataFromLocalStorage()
    return JSON.stringify(data, null, 2)
  } catch (error) {
    console.error('[Userscript] Failed to export data:', error)
    return ''
  }
}

export function importUserscriptData(jsonData: string): boolean {
  try {
    const data = JSON.parse(jsonData)

    if (data.emojiGroups && Array.isArray(data.emojiGroups)) {
      saveDataToLocalStorage({ emojiGroups: data.emojiGroups })
    }

    if (data.settings && typeof data.settings === 'object') {
      saveDataToLocalStorage({ settings: data.settings })
    }

    console.log('[Userscript] Data imported successfully')
    return true
  } catch (error) {
    console.error('[Userscript] Failed to import data:', error)
    return false
  }
}

export function syncFromManager(): boolean {
  try {
    // Try to load data from manager keys
    const managerGroups = localStorage.getItem('emoji_extension_manager_groups')
    const managerSettings = localStorage.getItem('emoji_extension_manager_settings')

    let updated = false

    if (managerGroups) {
      const groups = JSON.parse(managerGroups)
      if (Array.isArray(groups)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(groups))
        updated = true
      }
    }

    if (managerSettings) {
      const settings = JSON.parse(managerSettings)
      if (typeof settings === 'object') {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
        updated = true
      }
    }

    if (updated) {
      console.log('[Userscript] Synced data from manager')
    }

    return updated
  } catch (error) {
    console.error('[Userscript] Failed to sync from manager:', error)
    return false
  }
}
