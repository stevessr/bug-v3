// Enhanced Cross-Page Communication Service
// Provides robust real-time communication between all extension components

import { communicationLogger, CURRENT_LOG_LEVEL, LOG_LEVELS } from '../utils/logger'

declare const chrome: any

// Enhanced logger for communication service
const logger = communicationLogger

export interface Message {
  type: string
  payload?: any
  from?: string
  to?: string
  timestamp?: number
  messageId?: string
  requiresAck?: boolean
}

// Connection status tracking
interface ConnectionStatus {
  isConnected: boolean
  lastHeartbeat: number
  reconnectAttempts: number
}

// Message acknowledgment tracking
interface PendingMessage {
  message: Message
  timestamp: number
  retryCount: number
  resolve: (value: any) => void
  reject: (error: any) => void
}

// 新增：表情同步相关的消息类型
export interface SyncMessage extends Message {
  type:
    | 'COMMON_EMOJI_UPDATED'
    | 'EMOJI_ORDER_CHANGED'
    | 'GROUP_ICON_UPDATED'
    | 'UNGROUPED_EMOJIS_CHANGED'
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
  private connectionStatus: ConnectionStatus = {
    isConnected: false,
    lastHeartbeat: 0,
    reconnectAttempts: 0,
  }
  private pendingMessages: Map<string, PendingMessage> = new Map()
  private messageListeners: Map<string, (data: any) => void> = new Map()
  private heartbeatInterval: any = null
  private reconnectTimeout: any = null
  private messageQueue: Message[] = []
  private isInitialized = false

  constructor(context: string) {
    this.context = context
    this.logger = logger.child(context)
    this.init()
  }

  private logger: any

  private async init() {
    if (this.isInitialized) {
      this.logger.debug('Communication service already initialized')
      return
    }

    this.logger.info('🚀 Initializing enhanced communication service')

    // Initialize message listeners
    await this.initializeMessageListeners()

    // Start connection monitoring
    this.startConnectionMonitoring()

    // Process any queued messages
    this.processMessageQueue()

    this.isInitialized = true
    this.logger.info('✅ Enhanced communication service initialized successfully')
    this.logger.connectionStatus(true, 'Service initialized')
  }

