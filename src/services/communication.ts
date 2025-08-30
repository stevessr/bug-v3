// 跨页面通信服务
declare const chrome: any

export interface Message {
  type: string
  payload?: any
  from?: string
  timestamp?: number
}

// 新增：表情同步相关的消息类型
export interface SyncMessage extends Message {
  type: 'COMMON_EMOJI_UPDATED' | 'EMOJI_ORDER_CHANGED' | 'GROUP_ICON_UPDATED' | 'UNGROUPED_EMOJIS_CHANGED'
  payload: SyncMessagePayload
}

// 同步消息的payload结构
export interface SyncMessagePayload {
  uuid?: string
  groupUUID?: string
  commonGroup?: EmojiGroup
  updatedOrder?: string[]
  iconUrl?: string
  ungroupedEmojis?: Emoji[]
  timestamp: number
}

// 表情相关的数据类型定义
export interface EmojiGroup {
  UUID: string
  id: string
  displayName: string
  icon: string
  order: number
  emojis: Emoji[]
  originalId?: string
}

export interface Emoji {
  UUID: string
  displayName: string
  url?: string
  usageCount?: number
  lastUsed?: number
  groupUUID?: string
}

export interface MessageHandler {
  (message: Message): void
}

class CommunicationService {
  private handlers: Map<string, MessageHandler[]> = new Map()
  private context: string

  constructor(context: string) {
    this.context = context
    this.init()
  }

