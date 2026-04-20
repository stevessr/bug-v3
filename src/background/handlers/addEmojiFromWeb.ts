import * as storage from '../../utils/simpleStorage'
import { getChromeAPI } from '../utils/main.ts'

import { downloadAndUploadDirect } from './downloadAndSend'

export async function handleAddEmojiFromWeb(emojiData: any, sendResponse: any) {
  // reference the callback to avoid unused-var lint in some configurations
  void sendResponse
  try {
    // If caller provided a sourceDomain (e.g. discourse hostname), ensure it's registered
    try {
      if (
        emojiData &&
        typeof emojiData.sourceDomain === 'string' &&
        emojiData.sourceDomain.length > 0
      ) {
        await storage.ensureDiscourseDomainExists(emojiData.sourceDomain)
      }
    } catch (e) {
      // Non-fatal: log and continue
      console.warn('[Background] ensureDiscourseDomainExists failed', e)
    }
    // 获取所有表情组
    const groups = await storage.getAllEmojiGroups()

    const targetGroupId =
      emojiData && typeof emojiData.targetGroupId === 'string' ? emojiData.targetGroupId.trim() : ''
    const targetGroupName =
      emojiData && typeof emojiData.targetGroupName === 'string'
        ? emojiData.targetGroupName.trim()
        : ''

    let targetGroup = null as any
    if (targetGroupId) {
      targetGroup = groups.find((g: any) => g.id === targetGroupId)
    }
    if (!targetGroup && targetGroupName) {
      targetGroup = groups.find((g: any) => g.name === targetGroupName)
    }

    if (!targetGroup) {
      // 找到未分组表情组
      let ungroupedGroup = groups.find((g: any) => g.id === 'ungrouped')
      if (!ungroupedGroup) {
        // 如果未分组表情组不存在，创建一个
        ungroupedGroup = {
          id: 'ungrouped',
          name: '未分组',
          icon: '📦',
          order: 999,
          emojis: []
        }
        groups.push(ungroupedGroup)
      }

      // 如果指定了目标分组但不存在，创建它；否则回退到未分组
      if (targetGroupId || targetGroupName) {
        const createdGroup = {
          id: targetGroupId || `group-${Date.now()}`,
          name: targetGroupName || targetGroupId || '未分组',
          icon: '📁',
          order: groups.length,
          emojis: []
        }
        groups.push(createdGroup)
        targetGroup = createdGroup
      } else {
        targetGroup = ungroupedGroup
      }
    }

    // 检查是否已存在相同 URL 的表情
    const existingEmoji = targetGroup.emojis.find((e: any) => e.url === emojiData.url)
    if (existingEmoji) {
      sendResponse({ success: false, error: '此表情已存在于目标分组中' })
      return
    }

    // 创建新表情
    // If pixiv original image, try downloading and uploading to recent Discourse
    let finalUrl = emojiData.url
    let uploadedShortUrl: string | undefined
    try {
      if (finalUrl && finalUrl.includes('i.pximg.net')) {
        // read last used discourse config from storage key 'lastDiscourse' if available
        const chromeAPI = getChromeAPI()
        let stored: any = null
        if (chromeAPI && chromeAPI.storage && chromeAPI.storage.local) {
          stored = await new Promise<any>(resolve => {
            chromeAPI.storage.local.get(['lastDiscourse'], (res: any) => resolve(res))
          })
        }
        const last = stored && stored.lastDiscourse ? stored.lastDiscourse : null
        if (last && last.base) {
          try {
            const uploadResult = await downloadAndUploadDirect(
              finalUrl,
              emojiData.name || 'image.png',
              {
                discourseBase: last.base,
                cookie: last.cookie,
                csrf: last.csrf,
                mimeType: undefined
              }
            )
            // use uploadResult.url if present
            if (uploadResult && uploadResult.url) {
              finalUrl = uploadResult.url
              uploadedShortUrl = uploadResult.short_url || undefined
            }
          } catch (e) {
            // ignore upload errors and fallback to original url
            void e
          }
        }
      }
    } catch (_e) {
      void _e
    }

    const width =
      typeof emojiData?.width === 'number' &&
      Number.isFinite(emojiData.width) &&
      emojiData.width > 0
        ? Math.round(emojiData.width)
        : undefined
    const height =
      typeof emojiData?.height === 'number' &&
      Number.isFinite(emojiData.height) &&
      emojiData.height > 0
        ? Math.round(emojiData.height)
        : undefined

    const newEmoji = {
      id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      packet: Date.now(),
      name: emojiData.name,
      url: finalUrl,
      ...(uploadedShortUrl && { short_url: uploadedShortUrl }),
      ...(emojiData.short_url && !uploadedShortUrl && { short_url: emojiData.short_url }),
      ...(emojiData.displayUrl && { displayUrl: emojiData.displayUrl }),
      ...(emojiData.customOutput && { customOutput: emojiData.customOutput }),
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      groupId: targetGroup.id,
      addedAt: Date.now()
    }

    targetGroup.emojis.push(newEmoji)

    // 保存到存储
    await storage.setAllEmojiGroups(groups)

    try {
      const chromeAPI = getChromeAPI()
      if (chromeAPI?.runtime?.sendMessage) {
        chromeAPI.runtime.sendMessage({
          type: 'EMOJI_EXTENSION_UNGROUPED_ADDED',
          payload: {
            emoji: newEmoji,
            group: {
              id: targetGroup.id,
              name: targetGroup.name,
              icon: targetGroup.icon,
              order: targetGroup.order
            }
          }
        })
      }
    } catch (broadcastError) {
      console.warn('[Background] Failed to broadcast ungrouped emoji addition', broadcastError)
    }

    console.log('[Background] 成功添加表情：', newEmoji.name)
    sendResponse({ success: true, message: '表情已添加到目标分组' })
  } catch (error) {
    console.error('[Background] 添加表情失败：', error)
    sendResponse({ success: false, error: error instanceof Error ? error.message : '添加失败' })
  }
}