  private async initializeMessageListeners() {
    // Enhanced chrome.runtime message listener
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((request: any, sender: any, sendResponse: any) => {
          // 🚀 修复异步响应问题 - 只在真正需要异步响应时返回 true
          const needsAsyncResponse = this.handleIncomingMessage(request, sender, sendResponse)
          return needsAsyncResponse
        })
        console.log(`[Communication:${this.context}] Chrome runtime message listener initialized`)
      }
    } catch (error) {
      console.warn(
        `[Communication:${this.context}] Failed to initialize chrome.runtime.onMessage:`,
        error,
      )
    }

    // Enhanced window message listener for content scripts
    try {
      if (typeof window !== 'undefined') {
        window.addEventListener('message', (event) => {
          if (event.data && event.data.type && event.data.from !== this.context) {
            this.handleIncomingMessage(event.data, null, null)
          }
        })
        console.log(`[Communication:${this.context}] Window message listener initialized`)
      }
    } catch (error) {
      console.warn(
        `[Communication:${this.context}] Failed to initialize window message listener:`,
        error,
      )
    }

    // Enhanced CustomEvent listener for backward compatibility
    try {
      if (typeof window !== 'undefined') {
        const customEventHandler = (event: CustomEvent) => {
          if (event.detail && event.detail.from && event.detail.from !== this.context) {
            this.handleIncomingMessage(event.detail, null, null)
          }
        }

        // Listen for all message types
        this.handlers.forEach((_, messageType) => {
          window.addEventListener(messageType, customEventHandler as EventListener)
        })

        console.log(`[Communication:${this.context}] CustomEvent listeners initialized`)
      }
    } catch (error) {
      console.warn(
        `[Communication:${this.context}] Failed to initialize CustomEvent listeners:`,
        error,
      )
    }
  }

  private async handleIncomingMessage(
    message: Message,
    sender: any,
    sendResponse: any,
  ): Promise<boolean> {
    try {
      console.log(
        `[Communication:${this.context}] Received message:`,
        message.type,
        'from:',
        message.from,
      )

      // Update connection status
      this.connectionStatus.isConnected = true
      this.connectionStatus.lastHeartbeat = Date.now()
      this.connectionStatus.reconnectAttempts = 0

      // Handle acknowledgments
      if (message.type === 'MESSAGE_ACK' && message.payload?.messageId) {
        this.handleMessageAcknowledgment(message.payload.messageId)
        return false // 不需要异步响应
      }

      // Handle heartbeat messages
      if (message.type === 'HEARTBEAT') {
        if (sendResponse) {
          sendResponse({ type: 'HEARTBEAT_ACK', timestamp: Date.now() })
        }
        return false // 不需要异步响应
      }

      // Process regular messages
      if (message.from !== this.context) {
        this.processMessage(message)

        // Send acknowledgment if required
        if (message.requiresAck && message.messageId && sendResponse) {
          sendResponse({
            type: 'MESSAGE_ACK',
            payload: { messageId: message.messageId },
            from: this.context,
            timestamp: Date.now(),
          })
        }
      }

      return false // 大多数消息不需要异步响应
    } catch (error) {
      console.error(`[Communication:${this.context}] Error handling incoming message:`, error)
      return false
    }
  }

  private processMessage(message: Message) {
    const handlers = this.handlers.get(message.type)
    if (handlers && handlers.length > 0) {
      handlers.forEach((handler) => {
        try {
          handler(message)
        } catch (error) {
          console.error(
            `[Communication:${this.context}] Error in message handler for ${message.type}:`,
            error,
          )
        }
      })
    } else {
      console.log(
        `[Communication:${this.context}] No handlers registered for message type:`,
        message.type,
      )
    }
  }

  private handleMessageAcknowledgment(messageId: string) {
    const pendingMessage = this.pendingMessages.get(messageId)
    if (pendingMessage) {
      console.log(`[Communication:${this.context}] Message acknowledged:`, messageId)
      pendingMessage.resolve({ acknowledged: true, messageId })
      this.pendingMessages.delete(messageId)
    }
  }

  private startConnectionMonitoring() {
    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat()
    }, 30000)

    // Check for connection issues every 10 seconds
    setInterval(() => {
      this.checkConnectionHealth()
    }, 10000)

    console.log(`[Communication:${this.context}] Connection monitoring started`)
  }

  private async sendHeartbeat() {
    try {
      await this.send('HEARTBEAT', { timestamp: Date.now() }, false)
    } catch (error) {
      console.warn(`[Communication:${this.context}] Heartbeat failed:`, error)
      this.connectionStatus.isConnected = false
    }
  }

  private checkConnectionHealth() {
    const now = Date.now()
    const timeSinceLastHeartbeat = now - this.connectionStatus.lastHeartbeat

    if (timeSinceLastHeartbeat > 60000) {
      // 1 minute without heartbeat
      console.warn(
        `[Communication:${this.context}] Connection appears unhealthy, attempting reconnection`,
      )
      this.connectionStatus.isConnected = false
      this.attemptReconnection()
    }
  }

  private attemptReconnection() {
    if (this.connectionStatus.reconnectAttempts >= 5) {
      console.error(`[Communication:${this.context}] Max reconnection attempts reached`)
      return
    }

    this.connectionStatus.reconnectAttempts++
    console.log(
      `[Communication:${this.context}] Reconnection attempt ${this.connectionStatus.reconnectAttempts}`,
    )

    this.reconnectTimeout = setTimeout(() => {
      this.init()
    }, 5000 * this.connectionStatus.reconnectAttempts) // Exponential backoff
  }

  private processMessageQueue() {
    if (this.messageQueue.length > 0) {
      console.log(
        `[Communication:${this.context}] Processing ${this.messageQueue.length} queued messages`,
      )
      const queuedMessages = [...this.messageQueue]
      this.messageQueue = []

      queuedMessages.forEach((message) => {
        this.send(message.type, message.payload, message.requiresAck)
      })
    }
  }

  // Enhanced send method with acknowledgment support and better error handling
  async send(type: string, payload?: any, requiresAck: boolean = false): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        // Generate unique message ID
        const messageId = `${this.context}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

        this.logger.messageSent(type, payload, 'all-contexts')
        this.logger.debug(`Sending message with ID: ${messageId}, requiresAck: ${requiresAck}`)

        // Deep clone payload to ensure it can be serialized
        let clonedPayload = payload
        if (payload) {
          try {
            // Handle Vue Proxy objects by converting to plain objects
            const plainPayload = payload && typeof payload === 'object' ? { ...payload } : payload
            clonedPayload = JSON.parse(JSON.stringify(plainPayload))
            this.logger.trace('Payload serialized successfully')
          } catch (error) {
            this.logger.warn('Failed to clone payload:', error)
            // Fallback: try to create a plain object copy
            try {
              clonedPayload = payload && typeof payload === 'object' ? { ...payload } : payload
              this.logger.debug('Using fallback payload cloning')
            } catch (e) {
              this.logger.warn('Failed to create object copy:', e)
              clonedPayload = payload
            }
          }
        }

        const message: Message = {
          type,
          payload: clonedPayload,
          from: this.context,
          timestamp: Date.now(),
          messageId,
          requiresAck,
        }

        // If connection is not healthy, queue the message
        if (!this.connectionStatus.isConnected && type !== 'HEARTBEAT') {
          console.log(
            `[Communication:${this.context}] Connection unhealthy, queuing message:`,
            type,
          )
          this.messageQueue.push(message)
          resolve({ queued: true, messageId })
          return
        }

        // Track pending acknowledgments
        if (requiresAck) {
          this.pendingMessages.set(messageId, {
            message,
            timestamp: Date.now(),
            retryCount: 0,
            resolve,
            reject,
          })

          // Set timeout for acknowledgment
          setTimeout(() => {
            const pendingMessage = this.pendingMessages.get(messageId)
            if (pendingMessage) {
              this.pendingMessages.delete(messageId)
              reject(new Error(`Message acknowledgment timeout for ${type}`))
            }
          }, 10000) // 10 second timeout
        }

        // Send to extension contexts (popup, options, background)
        this.sendToExtensionContexts(message)
          .then(() => {
            if (!requiresAck) {
              resolve({ sent: true, messageId })
            }
          })
          .catch((error) => {
            if (!requiresAck) {
              reject(error)
            }
          })

        // Send to current page listeners
        this.sendToCurrentPage(message)
      } catch (error) {
        console.error(`[Communication:${this.context}] Error in send method:`, error)
        reject(error)
      }
    })
  }

  private async sendToExtensionContexts(message: Message): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage(message, (response: any) => {
            if (chrome.runtime && chrome.runtime.lastError) {
              console.warn(
                `[Communication:${this.context}] Extension context send failed:`,
                chrome.runtime.lastError.message,
              )
              // Don't reject here as this might be expected (no receivers)
              resolve()
            } else {
              console.log(
                `[Communication:${this.context}] Extension context send successful for:`,
                message.type,
              )
              resolve()
            }
          })
        } else {
          resolve()
        }
      } catch (error) {
        console.warn(`[Communication:${this.context}] Failed to send to extension contexts:`, error)
        reject(error)
      }
    })
  }

  private sendToCurrentPage(message: Message) {
    // Send to window.postMessage listeners
    try {
      if (typeof window !== 'undefined') {
        window.postMessage(message, '*')
        console.log(`[Communication:${this.context}] Window postMessage sent for:`, message.type)
      }
    } catch (error) {
      console.warn(`[Communication:${this.context}] Failed to send via window.postMessage:`, error)
    }

    // Send to CustomEvent listeners (backward compatibility)
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(message.type, { detail: message }))
        console.log(`[Communication:${this.context}] CustomEvent dispatched for:`, message.type)
      }
    } catch (error) {
      console.warn(`[Communication:${this.context}] Failed to dispatch CustomEvent:`, error)
    }
  }

  // Enhanced message listener registration
  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, [])
    }
    this.handlers.get(type)!.push(handler)

    console.log(`[Communication:${this.context}] Registered handler for message type:`, type)

    // Enhanced CustomEvent listener for backward compatibility
    try {
      if (typeof window !== 'undefined') {
        const customEventHandler = (event: CustomEvent) => {
          try {
            // Only handle external messages with explicit 'from' marker
            if (
              event.detail &&
              (event.detail as any).from &&
              (event.detail as any).from !== this.context
            ) {
              console.log(
                `[Communication:${this.context}] Received CustomEvent:`,
                type,
                'from:',
                (event.detail as any).from,
              )
              handler(event.detail)
            }
          } catch (e) {
            console.warn(
              `[Communication:${this.context}] Error processing CustomEvent for ${type}:`,
              e,
            )
          }
        }

        window.addEventListener(type, customEventHandler as EventListener)
        console.log(`[Communication:${this.context}] CustomEvent listener added for:`, type)
      }
    } catch (error) {
      console.warn(
        `[Communication:${this.context}] Failed to add CustomEvent listener for ${type}:`,
        error,
      )
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

  // Enhanced emoji-specific communication methods with real-time sync

  // Send settings change with acknowledgment
  async sendSettingsChanged(settings: any, requiresAck: boolean = true) {
    console.log(`[Communication:${this.context}] 🚀 Sending settings changed`)
    try {
      const result = await this.send('app:settings-changed', settings, requiresAck)
      console.log(`[Communication:${this.context}] ✅ Settings changed message sent successfully`)
      return result
    } catch (error) {
      console.error(`[Communication:${this.context}] ❌ Failed to send settings changed:`, error)
      throw error
    }
  }

  // Send all groups change with acknowledgment
  async sendGroupsChanged(groups: any[], requiresAck: boolean = true) {
    console.log(
      `[Communication:${this.context}] 🚀 Sending groups changed:`,
      groups.length,
      'groups',
    )
    try {
      const result = await this.send('app:groups-changed', groups, requiresAck)
      console.log(`[Communication:${this.context}] ✅ Groups changed message sent successfully`)
      return result
    } catch (error) {
      console.error(`[Communication:${this.context}] ❌ Failed to send groups changed:`, error)
      throw error
    }
  }

  // Send normal groups change (excluding common emoji group)
  async sendNormalGroupsChanged(groups: any[], requiresAck: boolean = true) {
    console.log(
      `[Communication:${this.context}] 🚀 Sending normal groups changed:`,
      groups.length,
      'groups',
    )
    try {
      const payload = { groups, timestamp: Date.now() }
      const result = await this.send('app:normal-groups-changed', payload, requiresAck)
      console.log(
        `[Communication:${this.context}] ✅ Normal groups changed message sent successfully`,
      )
      return result
    } catch (error) {
      console.error(
        `[Communication:${this.context}] ❌ Failed to send normal groups changed:`,
        error,
      )
      throw error
    }
  }

  // Enhanced common emoji group change with multiple message types for better sync
  async sendCommonEmojiGroupChanged(group: any, requiresAck: boolean = true) {
    console.log(
      `[Communication:${this.context}] 🚀 Sending common emoji group changed:`,
      group?.displayName,
      'with',
      group?.emojis?.length || 0,
      'emojis',
    )

    try {
      const timestamp = Date.now()
      const payload = { group, timestamp }

      // Send multiple message types for comprehensive sync
      const promises = [
        this.send('app:common-group-changed', payload, requiresAck),
        this.send('COMMON_EMOJI_UPDATED', { commonGroup: group, timestamp }, requiresAck),
        this.send(
          'app:specific-group-changed',
          {
            groupUUID: 'common-emoji-group',
            group,
            timestamp,
          },
          requiresAck,
        ),
      ]

      const results = await Promise.allSettled(promises)

      // Check if all messages were sent successfully
      const successful = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length

      console.log(
        `[Communication:${this.context}] ✅ Common emoji group messages sent: ${successful} successful, ${failed} failed`,
      )

      if (failed > 0) {
        console.warn(
          `[Communication:${this.context}] ⚠️ Some common emoji group messages failed:`,
          results.filter((r) => r.status === 'rejected').map((r) => (r as any).reason),
        )
      }

      return { successful, failed, results }
    } catch (error) {
      console.error(
        `[Communication:${this.context}] ❌ Failed to send common emoji group changed:`,
        error,
      )
      throw error
    }
  }

  // Send ungrouped emojis change with acknowledgment
  async sendUngroupedEmojisChanged(emojis: any[], requiresAck: boolean = true) {
    console.log(
      `[Communication:${this.context}] 🚀 Sending ungrouped emojis changed:`,
      emojis.length,
      'emojis',
    )
    try {
      const payload = { emojis, timestamp: Date.now() }
      const result = await this.send('app:ungrouped-changed', payload, requiresAck)
      console.log(
        `[Communication:${this.context}] ✅ Ungrouped emojis changed message sent successfully`,
      )
      return result
    } catch (error) {
      console.error(
        `[Communication:${this.context}] ❌ Failed to send ungrouped emojis changed:`,
        error,
      )
      throw error
    }
  }

  // Send specific group change with acknowledgment
  async sendSpecificGroupChanged(groupUUID: string, group: any, requiresAck: boolean = true) {
    console.log(
      `[Communication:${this.context}] 🚀 Sending specific group changed:`,
      groupUUID,
      group?.displayName,
    )
    try {
      const payload = { groupUUID, group, timestamp: Date.now() }
      const result = await this.send('app:specific-group-changed', payload, requiresAck)
      console.log(
        `[Communication:${this.context}] ✅ Specific group changed message sent successfully`,
      )
      return result
    } catch (error) {
      console.error(
        `[Communication:${this.context}] ❌ Failed to send specific group changed:`,
        error,
      )
      throw error
    }
  }

  // Enhanced usage recording with acknowledgment and retry logic
  async sendUsageRecorded(uuid: string, requiresAck: boolean = true) {
    console.log(`[Communication:${this.context}] 🚀 Sending usage recorded for emoji:`, uuid)
    try {
      const payload = { uuid, timestamp: Date.now() }
      const result = await this.send('app:usage-recorded', payload, requiresAck)
      console.log(`[Communication:${this.context}] ✅ Usage recorded message sent successfully`)
      return result
    } catch (error) {
      console.error(
        `[Communication:${this.context}] ❌ Failed to send usage recorded message:`,
        error,
      )
      // Don't throw for usage recording failures - they're not critical
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }

  // Send data import completion with acknowledgment
  async sendDataImported(data: any, requiresAck: boolean = true) {
    console.log(`[Communication:${this.context}] 🚀 Sending data imported notification`)
    try {
      const result = await this.send('app:data-imported', data, requiresAck)
      console.log(`[Communication:${this.context}] ✅ Data imported message sent successfully`)
      return result
    } catch (error) {
      console.error(`[Communication:${this.context}] ❌ Failed to send data imported:`, error)
      throw error
    }
  }

  // Cleanup method to remove listeners and clear resources
  destroy() {
    console.log(`[Communication:${this.context}] 🧹 Cleaning up communication service`)

    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    // Clear pending messages
    this.pendingMessages.forEach((pending, messageId) => {
      pending.reject(new Error('Communication service destroyed'))
    })
    this.pendingMessages.clear()

    // Clear message queue
    this.messageQueue = []

    // Clear handlers
    this.handlers.clear()

    console.log(`[Communication:${this.context}] ✅ Communication service cleanup completed`)
  }

  // Enhanced sync message methods with acknowledgment support

  // Send common emoji updated with acknowledgment
  async sendCommonEmojiUpdated(commonGroup: EmojiGroup, requiresAck: boolean = true) {
    console.log(`[Communication:${this.context}] 🚀 Sending common emoji updated sync message`)
    try {
      const payload: SyncMessagePayload = {
        commonGroup,
        timestamp: Date.now(),
      }
      const result = await this.send('COMMON_EMOJI_UPDATED', payload, requiresAck)
      console.log(
        `[Communication:${this.context}] ✅ Common emoji updated sync message sent successfully`,
      )
      return result
    } catch (error) {
      console.error(
        `[Communication:${this.context}] ❌ Failed to send common emoji updated:`,
        error,
      )
      throw error
    }
  }

  // Send emoji order change with acknowledgment
  async sendEmojiOrderChanged(
    groupUUID: string,
    updatedOrder: string[],
    requiresAck: boolean = true,
  ) {
    console.log(
      `[Communication:${this.context}] 🚀 Sending emoji order changed for group:`,
      groupUUID,
    )
    try {
      const payload: SyncMessagePayload = {
        groupUUID,
        updatedOrder,
        timestamp: Date.now(),
      }
      const result = await this.send('EMOJI_ORDER_CHANGED', payload, requiresAck)
      console.log(
        `[Communication:${this.context}] ✅ Emoji order changed message sent successfully`,
      )
      return result
    } catch (error) {
      console.error(`[Communication:${this.context}] ❌ Failed to send emoji order changed:`, error)
      throw error
    }
  }

  // Send group icon update with acknowledgment
  async sendGroupIconUpdated(groupUUID: string, iconUrl: string, requiresAck: boolean = true) {
    console.log(`[Communication:${this.context}] 🚀 Sending group icon updated for:`, groupUUID)
    try {
      const payload: SyncMessagePayload = {
        groupUUID,
        iconUrl,
        timestamp: Date.now(),
      }
      const result = await this.send('GROUP_ICON_UPDATED', payload, requiresAck)
      console.log(`[Communication:${this.context}] ✅ Group icon updated message sent successfully`)
      return result
    } catch (error) {
      console.error(`[Communication:${this.context}] ❌ Failed to send group icon updated:`, error)
      throw error
    }
  }

  // Send ungrouped emojis change sync with acknowledgment
  async sendUngroupedEmojisChangedSync(ungroupedEmojis: Emoji[], requiresAck: boolean = true) {
    console.log(
      `[Communication:${this.context}] 🚀 Sending ungrouped emojis sync change:`,
      ungroupedEmojis.length,
      'emojis',
    )
    try {
      const payload: SyncMessagePayload = {
        ungroupedEmojis,
        timestamp: Date.now(),
      }
      const result = await this.send('UNGROUPED_EMOJIS_CHANGED', payload, requiresAck)
      console.log(
        `[Communication:${this.context}] ✅ Ungrouped emojis sync change sent successfully`,
      )
      return result
    } catch (error) {
      console.error(
        `[Communication:${this.context}] ❌ Failed to send ungrouped emojis sync change:`,
        error,
      )
      throw error
    }
  }

  // Enhanced listener methods with better error handling and logging

  // Listen for settings changes
  onSettingsChanged(handler: (settings: any) => void) {
    console.log(`[Communication:${this.context}] 📡 Registering settings changed listener`)
    this.on('app:settings-changed', (message) => {
      try {
        console.log(`[Communication:${this.context}] 📨 Received settings changed message`)
        const payload =
          message && typeof message === 'object' && message.payload !== undefined
            ? message.payload
            : message
        handler(payload)
      } catch (error) {
        console.error(
          `[Communication:${this.context}] ❌ Error in settings changed handler:`,
          error,
        )
      }
    })
  }

  // Listen for all groups changes
  onGroupsChanged(handler: (groups: any[]) => void) {
    console.log(`[Communication:${this.context}] 📡 Registering groups changed listener`)
    this.on('app:groups-changed', (message) => {
      try {
        console.log(`[Communication:${this.context}] 📨 Received groups changed message`)
        const payload =
          message && typeof message === 'object' && message.payload !== undefined
            ? message.payload
            : message
        handler(payload)
      } catch (error) {
        console.error(`[Communication:${this.context}] ❌ Error in groups changed handler:`, error)
      }
    })
  }

  // Listen for normal groups changes (excluding common emoji group)
  onNormalGroupsChanged(handler: (data: { groups: any[]; timestamp: number }) => void) {
    console.log(`[Communication:${this.context}] 📡 Registering normal groups changed listener`)
    this.on('app:normal-groups-changed', (message) => {
      try {
        console.log(`[Communication:${this.context}] 📨 Received normal groups changed message`)
        const payload =
          message && typeof message === 'object' && message.payload !== undefined
            ? message.payload
            : message
        handler(payload)
      } catch (error) {
        console.error(
          `[Communication:${this.context}] ❌ Error in normal groups changed handler:`,
          error,
        )
      }
    })
  }

  // Listen for common emoji group changes
  onCommonEmojiGroupChanged(handler: (data: { group: any; timestamp: number }) => void) {
    console.log(
      `[Communication:${this.context}] 📡 Registering common emoji group changed listener`,
    )
    this.on('app:common-group-changed', (message) => {
      try {
        console.log(
          `[Communication:${this.context}] 📨 Received common emoji group changed message`,
        )
        const payload =
          message && typeof message === 'object' && message.payload !== undefined
            ? message.payload
            : message
        handler(payload)
      } catch (error) {
        console.error(
          `[Communication:${this.context}] ❌ Error in common emoji group changed handler:`,
          error,
        )
      }
    })
  }

  // Listen for ungrouped emojis changes
  onUngroupedEmojisChanged(handler: (data: { emojis: any[]; timestamp: number }) => void) {
    console.log(`[Communication:${this.context}] 📡 Registering ungrouped emojis changed listener`)
    this.on('app:ungrouped-changed', (message) => {
      try {
        console.log(`[Communication:${this.context}] 📨 Received ungrouped emojis changed message`)
        const payload =
          message && typeof message === 'object' && message.payload !== undefined
            ? message.payload
            : message
        handler(payload)
      } catch (error) {
        console.error(
          `[Communication:${this.context}] ❌ Error in ungrouped emojis changed handler:`,
          error,
        )
      }
    })
  }

  // Listen for specific group changes
  onSpecificGroupChanged(
    handler: (data: { groupUUID: string; group: any; timestamp: number }) => void,
  ) {
    console.log(`[Communication:${this.context}] 📡 Registering specific group changed listener`)
    this.on('app:specific-group-changed', (message) => {
      try {
        console.log(`[Communication:${this.context}] 📨 Received specific group changed message`)
        const payload =
          message && typeof message === 'object' && message.payload !== undefined
            ? message.payload
            : message
        handler(payload)
      } catch (error) {
        console.error(
          `[Communication:${this.context}] ❌ Error in specific group changed handler:`,
          error,
        )
      }
    })
  }

  // Enhanced usage recording listener with better validation
  onUsageRecorded(handler: (data: { uuid: string; timestamp: number }) => void) {
    console.log(`[Communication:${this.context}] 📡 Registering usage recorded listener`)
    this.on('app:usage-recorded', (message) => {
      try {
        console.log(`[Communication:${this.context}] 📨 Received usage recorded message:`, message)

        if (message && typeof message === 'object') {
          const payload = message.payload !== undefined ? message.payload : message

          // Validate payload format
          if (payload && typeof payload === 'object' && payload.uuid) {
            handler(payload)
          } else {
            console.warn(
              `[Communication:${this.context}] ⚠️ Invalid usage recorded payload:`,
              payload,
            )
          }
        } else {
          // Handle simple format messages
          if (message && typeof message === 'string') {
            handler({ uuid: message, timestamp: Date.now() })
          } else {
            handler(message)
          }
        }
      } catch (error) {
        console.error(
          `[Communication:${this.context}] ❌ Error handling usage recorded message:`,
          error,
        )
      }
    })
  }

  // Listen for data import completion
  onDataImported(handler: (data: any) => void) {
    console.log(`[Communication:${this.context}] 📡 Registering data imported listener`)
    this.on('app:data-imported', (message) => {
      try {
        console.log(`[Communication:${this.context}] 📨 Received data imported message`)
        const payload =
          message && typeof message === 'object' && message.payload !== undefined
            ? message.payload
            : message
        handler(payload)
      } catch (error) {
        console.error(`[Communication:${this.context}] ❌ Error in data imported handler:`, error)
      }
    })
  }

  // Enhanced sync message listeners with better error handling

  // Listen for common emoji updates (sync message)
  onCommonEmojiUpdated(handler: (commonGroup: EmojiGroup) => void) {
    console.log(`[Communication:${this.context}] 📡 Registering common emoji updated sync listener`)
    this.on('COMMON_EMOJI_UPDATED', (message) => {
      try {
        console.log(
          `[Communication:${this.context}] 📨 Received common emoji updated sync message:`,
          message,
        )

        if (message && typeof message === 'object') {
          const payload = message.payload !== undefined ? message.payload : message

          if (payload && payload.commonGroup) {
            handler(payload.commonGroup)
          } else {
            console.warn(
              `[Communication:${this.context}] ⚠️ Invalid common emoji updated payload:`,
              payload,
            )
          }
        }
      } catch (error) {
        console.error(
          `[Communication:${this.context}] ❌ Error handling common emoji updated:`,
          error,
        )
      }
    })
  }

  // Listen for emoji order changes (sync message)
  onEmojiOrderChanged(handler: (groupUUID: string, updatedOrder: string[]) => void) {
    console.log(`[Communication:${this.context}] 📡 Registering emoji order changed sync listener`)
    this.on('EMOJI_ORDER_CHANGED', (message) => {
      try {
        console.log(
          `[Communication:${this.context}] 📨 Received emoji order changed sync message:`,
          message,
        )

        if (message && typeof message === 'object') {
          const payload = message.payload !== undefined ? message.payload : message

          if (payload && payload.groupUUID && payload.updatedOrder) {
            handler(payload.groupUUID, payload.updatedOrder)
          } else {
            console.warn(
              `[Communication:${this.context}] ⚠️ Invalid emoji order changed payload:`,
              payload,
            )
          }
        }
      } catch (error) {
        console.error(
          `[Communication:${this.context}] ❌ Error handling emoji order changed:`,
          error,
        )
      }
    })
  }

  // Listen for group icon updates (sync message)
  onGroupIconUpdated(handler: (groupUUID: string, iconUrl: string) => void) {
    console.log(`[Communication:${this.context}] 📡 Registering group icon updated sync listener`)
    this.on('GROUP_ICON_UPDATED', (message) => {
      try {
        console.log(
          `[Communication:${this.context}] 📨 Received group icon updated sync message:`,
          message,
        )

        if (message && typeof message === 'object') {
          const payload = message.payload !== undefined ? message.payload : message

          if (payload && payload.groupUUID && payload.iconUrl) {
            handler(payload.groupUUID, payload.iconUrl)
          } else {
            console.warn(
              `[Communication:${this.context}] ⚠️ Invalid group icon updated payload:`,
              payload,
            )
          }
        }
      } catch (error) {
        console.error(
          `[Communication:${this.context}] ❌ Error handling group icon updated:`,
          error,
        )
      }
    })
  }

  // Listen for ungrouped emojis changes (sync message)
  onUngroupedEmojisChangedSync(handler: (ungroupedEmojis: Emoji[]) => void) {
    console.log(
      `[Communication:${this.context}] 📡 Registering ungrouped emojis changed sync listener`,
    )
    this.on('UNGROUPED_EMOJIS_CHANGED', (message) => {
      try {
        console.log(
          `[Communication:${this.context}] 📨 Received ungrouped emojis changed sync message:`,
          message,
        )

        if (message && typeof message === 'object') {
          const payload = message.payload !== undefined ? message.payload : message

          if (payload && payload.ungroupedEmojis) {
            handler(payload.ungroupedEmojis)
          } else {
            console.warn(
              `[Communication:${this.context}] ⚠️ Invalid ungrouped emojis changed payload:`,
              payload,
            )
          }
        }
      } catch (error) {
        console.error(
          `[Communication:${this.context}] ❌ Error handling ungrouped emojis changed:`,
          error,
        )
      }
    })
  }

  // Generic message listener for any message type
  onMessage(messageType: string, callback: (data: any) => void) {
    this.messageListeners.set(messageType, callback)
    console.log(
      `[Communication:${this.context}] 📡 Registered listener for message type: ${messageType}`,
    )

    // Also register with the standard on() method for compatibility
    this.on(messageType, (message) => {
      try {
        const payload = message.payload !== undefined ? message.payload : message
        callback(payload)
      } catch (error) {
        console.error(
          `[Communication:${this.context}] ❌ Error in generic message handler for ${messageType}:`,
          error,
        )
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