  private init() {
    // 监听来自其他页面的消息
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
          if (request.type && request.from !== this.context) {
            this.handleMessage(request)
          }
          // 返回 true 表示会异步发送响应
          return true
        })
      }
    } catch (error) {
      console.warn('Failed to initialize chrome.runtime.onMessage:', error)
    }

    // 监听来自内容脚本的消息
    try {
      if (typeof window !== 'undefined') {
        window.addEventListener('message', (event) => {
          if (event.data && event.data.type && event.data.from !== this.context) {
            this.handleMessage(event.data)
          }
        })
      }
    } catch (error) {
      console.warn('Failed to initialize window message listener:', error)
    }
  }

  private handleMessage(message: Message) {
    const handlers = this.handlers.get(message.type)
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(message)
        } catch (error) {
          console.error('Error in message handler:', error)
        }
      })
    }
  }

  // 发送消息到所有其他页面
  send(type: string, payload?: any) {
    // 深度克隆payload以确保它可以被序列化
    let clonedPayload = payload
    if (payload) {
      try {
        // 对于 Vue Proxy 对象，先转换为普通对象
        const plainPayload = payload && typeof payload === 'object' ? { ...payload } : payload
        clonedPayload = JSON.parse(JSON.stringify(plainPayload))
        console.log(`Communication: sending ${type} with payload:`, clonedPayload)
      } catch (error) {
        console.warn('Failed to clone payload:', error)
        // 如果序列化失败，尝试创建一个普通对象副本
        try {
          clonedPayload = payload && typeof payload === 'object' ? { ...payload } : payload
        } catch (e) {
          console.warn('Failed to create object copy:', e)
          clonedPayload = payload
        }
      }
    }

    const message: Message = {
      type,
      payload: clonedPayload,
      from: this.context,
      timestamp: Date.now(),
    }

    // 发送到其他扩展页面（popup, options, background）
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage(message, (response: any) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            console.warn('Message sending failed:', chrome.runtime.lastError)
          }
        })
      }
    } catch (error) {
      console.warn('Failed to send message via chrome.runtime:', error)
    }

    // 发送到当前页面的其他监听器
    try {
      window.postMessage(message, '*')
    } catch (error) {
      console.warn('Failed to send message via window.postMessage:', error)
    }

    // 广播到当前页面的 CustomEvent 监听器（向后兼容）
    try {
      window.dispatchEvent(new CustomEvent(type, { detail: message }))
    } catch (error) {
      console.warn('Failed to dispatch CustomEvent:', error)
    }
  }

  // 监听特定类型的消息
  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, [])
    }
    this.handlers.get(type)!.push(handler)

    // 同时监听 CustomEvent（向后兼容）
    // Only treat CustomEvent as an external message when the detail includes a `from` field.
    // Some parts of the app dispatch raw settings objects (detail = settings) without a
    // `from` property; those should not be treated as cross-context messages.
    try {
      window.addEventListener(type, ((event: CustomEvent) => {
        // require an explicit `from` marker to avoid handling local dispatches
        try {
          if (
            event.detail &&
            (event.detail as any).from &&
            (event.detail as any).from !== this.context
          ) {
            handler(event.detail)
          }
        } catch (e) {
          // ignore malformed event.detail
        }
      }) as EventListener)
    } catch (error) {
      console.warn('Failed to add CustomEvent listener:', error)
    }
  }

  // 移除监听器
  off(type: string, handler: MessageHandler) {
    const handlers = this.handlers.get(type)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  // 发送设置变更消息
  sendSettingsChanged(settings: any) {
    this.send('app:settings-changed', settings)
  }

  // 发送表情组变更消息
  sendGroupsChanged(groups: any[]) {
    this.send('app:groups-changed', groups)
  }

  // 发送普通表情组变更消息
  sendNormalGroupsChanged(groups: any[]) {
    this.send('app:normal-groups-changed', { groups, timestamp: Date.now() })
  }

  // 发送常用表情组变更消息
  sendCommonEmojiGroupChanged(group: any) {
    this.send('app:common-group-changed', { group, timestamp: Date.now() })
  }

  // 发送未分组表情变更消息
  sendUngroupedEmojisChanged(emojis: any[]) {
    this.send('app:ungrouped-changed', { emojis, timestamp: Date.now() })
  }

  // 发送特定表情组变更消息（精确到单个组）
  sendSpecificGroupChanged(groupUUID: string, group: any) {
    this.send('app:specific-group-changed', { groupUUID, group, timestamp: Date.now() })
  }

  // 发送表情使用记录消息
  sendUsageRecorded(uuid: string) {
    try {
      const payload = { uuid, timestamp: Date.now() }
      console.log(`[Communication:${this.context}] Sending usage recorded message:`, payload)
      this.send('app:usage-recorded', payload)
    } catch (error) {
      console.error(`[Communication:${this.context}] Failed to send usage recorded message:`, error)
    }
  }

  // 发送数据导入消息
  sendDataImported(data: any) {
    this.send('app:data-imported', data)
  }

  // 新增：发送同步消息的方法
  // 发送常用表情更新消息
  sendCommonEmojiUpdated(commonGroup: EmojiGroup) {
    try {
      const payload: SyncMessagePayload = {
        commonGroup,
        timestamp: Date.now()
      }
      console.log(`[Communication:${this.context}] Sending common emoji updated:`, payload)
      this.send('COMMON_EMOJI_UPDATED', payload)
    } catch (error) {
      console.error(`[Communication:${this.context}] Failed to send common emoji updated:`, error)
    }
  }

  // 发送表情排序变更消息
  sendEmojiOrderChanged(groupUUID: string, updatedOrder: string[]) {
    try {
      const payload: SyncMessagePayload = {
        groupUUID,
        updatedOrder,
        timestamp: Date.now()
      }
      console.log(`[Communication:${this.context}] Sending emoji order changed:`, payload)
      this.send('EMOJI_ORDER_CHANGED', payload)
    } catch (error) {
      console.error(`[Communication:${this.context}] Failed to send emoji order changed:`, error)
    }
  }

  // 发送分组图标更新消息
  sendGroupIconUpdated(groupUUID: string, iconUrl: string) {
    try {
      const payload: SyncMessagePayload = {
        groupUUID,
        iconUrl,
        timestamp: Date.now()
      }
      console.log(`[Communication:${this.context}] Sending group icon updated:`, payload)
      this.send('GROUP_ICON_UPDATED', payload)
    } catch (error) {
      console.error(`[Communication:${this.context}] Failed to send group icon updated:`, error)
    }
  }

  // 发送未分组表情变更消息（新版本）
  sendUngroupedEmojisChangedSync(ungroupedEmojis: Emoji[]) {
    try {
      const payload: SyncMessagePayload = {
        ungroupedEmojis,
        timestamp: Date.now()
      }
      console.log(`[Communication:${this.context}] Sending ungrouped emojis changed:`, payload)
      this.send('UNGROUPED_EMOJIS_CHANGED', payload)
    } catch (error) {
      console.error(`[Communication:${this.context}] Failed to send ungrouped emojis changed:`, error)
    }
  }

  // 监听设置变更
  onSettingsChanged(handler: (settings: any) => void) {
    this.on('app:settings-changed', (message) => {
      // message may be a full Message object or a raw payload (CustomEvent detail)
      if (message && typeof message === 'object') {
        const payload = message.payload !== undefined ? message.payload : message
        handler(payload)
      } else {
        handler(message)
      }
    })
  }

  // 监听表情组变更
  onGroupsChanged(handler: (groups: any[]) => void) {
    this.on('app:groups-changed', (message) => {
      if (message && typeof message === 'object') {
        const payload = message.payload !== undefined ? message.payload : message
        handler(payload)
      } else {
        handler(message)
      }
    })
  }

  // 监听普通表情组变更
  onNormalGroupsChanged(handler: (data: { groups: any[]; timestamp: number }) => void) {
    this.on('app:normal-groups-changed', (message) => {
      if (message && typeof message === 'object') {
        const payload = message.payload !== undefined ? message.payload : message
        handler(payload)
      } else {
        handler(message)
      }
    })
  }

  // 监听常用表情组变更
  onCommonEmojiGroupChanged(handler: (data: { group: any; timestamp: number }) => void) {
    this.on('app:common-group-changed', (message) => {
      if (message && typeof message === 'object') {
        const payload = message.payload !== undefined ? message.payload : message
        handler(payload)
      } else {
        handler(message)
      }
    })
  }

  // 监听未分组表情变更
  onUngroupedEmojisChanged(handler: (data: { emojis: any[]; timestamp: number }) => void) {
    this.on('app:ungrouped-changed', (message) => {
      if (message && typeof message === 'object') {
        const payload = message.payload !== undefined ? message.payload : message
        handler(payload)
      } else {
        handler(message)
      }
    })
  }

  // 监听特定表情组变更
  onSpecificGroupChanged(
    handler: (data: { groupUUID: string; group: any; timestamp: number }) => void,
  ) {
    this.on('app:specific-group-changed', (message) => {
      if (message && typeof message === 'object') {
        const payload = message.payload !== undefined ? message.payload : message
        handler(payload)
      } else {
        handler(message)
      }
    })
  }

  // 监听表情使用记录
  onUsageRecorded(handler: (data: { uuid: string; timestamp: number }) => void) {
    this.on('app:usage-recorded', (message) => {
      try {
        console.log(`[Communication:${this.context}] Received usage recorded message:`, message)

        if (message && typeof message === 'object') {
          const payload = message.payload !== undefined ? message.payload : message

          // 验证payload格式
          if (payload && typeof payload === 'object' && payload.uuid) {
            handler(payload)
          } else {
            console.warn(`[Communication:${this.context}] Invalid usage recorded payload:`, payload)
          }
        } else {
          // 处理简单格式的消息
          if (message && typeof message === 'string') {
            handler({ uuid: message, timestamp: Date.now() })
          } else {
            handler(message)
          }
        }
      } catch (error) {
        console.error(
          `[Communication:${this.context}] Error handling usage recorded message:`,
          error,
        )
      }
    })
  }

  // 监听数据导入
  onDataImported(handler: (data: any) => void) {
    this.on('app:data-imported', (message) => {
      if (message && typeof message === 'object') {
        const payload = message.payload !== undefined ? message.payload : message
        handler(payload)
      } else {
        handler(message)
      }
    })
  }

  // 新增：同步消息的监听器方法
  // 监听常用表情更新
  onCommonEmojiUpdated(handler: (commonGroup: EmojiGroup) => void) {
    this.on('COMMON_EMOJI_UPDATED', (message) => {
      try {
        console.log(`[Communication:${this.context}] Received common emoji updated:`, message)
        
        if (message && typeof message === 'object') {
          const payload = message.payload !== undefined ? message.payload : message
          
          if (payload && payload.commonGroup) {
            handler(payload.commonGroup)
          } else {
            console.warn(`[Communication:${this.context}] Invalid common emoji updated payload:`, payload)
          }
        }
      } catch (error) {
        console.error(`[Communication:${this.context}] Error handling common emoji updated:`, error)
      }
    })
  }

  // 监听表情排序变更
  onEmojiOrderChanged(handler: (groupUUID: string, updatedOrder: string[]) => void) {
    this.on('EMOJI_ORDER_CHANGED', (message) => {
      try {
        console.log(`[Communication:${this.context}] Received emoji order changed:`, message)
        
        if (message && typeof message === 'object') {
          const payload = message.payload !== undefined ? message.payload : message
          
          if (payload && payload.groupUUID && payload.updatedOrder) {
            handler(payload.groupUUID, payload.updatedOrder)
          } else {
            console.warn(`[Communication:${this.context}] Invalid emoji order changed payload:`, payload)
          }
        }
      } catch (error) {
        console.error(`[Communication:${this.context}] Error handling emoji order changed:`, error)
      }
    })
  }

  // 监听分组图标更新
  onGroupIconUpdated(handler: (groupUUID: string, iconUrl: string) => void) {
    this.on('GROUP_ICON_UPDATED', (message) => {
      try {
        console.log(`[Communication:${this.context}] Received group icon updated:`, message)
        
        if (message && typeof message === 'object') {
          const payload = message.payload !== undefined ? message.payload : message
          
          if (payload && payload.groupUUID && payload.iconUrl) {
            handler(payload.groupUUID, payload.iconUrl)
          } else {
            console.warn(`[Communication:${this.context}] Invalid group icon updated payload:`, payload)
          }
        }
      } catch (error) {
        console.error(`[Communication:${this.context}] Error handling group icon updated:`, error)
      }
    })
  }

  // 监听未分组表情变更（新版本）
  onUngroupedEmojisChangedSync(handler: (ungroupedEmojis: Emoji[]) => void) {
    this.on('UNGROUPED_EMOJIS_CHANGED', (message) => {
      try {
        console.log(`[Communication:${this.context}] Received ungrouped emojis changed:`, message)
        
        if (message && typeof message === 'object') {
          const payload = message.payload !== undefined ? message.payload : message
          
          if (payload && payload.ungroupedEmojis) {
            handler(payload.ungroupedEmojis)
          } else {
            console.warn(`[Communication:${this.context}] Invalid ungrouped emojis changed payload:`, payload)
          }
        }
      } catch (error) {
        console.error(`[Communication:${this.context}] Error handling ungrouped emojis changed:`, error)
      }
    })
  }
}

// 创建不同上下文的通信服务实例
export const createPopupCommService = () => new CommunicationService('popup')
export const createOptionsCommService = () => new CommunicationService('options')
export const createBackgroundCommService = () => new CommunicationService('background')
export const createContentScriptCommService = () => new CommunicationService('content-script')

export default CommunicationService
