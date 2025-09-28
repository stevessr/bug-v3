import { newStorageHelpers } from '../../utils/newStorage'
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
        await newStorageHelpers.ensureDiscourseDomainExists(emojiData.sourceDomain)
      }
    } catch (e) {
      // Non-fatal: log and continue
      console.warn('[Background] ensureDiscourseDomainExists failed', e)
    }
    // 获取所有表情组
    const groups = await newStorageHelpers.getAllEmojiGroups()

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

    // 检查是否已存在相同URL的表情
    const existingEmoji = ungroupedGroup.emojis.find((e: any) => e.url === emojiData.url)
    if (existingEmoji) {
      sendResponse({ success: false, error: '此表情已存在于未分组中' })
      return
    }

    // 创建新表情
    // If pixiv original image, try downloading and uploading to recent Discourse
    let finalUrl = emojiData.url
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
            if (uploadResult && uploadResult.url) finalUrl = uploadResult.url
          } catch (e) {
            // ignore upload errors and fallback to original url
            void e
          }
        }
      }
    } catch (_e) {
      void _e
    }

    const newEmoji = {
      id: `emoji-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      packet: Date.now(),
      name: emojiData.name,
      url: finalUrl,
      groupId: 'ungrouped',
      addedAt: Date.now()
    }

    ungroupedGroup.emojis.push(newEmoji)

    // 保存到存储
    await newStorageHelpers.setAllEmojiGroups(groups)

    console.log('[Background] 成功添加表情到未分组:', newEmoji.name)
    sendResponse({ success: true, message: '表情已添加到未分组' })
  } catch (error) {
    console.error('[Background] 添加表情失败:', error)
    sendResponse({ success: false, error: error instanceof Error ? error.message : '添加失败' })
  }
}
