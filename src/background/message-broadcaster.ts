// background/message-broadcaster.ts - 消息广播系统
// 确保消息能够在所有扩展页面之间可靠传递

declare const chrome: any

export interface BroadcastMessage {
  type: string
  payload: any
  from: string
  timestamp: number
  id: string
}

export class MessageBroadcaster {
  private messageQueue: BroadcastMessage[] = []
  private isProcessing = false
  private readonly MAX_QUEUE_SIZE = 100
  private readonly PROCESS_INTERVAL = 50 // ms

  constructor() {
    this.log('Message broadcaster initialized')
    this.startQueueProcessor()
  }

  private log(...args: any[]) {
    console.log('[MessageBroadcaster]', ...args)
  }

  /**
   * 广播消息到所有扩展页面
   */
  async broadcastMessage(type: string, payload: any, from: string = 'background'): Promise<void> {
    const message: BroadcastMessage = {
      type,
      payload: this.sanitizePayload(payload),
      from,
      timestamp: Date.now(),
      id: this.generateMessageId()
    }

    // 添加到队列
    this.addToQueue(message)
  }

  /**
   * 清理payload，确保可以序列化
   */
  private sanitizePayload(payload: any): any {
    try {
      if (payload === null || payload === undefined) {
        return payload
      }

      if (typeof payload === 'string' || typeof payload === 'number' || typeof payload === 'boolean') {
        return payload
      }

      // 处理数组
      if (Array.isArray(payload)) {
        return payload.map(item => this.sanitizePayload(item))
      }

      // 处理对象
      if (typeof payload === 'object') {
        const sanitized: any = {}
        for (const [key, value] of Object.entries(payload)) {
          try {
            sanitized[key] = this.sanitizePayload(value)
          } catch (error) {
            this.log(`Failed to sanitize property ${key}:`, error)
            sanitized[key] = null
          }
        }
        return sanitized
      }

      return payload
    } catch (error) {
      this.log('Failed to sanitize payload:', error)
      return null
    }
  }

  /**
   * 生成唯一消息ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 添加消息到队列
   */
  private addToQueue(message: BroadcastMessage): void {
    // 防止队列过长
    if (this.messageQueue.length >= this.MAX_QUEUE_SIZE) {
      this.messageQueue.shift() // 移除最老的消息
      this.log('⚠️ Message queue full, dropped oldest message')
    }

    this.messageQueue.push(message)
    this.log(`📬 Message queued: ${message.type} (queue size: ${this.messageQueue.length})`)
  }

  /**
   * 启动队列处理器
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      if (!this.isProcessing && this.messageQueue.length > 0) {
        this.processQueue()
      }
    }, this.PROCESS_INTERVAL)
  }

  /**
   * 处理消息队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.messageQueue.length === 0) {
      return
    }

    this.isProcessing = true

    try {
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift()
        if (message) {
          await this.sendMessage(message)
        }
      }
    } catch (error) {
      this.log('❌ Error processing message queue:', error)
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * 发送单个消息
   */
  private async sendMessage(message: BroadcastMessage): Promise<void> {
    const promises: Promise<void>[] = []

    // 发送到扩展页面 (popup, options)
    promises.push(this.sendToExtensionPages(message))

    // 发送到所有内容脚本
    promises.push(this.sendToContentScripts(message))

    try {
      await Promise.allSettled(promises)
      this.log(`✅ Message broadcast completed: ${message.type}`)
    } catch (error) {
      this.log(`❌ Message broadcast failed: ${message.type}`, error)
    }
  }

  /**
   * 发送到扩展页面
   */
  private async sendToExtensionPages(message: BroadcastMessage): Promise<void> {
    return new Promise((resolve) => {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage(message, (response: any) => {
            if (chrome.runtime.lastError) {
              // 这是正常的，可能没有活动的扩展页面在监听
              this.log(`📡 Extension pages broadcast completed (no active listeners expected): ${message.type}`)
            } else {
              this.log(`📡 Extension pages broadcast completed: ${message.type}`)
            }
            resolve()
          })
        } else {
          resolve()
        }
      } catch (error) {
        this.log('❌ Failed to send to extension pages:', error)
        resolve()
      }
    })
  }

  /**
   * 发送到所有内容脚本
   */
  private async sendToContentScripts(message: BroadcastMessage): Promise<void> {
    return new Promise((resolve) => {
      try {
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
          chrome.tabs.query({}, (tabs: any[]) => {
            if (chrome.runtime.lastError) {
              this.log('❌ Failed to query tabs:', chrome.runtime.lastError)
              resolve()
              return
            }

            let completedCount = 0
            const totalTabs = tabs.length

            if (totalTabs === 0) {
              this.log(`📡 Content scripts broadcast completed (no tabs): ${message.type}`)
              resolve()
              return
            }

            const onTabComplete = () => {
              completedCount++
              if (completedCount >= totalTabs) {
                this.log(`📡 Content scripts broadcast completed to ${totalTabs} tabs: ${message.type}`)
                resolve()
              }
            }

            for (const tab of tabs) {
              if (tab.id) {
                try {
                  chrome.tabs.sendMessage(tab.id, message, () => {
                    // 忽略错误，因为某些标签页可能没有内容脚本
                    onTabComplete()
                  })
                } catch (error) {
                  onTabComplete()
                }
              } else {
                onTabComplete()
              }
            }
          })
        } else {
          resolve()
        }
      } catch (error) {
        this.log('❌ Failed to send to content scripts:', error)
        resolve()
      }
    })
  }

  /**
   * 获取队列状态
   */
  getQueueStatus() {
    return {
      queueSize: this.messageQueue.length,
      isProcessing: this.isProcessing,
      maxQueueSize: this.MAX_QUEUE_SIZE
    }
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.messageQueue.length = 0
    this.log('🧹 Message queue cleared')
  }
}

// 创建全局广播器实例
const globalBroadcaster = new MessageBroadcaster()

export default globalBroadcaster