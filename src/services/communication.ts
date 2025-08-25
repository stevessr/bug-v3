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
      if (typeof chrome !== 'undefined' && chrome.runtime) {
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
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type && event.data.from !== this.context) {
          this.handleMessage(event.data)
        }
      })
    } catch (error) {
      console.warn('Failed to initialize window message listener:', error)
    }
  }

  private handleMessage(message: Message) {
    const handlers = this.handlers.get(message.type)
    if (handlers) {
      handlers.forEach(handler => {
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
        clonedPayload = JSON.parse(JSON.stringify(payload))
      } catch (error) {
        console.warn('Failed to clone payload:', error)
        clonedPayload = payload
      }
    }

    const message: Message = {
      type,
      payload: clonedPayload,
      from: this.context,
      timestamp: Date.now()
    }

    // 发送到其他扩展页面（popup, options, background）
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage(message, (response: any) => {
          if (chrome.runtime.lastError) {
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
    try {
      window.addEventListener(type, ((event: CustomEvent) => {
        if (event.detail && event.detail.from !== this.context) {
          handler(event.detail)
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
      handler(message.payload)
    })
  }

  // 监听表情组变更
  onGroupsChanged(handler: (groups: any[]) => void) {
    this.on('app:groups-changed', (message) => {
      handler(message.payload)
    })
  }

  // 监听表情使用记录
  onUsageRecorded(handler: (data: { uuid: string; timestamp: number }) => void) {
    this.on('app:usage-recorded', (message) => {
      handler(message.payload)
    })
  }

  // 监听数据导入
  onDataImported(handler: (data: any) => void) {
    this.on('app:data-imported', (message) => {
      handler(message.payload)
    })
  }
}

// 创建不同上下文的通信服务实例
export const createPopupCommService = () => new CommunicationService('popup')
export const createOptionsCommService = () => new CommunicationService('options')
export const createBackgroundCommService = () => new CommunicationService('background')
export const createContentScriptCommService = () => new CommunicationService('content-script')

export default CommunicationService