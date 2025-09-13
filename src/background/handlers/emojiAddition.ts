import { newStorageHelpers } from '../../utils/newStorage'
import { logger } from '../../config/buildFlags'

export interface EmojiData {
  name: string
  url: string
  groupId?: string
}

export interface AddEmojiResult {
  success: boolean
  message?: string
  error?: string
  errorDetails?: any
  added?: boolean
  emoji?: any
}

/**
 * Pure emoji addition handler - adds emoji directly to storage without any file processing
 */
export async function addEmojiToGroup(emojiData: EmojiData, targetGroupId: string = 'ungrouped'): Promise<AddEmojiResult> {
  try {
    logger.log('[EmojiAddition] Starting pure emoji addition:', emojiData)

    // Guard against DOM access in service worker context
    if (typeof document !== 'undefined') {
      logger.warn('[EmojiAddition] Document object detected in background script - this should not happen')
    }

    // Get all emoji groups
    const groups = await newStorageHelpers.getAllEmojiGroups()
    logger.log('[EmojiAddition] Retrieved groups:', groups.length)

    // Find target group
    let targetGroup = groups.find((g: any) => g.id === targetGroupId)
    if (!targetGroup) {
      if (targetGroupId === 'ungrouped') {
        // Create ungrouped group if it doesn't exist
        targetGroup = {
          id: 'ungrouped',
          name: '未分组',
          icon: '📦',
          order: 999,
          emojis: []
        }
        groups.push(targetGroup)
        logger.log('[EmojiAddition] Created new ungrouped group')
      } else {
        return {
          success: false,
          error: `目标分组 "${targetGroupId}" 不存在`
        }
      }
    } else {
      logger.log('[EmojiAddition] Found target group with', targetGroup.emojis?.length || 0, 'emojis')
    }

    // Check if emoji with same URL already exists
    const existingEmoji = targetGroup.emojis.find((e: any) => e.url === emojiData.url)
    if (existingEmoji) {
      logger.log('[EmojiAddition] Emoji already exists:', emojiData.url)
      return {
        success: false,
        error: '此表情已存在于该分组中'
      }
    }

    // Create new emoji
    const newEmoji = {
      id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      packet: Date.now(),
      name: emojiData.name,
      url: emojiData.url,
      groupId: targetGroupId,
      addedAt: Date.now()
    }

    // Add emoji to group
    targetGroup.emojis.push(newEmoji)
    logger.log('[EmojiAddition] Added emoji to group:', newEmoji.name)

    // Save to storage
    await newStorageHelpers.setAllEmojiGroups(groups)
    logger.log('[EmojiAddition] Successfully saved groups to storage')

    return {
      success: true,
      message: `表情已添加到${targetGroup.name}`,
      added: true,
      emoji: newEmoji
    }
  } catch (error) {
    logger.error('[EmojiAddition] Failed to add emoji:', error)
    
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '添加表情失败',
      errorDetails
    }
  }
}

/**
 * Batch add multiple emojis to a group
 */
export async function addEmojisToGroup(emojisData: EmojiData[], targetGroupId: string = 'ungrouped'): Promise<AddEmojiResult> {
  try {
    logger.log('[EmojiAddition] Starting batch emoji addition:', emojisData.length, 'emojis')

    const results = []
    let successCount = 0
    let errorCount = 0

    for (const emojiData of emojisData) {
      const result = await addEmojiToGroup(emojiData, targetGroupId)
      results.push(result)
      
      if (result.success) {
        successCount++
      } else {
        errorCount++
      }
    }

    return {
      success: successCount > 0,
      message: `成功添加 ${successCount} 个表情${errorCount > 0 ? `，失败 ${errorCount} 个` : ''}`,
      added: successCount > 0,
      errorDetails: results
    }
  } catch (error) {
    logger.error('[EmojiAddition] Batch addition failed:', error)
    
    return {
      success: false,
      error: error instanceof Error ? error.message : '批量添加表情失败'
    }
  }
}
