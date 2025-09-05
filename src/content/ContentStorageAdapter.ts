import { defaultSettings } from '../types/emoji'
import { logger } from '../config/buildFLagsV2'

export class ContentStorageAdapter {
  // Read from extension storage with fallback to local/session storage
  async get(key: string): Promise<any> {
    // Try extension storage first (main source for content scripts)
    if (chrome?.storage?.local) {
      try {
        const result = await chrome.storage.local.get({ [key]: null })
        const value = result[key]
        if (value !== null && value !== undefined) {
          logger.log(`[Content Storage] Found ${key} in extension storage`)
          // Handle both new storage format (with .data) and legacy format
          if (value && typeof value === 'object' && value.data !== undefined) {
            return value.data
          }
          return value
        }
      } catch (error) {
        logger.warn(`[Content Storage] Extension storage failed for ${key}:`, error)
      }
    }

    // Fallback to localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const value = localStorage.getItem(key)
        if (value) {
          const parsed = JSON.parse(value)
          if (parsed !== null && parsed !== undefined) {
            logger.log(`[Content Storage] Found ${key} in localStorage`)
            // Handle both new storage format (with .data) and legacy format
            if (parsed && typeof parsed === 'object' && parsed.data !== undefined) {
              return parsed.data
            }
            return parsed
          }
        }
      }
    } catch (error) {
      logger.warn(`[Content Storage] localStorage failed for ${key}:`, error)
    }

    // Fallback to sessionStorage
    try {
      if (typeof sessionStorage !== 'undefined') {
        const value = sessionStorage.getItem(key)
        if (value) {
          const parsed = JSON.parse(value)
          if (parsed !== null && parsed !== undefined) {
            logger.log(`[Content Storage] Found ${key} in sessionStorage`)
            // Handle both new storage format (with .data) and legacy format
            if (parsed && typeof parsed === 'object' && parsed.data !== undefined) {
              return parsed.data
            }
            return parsed
          }
        }
      }
    } catch (error) {
      logger.warn(`[Content Storage] sessionStorage failed for ${key}:`, error)
    }

    logger.log(`[Content Storage] No data found for ${key}`)
    return null
  }

  async getAllEmojiGroups(): Promise<any[]> {
    logger.log('[Content Storage] Getting all emoji groups')

    // First try to get the group index
    const groupIndex = await this.get('emojiGroupIndex')
    logger.log('[Content Storage] Group index:', groupIndex)

    if (groupIndex && Array.isArray(groupIndex) && groupIndex.length > 0) {
      const groups = []
      for (const groupInfo of groupIndex) {
        logger.log(`[Content Storage] Processing group info:`, groupInfo)
        if (groupInfo && groupInfo.id) {
          const group = await this.get(`emojiGroup_${groupInfo.id}`)
          logger.log(`[Content Storage] Raw group data for ${groupInfo.id}:`, group)

          if (group) {
            logger.log(`[Content Storage] Group structure:`, {
              hasEmojis: !!group.emojis,
              emojisType: typeof group.emojis,
              isArray: Array.isArray(group.emojis),
              emojisLength: group.emojis?.length,
              groupKeys: Object.keys(group)
            })

            // Handle case where emojis is stored as an object instead of array
            let emojisArray = group.emojis
            if (group.emojis && typeof group.emojis === 'object' && !Array.isArray(group.emojis)) {
              // Convert object to array if needed
              emojisArray = Object.values(group.emojis)
              logger.log(
                `[Content Storage] Converting emojis object to array for ${group.name}, length: ${emojisArray.length}`
              )
            }

            if (emojisArray && Array.isArray(emojisArray)) {
              const processedGroup = { ...group, emojis: emojisArray, order: groupInfo.order || 0 }
              groups.push(processedGroup)
              logger.log(
                `[Content Storage] ✅ Loaded group: ${group.name} with ${emojisArray.length} emojis`
              )
            } else if (groupInfo.id === 'favorites') {
              // Special handling for favorites group which might not have emojis initially
              const favoritesGroup = {
                ...group,
                emojis: emojisArray && Array.isArray(emojisArray) ? emojisArray : [],
                order: groupInfo.order || 0
              }
              groups.push(favoritesGroup)
              logger.log(
                `[Content Storage] ✅ Loaded favorites group with ${favoritesGroup.emojis.length} emojis`
              )
            } else {
              logger.warn(
                `[Content Storage] ❌ Group ${group.name || groupInfo.id} has invalid emojis after conversion:`,
                {
                  hasEmojis: !!emojisArray,
                  emojisType: typeof emojisArray,
                  isArray: Array.isArray(emojisArray),
                  originalEmojisType: typeof group.emojis
                }
              )
            }
          } else {
            logger.warn(`[Content Storage] ❌ Group ${groupInfo.id} data is null/undefined`)
          }
        }
      }

      logger.log(
        `[Content Storage] Processed ${groupIndex.length} groups, ${groups.length} valid groups found`
      )

      if (groups.length > 0) {
        logger.log(
          `[Content Storage] Successfully loaded ${groups.length} groups from new storage system`
        )
        // Ensure favorites group is always first
        const favoritesGroup = groups.find(g => g.id === 'favorites')
        const otherGroups = groups
          .filter(g => g.id !== 'favorites')
          .sort((a, b) => a.order - b.order)
        return favoritesGroup ? [favoritesGroup, ...otherGroups] : otherGroups
      } else {
        logger.warn(
          `[Content Storage] No valid groups found in new storage system despite having group index`
        )
      }
    }

    // Fallback to legacy emojiGroups key
    logger.log('[Content Storage] Trying legacy emojiGroups key')
    const legacyGroups = await this.get('emojiGroups')
    if (legacyGroups && Array.isArray(legacyGroups) && legacyGroups.length > 0) {
      logger.log(`[Content Storage] Loaded ${legacyGroups.length} groups from legacy storage`)
      // Ensure favorites group is always first for legacy data too
      const favoritesGroup = legacyGroups.find(g => g.id === 'favorites')
      const otherGroups = legacyGroups
        .filter(g => g.id !== 'favorites')
        .sort((a, b) => (a.order || 0) - (b.order || 0))
      return favoritesGroup ? [favoritesGroup, ...otherGroups] : otherGroups
    }

    logger.log('[Content Storage] No groups found in storage')
    return []
  }

  async getSettings(): Promise<any> {
    logger.log('[Content Storage] Getting settings')
    const settings = await this.get('appSettings')
    // Merge with central defaultSettings so fields like outputFormat are always present
    const result = settings ? { ...defaultSettings, ...settings } : { ...defaultSettings }
    logger.log('[Content Storage] Settings loaded:', result)
    return result
  }
}
