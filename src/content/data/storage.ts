import { cachedState } from './state'

import { defaultSettings } from '@/types/defaultSettings'

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
    console.log('[Emoji Extension] Requesting emoji data from background')
    // include the current page's hostname so background can filter groups per-domain
    const resp = await sendMessageToBackground({
      type: 'GET_EMOJI_DATA',
      sourceDomain: window.location?.hostname || null
    })

    if (resp && resp.success && resp.data) {
      const groups = resp.data.groups || []
      const settings = resp.data.settings || {}

      console.log('[Emoji Extension] Received groups from background:', groups?.length || 0)

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
            `[Emoji Extension] Successfully loaded ${validGroups} valid groups with ${totalEmojis} total emojis (from background)`
          )
        } else {
          console.warn(
            '[Emoji Extension] Groups exist but contain no valid emojis, using defaults (from background)'
          )
          cachedState.emojiGroups = []
        }
      } else {
        console.warn(
          '[Emoji Extension] No valid emoji groups found in background response, using defaults'
        )
        cachedState.emojiGroups = []
      }

      if (settings && typeof settings === 'object') {
        cachedState.settings = { ...cachedState.settings, ...settings }
        console.log('[Emoji Extension] Loaded settings (from background):', cachedState.settings)
      }
    } else {
      console.warn(
        '[Emoji Extension] Background did not return emoji data, falling back to defaults'
      )
      cachedState.emojiGroups = []
      // Use centralized default settings
      cachedState.settings = { ...defaultSettings }
    }

    let finalEmojisCount = 0
    cachedState.emojiGroups.forEach((g: any) => {
      if (g?.emojis?.length) finalEmojisCount += g.emojis.length
    })

    console.log('[Emoji Extension] Final cache state (from background):', {
      groupsCount: cachedState.emojiGroups.length,
      emojisCount: finalEmojisCount,
      settings: cachedState.settings
    })
  } catch (error) {
    console.error('[Emoji Extension] Failed to load from background (module):', error)
    cachedState.emojiGroups = []
    // Use centralized default settings
    cachedState.settings = { ...defaultSettings }
  }
}
