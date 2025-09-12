import { getDefaultEmojisAsync } from '../data/default'

import { cachedState } from './state'

function sendMessageToBackground(message: any): Promise<any> {
  return new Promise(resolve => {
    try {
      if (
        (window as any).chrome &&
        (window as any).chrome.runtime &&
        (window as any).chrome.runtime.sendMessage
      ) {
        ;(window as any).chrome.runtime.sendMessage(message, (response: any) => {
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

export async function loadDataFromStorage(): Promise<void> {
  try {
    console.log('[Emoji拓展] Requesting emoji data from background')
    const resp = await sendMessageToBackground({ type: 'GET_EMOJI_DATA' })

    if (resp && resp.success && resp.data) {
      const groups = resp.data.groups || []
      const settings = resp.data.settings || {}

      console.log('[Emoji拓展] Received groups from background:', groups?.length || 0)

      if (Array.isArray(groups) && groups.length > 0) {
        let validGroups = 0
        let totalEmojis = 0
        groups.forEach((group: any) => {
          if (group && group.emojis && Array.isArray(group.emojis)) {
            validGroups++
            totalEmojis += group.emojis.length
          }
        })

        if (validGroups > 0 && totalEmojis > 0) {
          cachedState.emojiGroups = groups
          console.log(
            `[Emoji拓展] Successfully loaded ${validGroups} valid groups with ${totalEmojis} total emojis (from background)`
          )
        } else {
          console.warn(
            '[Emoji拓展] Groups exist but contain no valid emojis, using defaults (from background)'
          )
          cachedState.emojiGroups = []
        }
      } else {
        console.warn(
          '[Emoji拓展] No valid emoji groups found in background response, using defaults'
        )
        cachedState.emojiGroups = []
      }

      if (settings && typeof settings === 'object') {
        cachedState.settings = { ...cachedState.settings, ...settings }
        console.log('[Emoji拓展] Loaded settings (from background):', cachedState.settings)
      }
    } else {
      console.warn('[Emoji拓展] Background did not return emoji data, falling back to defaults')
      cachedState.emojiGroups = []
      cachedState.settings = {
        imageScale: 30,
        gridColumns: 4,
        outputFormat: 'markdown',
        forceMobileMode: false,
        defaultGroup: 'nachoneko',
        showSearchBar: true
      }
    }

    let finalEmojisCount = 0
    cachedState.emojiGroups.forEach((g: any) => {
      if (g?.emojis?.length) finalEmojisCount += g.emojis.length
    })

    console.log('[Emoji拓展] Final cache state (from background):', {
      groupsCount: cachedState.emojiGroups.length,
      emojisCount: finalEmojisCount,
      settings: cachedState.settings
    })
  } catch (error) {
    console.error('[Emoji拓展] Failed to load from background (module):', error)
    cachedState.emojiGroups = []
    cachedState.settings = {
      imageScale: 30,
      gridColumns: 4,
      outputFormat: 'markdown',
      forceMobileMode: false,
      defaultGroup: 'nachoneko',
      showSearchBar: true
    }
  }
}

export function ensureDefaultIfEmpty() {
  if (!Array.isArray(cachedState.emojiGroups) || cachedState.emojiGroups.length === 0) {
    const defaultEmojis = getDefaultEmojisAsync()
    cachedState.emojiGroups = [
      { id: 'default', name: '默认表情', icon: '😀', order: 0, emojis: defaultEmojis }
    ]
  }
}
