import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import CommunicationService, { 
  type EmojiGroup, 
  type Emoji,
  type SyncMessagePayload 
} from '../../src/services/communication'

describe('CommunicationService Enhanced Methods', () => {
  let communicationService: CommunicationService
  let mockChrome: any
  let originalChrome: any

  beforeEach(() => {
    // Save original chrome object
    originalChrome = (global as any).chrome

    // Mock Chrome API
    mockChrome = {
      runtime: {
        onMessage: {
          addListener: vi.fn(),
          removeListener: vi.fn()
        },
        sendMessage: vi.fn(),
        lastError: null
      }
    }

    // Set global chrome
    ;(global as any).chrome = mockChrome

    // Mock window methods
    global.window = {
      ...global.window,
      addEventListener: vi.fn(),
      postMessage: vi.fn(),
      dispatchEvent: vi.fn()
    } as any

    // Mock console methods
    global.console = {
      ...global.console,
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }

    communicationService = new CommunicationService('test-context')
  })

  afterEach(() => {
    // Restore original chrome
    ;(global as any).chrome = originalChrome
    vi.clearAllMocks()
  })

  describe('Enhanced Sending Methods', () => {
    describe('sendCommonEmojiUpdated', () => {
      it('should send common emoji updated message with correct payload', () => {
        const commonGroup: EmojiGroup = {
          UUID: 'common-emoji-group',
          id: 'common-emoji-group',
          displayName: '常用',
          icon: '⭐',
          order: 0,
          emojis: [
            {
              UUID: 'emoji1',
              displayName: 'Test Emoji',
              usageCount: 5,
              lastUsed: Date.now()
            }
          ]
        }

        const sendSpy = vi.spyOn(communicationService, 'send')
        
        communicationService.sendCommonEmojiUpdated(commonGroup)

        expect(sendSpy).toHaveBeenCalledWith('COMMON_EMOJI_UPDATED', {
          commonGroup,
          timestamp: expect.any(Number)
        })
        expect(console.log).toHaveBeenCalledWith(
          '[Communication:test-context] Sending common emoji updated:',
          expect.objectContaining({
            commonGroup,
            timestamp: expect.any(Number)
          })
        )
      })

      it('should handle errors when sending common emoji updated message', () => {
        const commonGroup: EmojiGroup = {
          UUID: 'test-group',
          id: 'test-group',
          displayName: 'Test',
          icon: '🎉',
          order: 0,
          emojis: []
        }

        const sendSpy = vi.spyOn(communicationService, 'send').mockImplementation(() => {
          throw new Error('Send failed')
        })

        communicationService.sendCommonEmojiUpdated(commonGroup)

        expect(sendSpy).toHaveBeenCalled()
        expect(console.error).toHaveBeenCalledWith(
          '[Communication:test-context] Failed to send common emoji updated:',
          expect.any(Error)
        )
      })
    })

    describe('sendEmojiOrderChanged', () => {
      it('should send emoji order changed message with correct payload', () => {
        const groupUUID = 'test-group-uuid'
        const updatedOrder = ['emoji1', 'emoji2', 'emoji3']

        const sendSpy = vi.spyOn(communicationService, 'send')
        
        communicationService.sendEmojiOrderChanged(groupUUID, updatedOrder)

        expect(sendSpy).toHaveBeenCalledWith('EMOJI_ORDER_CHANGED', {
          groupUUID,
          updatedOrder,
          timestamp: expect.any(Number)
        })
        expect(console.log).toHaveBeenCalledWith(
          '[Communication:test-context] Sending emoji order changed:',
          expect.objectContaining({
            groupUUID,
            updatedOrder,
            timestamp: expect.any(Number)
          })
        )
      })

      it('should handle errors when sending emoji order changed message', () => {
        const sendSpy = vi.spyOn(communicationService, 'send').mockImplementation(() => {
          throw new Error('Send failed')
        })

        communicationService.sendEmojiOrderChanged('test-group', ['emoji1'])

        expect(sendSpy).toHaveBeenCalled()
        expect(console.error).toHaveBeenCalledWith(
          '[Communication:test-context] Failed to send emoji order changed:',
          expect.any(Error)
        )
      })
    })

    describe('sendGroupIconUpdated', () => {
      it('should send group icon updated message with correct payload', () => {
        const groupUUID = 'test-group-uuid'
        const iconUrl = 'https://example.com/icon.png'

        const sendSpy = vi.spyOn(communicationService, 'send')
        
        communicationService.sendGroupIconUpdated(groupUUID, iconUrl)

        expect(sendSpy).toHaveBeenCalledWith('GROUP_ICON_UPDATED', {
          groupUUID,
          iconUrl,
          timestamp: expect.any(Number)
        })
        expect(console.log).toHaveBeenCalledWith(
          '[Communication:test-context] Sending group icon updated:',
          expect.objectContaining({
            groupUUID,
            iconUrl,
            timestamp: expect.any(Number)
          })
        )
      })

      it('should handle errors when sending group icon updated message', () => {
        const sendSpy = vi.spyOn(communicationService, 'send').mockImplementation(() => {
          throw new Error('Send failed')
        })

        communicationService.sendGroupIconUpdated('test-group', 'icon.png')

        expect(sendSpy).toHaveBeenCalled()
        expect(console.error).toHaveBeenCalledWith(
          '[Communication:test-context] Failed to send group icon updated:',
          expect.any(Error)
        )
      })
    })

    describe('sendUngroupedEmojisChangedSync', () => {
      it('should send ungrouped emojis changed message with correct payload', () => {
        const ungroupedEmojis: Emoji[] = [
          {
            UUID: 'emoji1',
            displayName: 'Ungrouped Emoji 1',
            url: 'https://example.com/emoji1.png'
          },
          {
            UUID: 'emoji2',
            displayName: 'Ungrouped Emoji 2',
            url: 'https://example.com/emoji2.png'
          }
        ]

        const sendSpy = vi.spyOn(communicationService, 'send')
        
        communicationService.sendUngroupedEmojisChangedSync(ungroupedEmojis)

        expect(sendSpy).toHaveBeenCalledWith('UNGROUPED_EMOJIS_CHANGED', {
          ungroupedEmojis,
          timestamp: expect.any(Number)
        })
        expect(console.log).toHaveBeenCalledWith(
          '[Communication:test-context] Sending ungrouped emojis changed:',
          expect.objectContaining({
            ungroupedEmojis,
            timestamp: expect.any(Number)
          })
        )
      })

      it('should handle errors when sending ungrouped emojis changed message', () => {
        const sendSpy = vi.spyOn(communicationService, 'send').mockImplementation(() => {
          throw new Error('Send failed')
        })

        communicationService.sendUngroupedEmojisChangedSync([])

        expect(sendSpy).toHaveBeenCalled()
        expect(console.error).toHaveBeenCalledWith(
          '[Communication:test-context] Failed to send ungrouped emojis changed:',
          expect.any(Error)
        )
      })
    })
  })

  describe('Enhanced Listening Methods', () => {
    describe('onCommonEmojiUpdated', () => {
      it('should handle common emoji updated messages correctly', () => {
        const handler = vi.fn()
        const commonGroup: EmojiGroup = {
          UUID: 'common-group',
          id: 'common-group',
          displayName: '常用',
          icon: '⭐',
          order: 0,
          emojis: []
        }

        communicationService.onCommonEmojiUpdated(handler)

        // Simulate receiving a message
        const message = {
          type: 'COMMON_EMOJI_UPDATED',
          payload: {
            commonGroup,
            timestamp: Date.now()
          },
          from: 'other-context'
        }

        // Get the registered handler and call it
        const onSpy = vi.spyOn(communicationService, 'on')
        communicationService.onCommonEmojiUpdated(handler)
        
        // Simulate the message handler being called
        const registeredHandler = onSpy.mock.calls[0][1]
        registeredHandler(message)

        expect(console.log).toHaveBeenCalledWith(
          '[Communication:test-context] Received common emoji updated:',
          message
        )
        expect(handler).toHaveBeenCalledWith(commonGroup)
      })

      it('should handle invalid common emoji updated messages', () => {
        const handler = vi.fn()
        communicationService.onCommonEmojiUpdated(handler)

        const onSpy = vi.spyOn(communicationService, 'on')
        communicationService.onCommonEmojiUpdated(handler)
        
        const registeredHandler = onSpy.mock.calls[0][1]
        
        // Test with invalid payload
        registeredHandler({
          type: 'COMMON_EMOJI_UPDATED',
          payload: { invalidField: 'test' },
          from: 'other-context'
        })

        expect(console.warn).toHaveBeenCalledWith(
          '[Communication:test-context] Invalid common emoji updated payload:',
          { invalidField: 'test' }
        )
        expect(handler).not.toHaveBeenCalled()
      })

      it('should handle errors in common emoji updated handler', () => {
        const handler = vi.fn().mockImplementation(() => {
          throw new Error('Handler error')
        })

        const onSpy = vi.spyOn(communicationService, 'on')
        communicationService.onCommonEmojiUpdated(handler)
        
        const registeredHandler = onSpy.mock.calls[0][1]
        
        registeredHandler({
          type: 'COMMON_EMOJI_UPDATED',
          payload: {
            commonGroup: {
              UUID: 'test',
              id: 'test',
              displayName: 'Test',
              icon: '🎉',
              order: 0,
              emojis: []
            },
            timestamp: Date.now()
          },
          from: 'other-context'
        })

        expect(console.error).toHaveBeenCalledWith(
          '[Communication:test-context] Error handling common emoji updated:',
          expect.any(Error)
        )
      })
    })

    describe('onEmojiOrderChanged', () => {
      it('should handle emoji order changed messages correctly', () => {
        const handler = vi.fn()
        const groupUUID = 'test-group'
        const updatedOrder = ['emoji1', 'emoji2', 'emoji3']

        const onSpy = vi.spyOn(communicationService, 'on')
        communicationService.onEmojiOrderChanged(handler)

        const registeredHandler = onSpy.mock.calls[0][1]
        registeredHandler({
          type: 'EMOJI_ORDER_CHANGED',
          payload: {
            groupUUID,
            updatedOrder,
            timestamp: Date.now()
          },
          from: 'other-context'
        })

        expect(handler).toHaveBeenCalledWith(groupUUID, updatedOrder)
      })

      it('should handle invalid emoji order changed messages', () => {
        const handler = vi.fn()
        const onSpy = vi.spyOn(communicationService, 'on')
        communicationService.onEmojiOrderChanged(handler)

        const registeredHandler = onSpy.mock.calls[0][1]
        registeredHandler({
          type: 'EMOJI_ORDER_CHANGED',
          payload: { invalidField: 'test' },
          from: 'other-context'
        })

        expect(console.warn).toHaveBeenCalledWith(
          '[Communication:test-context] Invalid emoji order changed payload:',
          { invalidField: 'test' }
        )
        expect(handler).not.toHaveBeenCalled()
      })
    })

    describe('onGroupIconUpdated', () => {
      it('should handle group icon updated messages correctly', () => {
        const handler = vi.fn()
        const groupUUID = 'test-group'
        const iconUrl = 'https://example.com/icon.png'

        const onSpy = vi.spyOn(communicationService, 'on')
        communicationService.onGroupIconUpdated(handler)

        const registeredHandler = onSpy.mock.calls[0][1]
        registeredHandler({
          type: 'GROUP_ICON_UPDATED',
          payload: {
            groupUUID,
            iconUrl,
            timestamp: Date.now()
          },
          from: 'other-context'
        })

        expect(handler).toHaveBeenCalledWith(groupUUID, iconUrl)
      })

      it('should handle invalid group icon updated messages', () => {
        const handler = vi.fn()
        const onSpy = vi.spyOn(communicationService, 'on')
        communicationService.onGroupIconUpdated(handler)

        const registeredHandler = onSpy.mock.calls[0][1]
        registeredHandler({
          type: 'GROUP_ICON_UPDATED',
          payload: { invalidField: 'test' },
          from: 'other-context'
        })

        expect(console.warn).toHaveBeenCalledWith(
          '[Communication:test-context] Invalid group icon updated payload:',
          { invalidField: 'test' }
        )
        expect(handler).not.toHaveBeenCalled()
      })
    })

    describe('onUngroupedEmojisChangedSync', () => {
      it('should handle ungrouped emojis changed messages correctly', () => {
        const handler = vi.fn()
        const ungroupedEmojis: Emoji[] = [
          { UUID: 'emoji1', displayName: 'Emoji 1' },
          { UUID: 'emoji2', displayName: 'Emoji 2' }
        ]

        const onSpy = vi.spyOn(communicationService, 'on')
        communicationService.onUngroupedEmojisChangedSync(handler)

        const registeredHandler = onSpy.mock.calls[0][1]
        registeredHandler({
          type: 'UNGROUPED_EMOJIS_CHANGED',
          payload: {
            ungroupedEmojis,
            timestamp: Date.now()
          },
          from: 'other-context'
        })

        expect(handler).toHaveBeenCalledWith(ungroupedEmojis)
      })

      it('should handle invalid ungrouped emojis changed messages', () => {
        const handler = vi.fn()
        const onSpy = vi.spyOn(communicationService, 'on')
        communicationService.onUngroupedEmojisChangedSync(handler)

        const registeredHandler = onSpy.mock.calls[0][1]
        registeredHandler({
          type: 'UNGROUPED_EMOJIS_CHANGED',
          payload: { invalidField: 'test' },
          from: 'other-context'
        })

        expect(console.warn).toHaveBeenCalledWith(
          '[Communication:test-context] Invalid ungrouped emojis changed payload:',
          { invalidField: 'test' }
        )
        expect(handler).not.toHaveBeenCalled()
      })
    })
  })

  describe('Message Serialization and Error Handling', () => {
    it('should handle serialization errors gracefully in send methods', () => {
      // Create a circular reference that will cause JSON.stringify to fail
      const circularGroup: any = {
        UUID: 'test',
        id: 'test',
        displayName: 'Test',
        icon: '🎉',
        order: 0,
        emojis: []
      }
      circularGroup.self = circularGroup

      // Mock the send method to simulate serialization issues
      const originalSend = communicationService.send
      communicationService.send = vi.fn().mockImplementation(() => {
        throw new Error('Serialization failed')
      })

      communicationService.sendCommonEmojiUpdated(circularGroup)

      expect(console.error).toHaveBeenCalledWith(
        '[Communication:test-context] Failed to send common emoji updated:',
        expect.any(Error)
      )

      // Restore original send method
      communicationService.send = originalSend
    })

    it('should validate message payload structure', () => {
      const handler = vi.fn()
      const onSpy = vi.spyOn(communicationService, 'on')
      
      communicationService.onCommonEmojiUpdated(handler)
      const registeredHandler = onSpy.mock.calls[0][1]

      // Test with null message
      registeredHandler(null)
      expect(handler).not.toHaveBeenCalled()

      // Test with undefined message
      registeredHandler(undefined)
      expect(handler).not.toHaveBeenCalled()

      // Test with string message
      registeredHandler('invalid message')
      expect(handler).not.toHaveBeenCalled()

      // Test with number message
      registeredHandler(123)
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('Context Isolation', () => {
    it('should properly identify message context', () => {
      const handler = vi.fn()
      const onSpy = vi.spyOn(communicationService, 'on')
      
      communicationService.onCommonEmojiUpdated(handler)
      const registeredHandler = onSpy.mock.calls[0][1]

      // Message from same context should be ignored by the base 'on' method
      // but our enhanced methods should still process them for testing
      const messageFromSameContext = {
        type: 'COMMON_EMOJI_UPDATED',
        payload: {
          commonGroup: {
            UUID: 'test',
            id: 'test',
            displayName: 'Test',
            icon: '🎉',
            order: 0,
            emojis: []
          },
          timestamp: Date.now()
        },
        from: 'test-context'
      }

      registeredHandler(messageFromSameContext)
      
      // The handler should still be called in our test environment
      // In real usage, the base 'on' method would filter out same-context messages
      expect(console.log).toHaveBeenCalledWith(
        '[Communication:test-context] Received common emoji updated:',
        messageFromSameContext
      )
    })
  })

  describe('Timestamp Validation', () => {
    it('should include valid timestamps in all sent messages', () => {
      const sendSpy = vi.spyOn(communicationService, 'send')
      const beforeTime = Date.now()

      communicationService.sendCommonEmojiUpdated({
        UUID: 'test',
        id: 'test',
        displayName: 'Test',
        icon: '🎉',
        order: 0,
        emojis: []
      })

      const afterTime = Date.now()
      const callArgs = sendSpy.mock.calls[0]
      const payload = callArgs[1] as SyncMessagePayload

      expect(payload.timestamp).toBeGreaterThanOrEqual(beforeTime)
      expect(payload.timestamp).toBeLessThanOrEqual(afterTime)
      expect(typeof payload.timestamp).toBe('number')
    })
  })
})