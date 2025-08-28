// 跨页面通信服务
declare const chrome: any

export interface Message {
  type: string
  payload?: any
  from?: string
  timestamp?: number
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
    this.send('app:usage-recorded', { uuid, timestamp: Date.now() })
  }

  // 发送数据导入消息
  sendDataImported(data: any) {
    this.send('app:data-imported', data)
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
      if (message && typeof message === 'object') {
        const payload = message.payload !== undefined ? message.payload : message
        handler(payload)
      } else {
        handler(message)
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
}

// 创建不同上下文的通信服务实例
export const createPopupCommService = () => new CommunicationService('popup')
export const createOptionsCommService = () => new CommunicationService('options')
export const createBackgroundCommService = () => new CommunicationService('background')
export const createContentScriptCommService = () => new CommunicationService('content-script')

export default CommunicationService
