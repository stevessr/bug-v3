/**
 * Chat Multi-Reactor 模块
 * 在聊天消息旁添加按钮，点击后依次自动发送定义好的一组表情反应
 */

// ================= 配置区域 =================
// 默认表情代码列表（当用户未自定义时使用）
const DEFAULT_EMOJI_LIST = [
  'wavy_dash',
  'distorted_face',
  'melting_face',
  'melon',
  'nerd_face',
  'face_savoring_food',
  'six',
  'five',
  'hug',
  'flushed_face',
  'pleading_face',
  'face_holding_back_tears',
  'disguised_face',
  'hot_face',
  'cold_face',
  'face_with_monocle',
  'clown_face',
  'poop'
]

const BUTTON_TEXT = '⚡️' // 按钮显示的图标
const REQUEST_DELAY_MS = 300 // 每次请求间隔毫秒数 (建议不低于 200ms，防止触发风控)
// ===========================================

// 当前使用的表情列表（可通过配置覆盖）
let currentEmojiList: string[] = [...DEFAULT_EMOJI_LIST]

// Observer 实例
let observer: MutationObserver | null = null

/**
 * Discourse 表情数据结构
 */
export interface DiscourseEmoji {
  name: string
  tonable: boolean
  url: string
  group: string
  search_aliases?: string[]
}

export interface DiscourseEmojisResponse {
  [group: string]: DiscourseEmoji[]
}

/**
 * 获取 CSRF Token
 */
function getCsrfToken(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || ''
}

/**
 * 辅助函数：休眠
 */
const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms))

/**
 * 从消息容器提取 Channel ID
 */
function getChannelIdFromContainer(container: HTMLElement): string | null {
  try {
    const timeLink = container.querySelector<HTMLAnchorElement>('.chat-time')
    if (timeLink?.getAttribute('href')) {
      const parts = timeLink.getAttribute('href')!.split('/')
      if (parts.length >= 2) {
        const possibleId = parts[parts.length - 2]
        if (/^\d+$/.test(possibleId)) return possibleId
      }
    }
  } catch (e) {
    console.error('[ChatMultiReactor] Error getting channel ID:', e)
  }

  const match = window.location.pathname.match(/\/chat\/.*\/(\d+)/)
  return match ? match[1] : null
}

/**
 * 发送单个表情请求
 */
async function sendSingleReaction(
  channelId: string,
  messageId: string,
  emojiName: string
): Promise<boolean> {
  const url = `${window.location.origin}/chat/${channelId}/react/${messageId}`
  const csrf = getCsrfToken()
  const params = new URLSearchParams()
  params.append('react_action', 'add')
  params.append('emoji', emojiName)

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Accept: '*/*',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-CSRF-Token': csrf,
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: params
    })
    return response.ok
  } catch (e) {
    console.error('[ChatMultiReactor] Request failed:', e)
    return false
  }
}

/**
 * 执行批量发送逻辑
 */
async function executeBatchReaction(
  channelId: string | null,
  messageId: string,
  btnElement: HTMLSpanElement
): Promise<void> {
  if (!channelId || !messageId) {
    console.warn('[ChatMultiReactor] 无法获取 Channel ID 或 Message ID')
    return
  }

  const emojiList = currentEmojiList
  if (emojiList.length === 0) {
    console.warn('[ChatMultiReactor] 表情列表为空')
    return
  }

  const originalText = btnElement.innerText
  // 锁定按钮防止重复点击
  btnElement.style.pointerEvents = 'none'
  btnElement.style.opacity = '0.7'

  let successCount = 0

  // === 遍历数组 ===
  for (let i = 0; i < emojiList.length; i++) {
    const emoji = emojiList[i]

    // 更新UI显示进度
    btnElement.innerText = `${i + 1}/${emojiList.length}`

    try {
      const success = await sendSingleReaction(channelId, messageId, emoji)
      if (success) successCount++
    } catch (err) {
      console.error(`[ChatMultiReactor] Failed to send ${emoji}:`, err)
    }

    // 如果不是最后一个，稍微等待一下，防止并发过高
    if (i < emojiList.length - 1) {
      await sleep(REQUEST_DELAY_MS)
    }
  }

  // === 结束处理 ===
  if (successCount === emojiList.length) {
    btnElement.innerText = '✅' // 全成
  } else {
    btnElement.innerText = `🆗 ${successCount}` // 部分成功
  }

  // 1.5秒后恢复按钮状态
  setTimeout(() => {
    btnElement.innerText = originalText
    btnElement.style.pointerEvents = 'auto'
    btnElement.style.opacity = '1'
  }, 1500)
}

