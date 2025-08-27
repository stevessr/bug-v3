import { cachedState } from './state'
import type { EmojiGroup, Settings } from './types'
import { defaultSettings, createDefaultEmojiGroup } from './types'

interface BackgroundResponse {
  success: boolean
  data?: {
    groups?: EmojiGroup[]
    settings?: Partial<Settings>
    ungroupedEmojis?: any[]
  }
  error?: string
}

function sendMessageToBackground(message: any): Promise<BackgroundResponse> {
  return new Promise((resolve) => {
    try {
      if (
        (window as any).chrome &&
        (window as any).chrome.runtime &&
        (window as any).chrome.runtime.sendMessage
      ) {
        ;(window as any).chrome.runtime.sendMessage(message, (response: BackgroundResponse) => {
          resolve(response)
        })
      } else {
        resolve({ success: false, error: 'chrome.runtime.sendMessage not available' })
      }
    } catch (e) {
      resolve({ success: false, error: e instanceof Error ? e.message : String(e) })
    }
  })
}

function validateEmojiGroup(group: any): group is EmojiGroup {
  return (
    group &&
    typeof group.UUID === 'string' &&
    typeof group.displayName === 'string' &&
    typeof group.order === 'number' &&
    Array.isArray(group.emojis)
  )
}

function validateSettings(settings: any): settings is Partial<Settings> {
  return (
    settings &&
    typeof settings === 'object' &&
    (settings.imageScale === undefined || typeof settings.imageScale === 'number') &&
    (settings.gridColumns === undefined ||
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].includes(settings.gridColumns)) &&
    (settings.outputFormat === undefined ||
      ['html', 'markdown', 'bbcode'].includes(settings.outputFormat)) &&
    (settings.MobileMode === undefined || typeof settings.MobileMode === 'boolean') &&
    (settings.defaultEmojiGroupUUID === undefined ||
      typeof settings.defaultEmojiGroupUUID === 'string')
  )
}

export async function loadDataFromStorage(): Promise<void> {
  try {
    console.log('[Mr Emoji] Requesting emoji data from background')
    const resp = await sendMessageToBackground({ type: 'GET_EMOJI_DATA' })

    if (resp && resp.success && resp.data) {
      const groups = resp.data.groups || []
      const settings = resp.data.settings || {}
      const ungroupedEmojis = resp.data.ungroupedEmojis || []

      console.log('[Mr Emoji] Received groups from background:', groups?.length || 0)

      if (Array.isArray(groups) && groups.length > 0) {
        const validGroups = groups.filter(validateEmojiGroup)
        const totalEmojis = validGroups.reduce((sum, group) => sum + group.emojis.length, 0)

        if (validGroups.length > 0 && totalEmojis > 0) {
          cachedState.emojiGroups = validGroups
          console.log(
            `[Mr Emoji] Successfully loaded ${validGroups.length} valid groups with ${totalEmojis} total emojis (from background)`,
          )
        } else {
          console.warn(
            '[Mr Emoji] Groups exist but contain no valid emojis, using defaults (from background)',
          )
          cachedState.emojiGroups = [createDefaultEmojiGroup()]
        }
      } else {
        console.warn(
          '[Mr Emoji] No valid emoji groups found in background response, using defaults',
        )
        cachedState.emojiGroups = [createDefaultEmojiGroup()]
      }

      if (validateSettings(settings)) {
        cachedState.settings = { ...cachedState.settings, ...settings }
        console.log('[Mr Emoji] Loaded settings (from background):', cachedState.settings)
      }

      if (Array.isArray(ungroupedEmojis)) {
        cachedState.ungroupedEmojis = ungroupedEmojis
      }
    } else {
      console.warn('[Mr Emoji] Background did not return emoji data, falling back to defaults')
      cachedState.emojiGroups = [createDefaultEmojiGroup()]
      cachedState.settings = { ...defaultSettings }
    }

    const finalEmojisCount = cachedState.emojiGroups.reduce(
      (sum, group) => sum + group.emojis.length,
      0,
    )

    console.log('[Mr Emoji] Final cache state (from background):', {
      groupsCount: cachedState.emojiGroups.length,
      emojisCount: finalEmojisCount,
      ungroupedCount: cachedState.ungroupedEmojis.length,
      settings: cachedState.settings,
    })
  } catch (error) {
    console.error('[Mr Emoji] Failed to load from background (module):', error)
    cachedState.emojiGroups = [createDefaultEmojiGroup()]
    cachedState.settings = { ...defaultSettings }
    cachedState.ungroupedEmojis = []
  }
}
