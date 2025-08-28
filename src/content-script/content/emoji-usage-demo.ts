// 表情选择器使用计数更新功能演示
// 这个文件展示了核心实现的关键代码片段

// ====== 类型定义 ======
interface EmojiData {
  id: string
  displayName: string
  realUrl: URL
  displayUrl: URL
  UUID: string
}

interface BackgroundMessage {
  type: string
  uuid: string
}

interface BackgroundResponse {
  success: boolean
  message?: string
  error?: string
}

// Chrome扩展API类型声明
declare global {
  interface Window {
    chrome?: {
      storage: {
        local: {
          set: (data: any) => void
        }
      }
    }
  }
}

// 模拟chrome全局变量
declare const chrome:
  | {
      storage: {
        local: {
          set: (data: any) => void
        }
      }
    }
  | undefined

// ====== 1. 通信服务设置 ======
import { createContentScriptCommService } from '../../services/communication'
const commService = createContentScriptCommService()

// ====== 模拟函数声明 ======
// 模拟后台通信函数
declare function sendMessageToBackground(message: BackgroundMessage): Promise<BackgroundResponse>

// 模拟表情插入函数
declare function insertEmoji(emojiData: EmojiData): Promise<void>

// 模拟选择器关闭函数
declare function closePicker(picker: HTMLElement, isMobile: boolean): void

// 模拟存储加载函数
declare function loadFromChromeStorage(): Promise<any>

// 模拟全局变量
declare let emojiGroupsStore: any
declare let lastPayloadGlobal: any
declare let saveData: any
declare function sendResponse(response: any): void

// ====== 2. 使用记录函数 ======
async function recordEmojiUsage(uuid: string): Promise<boolean> {
  try {
    console.log('[Emoji Usage] 记录表情使用:', uuid)

    // 主要方式：通过后台通信更新使用计数
    const response = await sendMessageToBackground({
      type: 'RECORD_EMOJI_USAGE',
      uuid: uuid,
    })

    if (response && response.success) {
      console.log('[Emoji Usage] 成功更新使用计数')
      // 通知其他页面使用记录已更新
      commService.sendUsageRecorded(uuid)
      return true
    } else {
      // 回退方案：直接调用存储模块
      const { recordUsage } = await import('../../data/store/main')
      const result = recordUsage(uuid)
      if (result) {
        commService.sendUsageRecorded(uuid)
        return true
      }
    }
  } catch (error) {
    console.error('[Emoji Usage] 记录使用失败:', error)
  }

  return false
}

// ====== 3. 表情HTML生成（保留UUID） ======
function generateEmojiHTML(emojiData: EmojiData): string {
  const emojiUUID = emojiData.UUID || ''
  const displayUrl = emojiData.displayUrl.href
  const dataEmoji = emojiData.displayName
  const nameEsc = emojiData.displayName

  // 添加 data-uuid 属性来保留原始 UUID 信息
  return `<img width="32" height="32" class="emoji"
           src="${displayUrl}"
           data-emoji="${dataEmoji}"
           data-uuid="${emojiUUID}"
           alt="${nameEsc}"
           title=":${nameEsc}:"
           loading="lazy" />`
}

// ====== 4. 表情点击事件处理 ======
function handleEmojiClick(img: HTMLImageElement): void {
  img.addEventListener('click', async () => {
    // 获取原始 UUID 信息
    const originalUUID = img.getAttribute('data-uuid') || ''

    const emojiData: EmojiData = {
      id: img.getAttribute('data-emoji') || '',
      displayName: img.getAttribute('data-emoji') || '',
      realUrl: new URL(img.getAttribute('src') || '', window.location.origin),
      displayUrl: new URL(img.getAttribute('src') || '', window.location.origin),
      UUID: originalUUID || crypto.randomUUID(),
    }

    // 先记录使用统计（如果有原始 UUID）
    if (originalUUID) {
      try {
        await recordEmojiUsage(originalUUID)
        console.log('[Emoji Picker] 成功记录表情使用:', originalUUID)
      } catch (error) {
        console.error('[Emoji Picker] 记录表情使用失败:', error)
      }
    }

    // 然后插入表情
    await insertEmoji(emojiData)

    // 模拟关闭选择器
    const picker = document.querySelector('.emoji-picker') as HTMLElement
    const isMobilePicker = window.innerWidth <= 768
    if (picker) {
      closePicker(picker, isMobilePicker)
    }
  })
}

// ====== 5. 后台服务处理（background/index.ts） ======
// 这是一个演示函数，展示后台服务如何处理使用记录消息
function handleBackgroundEmojiUsage(msg: any, sendResponse: (response: any) => void): boolean {
  if (msg && msg.type === 'RECORD_EMOJI_USAGE' && msg.uuid) {
    try {
      const uuid = msg.uuid
      let success = false

      // 尝试使用 emojiGroupsStore.recordUsageByUUID
      if (emojiGroupsStore && typeof emojiGroupsStore.recordUsageByUUID === 'function') {
        success = emojiGroupsStore.recordUsageByUUID(uuid)
      }

      // 如果失败，手动更新存储数据
      if (!success) {
        loadFromChromeStorage().then((freshData) => {
          // 查找并更新表情使用计数
          for (const group of freshData.emojiGroups) {
            for (const emoji of group.emojis) {
              if (emoji.UUID === uuid) {
                const now = Date.now()
                if (!emoji.lastUsed) {
                  emoji.usageCount = 1
                  emoji.lastUsed = now
                } else {
                  // 按天衰减算法（每天衰减80%）
                  const days = Math.floor((now - emoji.lastUsed) / (24 * 60 * 60 * 1000))
                  if (days >= 1) {
                    emoji.usageCount = Math.floor(emoji.usageCount * Math.pow(0.8, days))
                  }
                  emoji.usageCount = (emoji.usageCount || 0) + 1
                  emoji.lastUsed = now
                }
                success = true
                break
              }
            }
          }

          // 保存更新后的数据
          if (success && typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set(saveData)
            lastPayloadGlobal = freshData
          }

          sendResponse({
            success: success,
            message: success ? 'Usage recorded successfully' : 'Failed to record usage',
          })
        })
      } else {
        sendResponse({
          success: success,
          message: success ? 'Usage recorded successfully' : 'Failed to record usage',
        })
      }
    } catch (error) {
      sendResponse({
        success: false,
        error: (error as Error).message,
      })
    }
    return true
  }
  return false
}

// ====== 使用流程总结 ======
/**
 * 1. 用户点击表情选择器中的表情
 * 2. 从 DOM 获取表情的原始 UUID（data-uuid 属性）
 * 3. 调用 recordEmojiUsage(uuid) 记录使用统计
 * 4. 通过后台通信发送 RECORD_EMOJI_USAGE 消息
 * 5. 后台服务更新表情的 usageCount 和 lastUsed
 * 6. 使用按天衰减算法保持数据新鲜度
 * 7. 通过通信服务通知所有页面使用记录已更新
 * 8. 其他页面（如popup）立即刷新常用表情列表
 * 9. 继续插入表情到文本框
 */

export { recordEmojiUsage, generateEmojiHTML, handleEmojiClick }