/**
 * 向消息容器注入按钮
 */
function processContainer(container: HTMLElement): void {
  if (container.dataset.comboInjected === 'true') return

  const messageId = container.getAttribute('data-id')
  const infoBar = container.querySelector('.chat-message-info')

  if (!messageId || !infoBar) return

  const channelId = getChannelIdFromContainer(container)

  // 创建按钮
  const btn = document.createElement('span')
  btn.innerText = BUTTON_TEXT
  btn.style.cursor = 'pointer'
  btn.style.marginLeft = '8px'
  btn.style.fontSize = '16px'
  btn.style.userSelect = 'none'
  btn.title = `发送表情组合：${currentEmojiList.join(', ')}`

  // 样式微调
  btn.onmouseover = () => (btn.style.transform = 'scale(1.2)')
  btn.onmouseout = () => (btn.style.transform = 'scale(1)')
  btn.style.transition = 'transform 0.1s'

  // 绑定点击
  btn.onclick = (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    void executeBatchReaction(channelId, messageId, btn)
  }

  infoBar.appendChild(btn)
  container.dataset.comboInjected = 'true'
}

/**
 * 获取 Discourse 站点的所有可用表情
 * @returns 表情数据，按分组组织
 */
export async function fetchDiscourseEmojis(): Promise<DiscourseEmojisResponse | null> {
  try {
    const csrf = getCsrfToken()
    const response = await fetch(`${window.location.origin}/emojis.json`, {
      method: 'GET',
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'X-CSRF-Token': csrf,
        'X-Requested-With': 'XMLHttpRequest'
      },
      credentials: 'include'
    })

    if (!response.ok) {
      console.error('[ChatMultiReactor] Failed to fetch emojis:', response.status)
      return null
    }

    const data = await response.json()
    return data as DiscourseEmojisResponse
  } catch (e) {
    console.error('[ChatMultiReactor] Error fetching emojis:', e)
    return null
  }
}

/**
 * 获取所有表情名称的扁平列表
 */
export async function getAllEmojiNames(): Promise<string[]> {
  const emojis = await fetchDiscourseEmojis()
  if (!emojis) return []

  const names: string[] = []
  for (const group of Object.values(emojis)) {
    for (const emoji of group) {
      names.push(emoji.name)
    }
  }
  return names
}

/**
 * 设置自定义表情列表
 */
export function setEmojiList(emojis: string[]): void {
  if (Array.isArray(emojis) && emojis.length > 0) {
    currentEmojiList = emojis
    console.log('[ChatMultiReactor] Custom emoji list set:', emojis.length, 'emojis')
  } else {
    currentEmojiList = [...DEFAULT_EMOJI_LIST]
    console.log('[ChatMultiReactor] Using default emoji list')
  }
}

/**
 * 获取当前表情列表
 */
export function getEmojiList(): string[] {
  return [...currentEmojiList]
}

/**
 * 获取默认表情列表
 */
export function getDefaultEmojiList(): string[] {
  return [...DEFAULT_EMOJI_LIST]
}

/**
 * 初始化聊天消息多表情反应功能
 * @param customEmojis 可选的自定义表情列表
 */
export function initChatMultiReactor(customEmojis?: string[]): void {
  console.log('[ChatMultiReactor] Initializing...')

  // 设置自定义表情列表
  if (customEmojis && customEmojis.length > 0) {
    setEmojiList(customEmojis)
  }

  // 如果已经初始化过，先清理
  if (observer) {
    observer.disconnect()
    observer = null
  }

  observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement
          if (element.classList?.contains('chat-message-container')) {
            processContainer(element)
          } else if (element.querySelectorAll) {
            element
              .querySelectorAll<HTMLElement>('.chat-message-container')
              .forEach(processContainer)
          }
        }
      })
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })

  // 处理已存在的消息容器
  document.querySelectorAll<HTMLElement>('.chat-message-container').forEach(processContainer)

  console.log('[ChatMultiReactor] Initialized successfully with', currentEmojiList.length, 'emojis')
}

/**
 * 停止聊天消息多表情反应功能
 */
export function stopChatMultiReactor(): void {
  if (observer) {
    observer.disconnect()
    observer = null
    console.log('[ChatMultiReactor] Stopped')
  }
}
