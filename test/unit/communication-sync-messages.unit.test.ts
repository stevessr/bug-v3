import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { 
  SyncMessage, 
  SyncMessagePayload, 
  EmojiGroup, 
  Emoji 
} from '../../src/services/communication'

describe('Communication Sync Messages', () => {
  describe('SyncMessage Interface', () => {
    it('should accept COMMON_EMOJI_UPDATED message type', () => {
      const commonGroup: EmojiGroup = {
        UUID: 'common-emoji-group',
        id: 'common-emoji-group',
        displayName: '常用',
        icon: '⭐',
        order: 0,
        emojis: []
      }

      const message: SyncMessage = {
        type: 'COMMON_EMOJI_UPDATED',
        payload: {
          commonGroup,
          timestamp: Date.now()
        },
        from: 'background',
        timestamp: Date.now()
      }

      expect(message.type).toBe('COMMON_EMOJI_UPDATED')
      expect(message.payload.commonGroup).toBeDefined()
      expect(message.payload.commonGroup?.UUID).toBe('common-emoji-group')
    })

    it('should accept EMOJI_ORDER_CHANGED message type', () => {
      const message: SyncMessage = {
        type: 'EMOJI_ORDER_CHANGED',
        payload: {
          groupUUID: 'test-group-uuid',
          updatedOrder: ['emoji1', 'emoji2', 'emoji3'],
          timestamp: Date.now()
        },
        from: 'options',
        timestamp: Date.now()
      }

      expect(message.type).toBe('EMOJI_ORDER_CHANGED')
      expect(message.payload.groupUUID).toBe('test-group-uuid')
      expect(message.payload.updatedOrder).toHaveLength(3)
    })

    it('should accept GROUP_ICON_UPDATED message type', () => {
      const message: SyncMessage = {
        type: 'GROUP_ICON_UPDATED',
        payload: {
          groupUUID: 'test-group-uuid',
          iconUrl: 'https://example.com/icon.png',
          timestamp: Date.now()
        },
        from: 'options',
        timestamp: Date.now()
      }

      expect(message.type).toBe('GROUP_ICON_UPDATED')
      expect(message.payload.groupUUID).toBe('test-group-uuid')
      expect(message.payload.iconUrl).toBe('https://example.com/icon.png')
    })

    it('should accept UNGROUPED_EMOJIS_CHANGED message type', () => {
      const ungroupedEmojis: Emoji[] = [
        {
          UUID: 'emoji1',
          displayName: 'Test Emoji 1',
          url: 'https://example.com/emoji1.png'
        },
        {
          UUID: 'emoji2',
          displayName: 'Test Emoji 2',
          url: 'https://example.com/emoji2.png'
        }
      ]

      const message: SyncMessage = {
        type: 'UNGROUPED_EMOJIS_CHANGED',
        payload: {
          ungroupedEmojis,
          timestamp: Date.now()
        },
        from: 'background',
        timestamp: Date.now()
      }

      expect(message.type).toBe('UNGROUPED_EMOJIS_CHANGED')
      expect(message.payload.ungroupedEmojis).toHaveLength(2)
      expect(message.payload.ungroupedEmojis?.[0].UUID).toBe('emoji1')
    })
  })

  describe('SyncMessagePayload Interface', () => {
    it('should validate payload structure for common emoji updates', () => {
      const payload: SyncMessagePayload = {
        commonGroup: {
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
        },
        timestamp: Date.now()
      }

      expect(payload.commonGroup).toBeDefined()
      expect(payload.commonGroup?.emojis).toHaveLength(1)
      expect(payload.timestamp).toBeTypeOf('number')
    })

    it('should validate payload structure for order changes', () => {
      const payload: SyncMessagePayload = {
        groupUUID: 'test-group',
        updatedOrder: ['emoji1', 'emoji2', 'emoji3'],
        timestamp: Date.now()
      }

      expect(payload.groupUUID).toBe('test-group')
      expect(payload.updatedOrder).toBeInstanceOf(Array)
      expect(payload.updatedOrder).toHaveLength(3)
    })

    it('should validate payload structure for icon updates', () => {
      const payload: SyncMessagePayload = {
        groupUUID: 'test-group',
        iconUrl: 'https://example.com/new-icon.png',
        timestamp: Date.now()
      }

      expect(payload.groupUUID).toBe('test-group')
      expect(payload.iconUrl).toMatch(/^https?:\/\//)
    })

    it('should validate payload structure for ungrouped emojis', () => {
      const payload: SyncMessagePayload = {
        ungroupedEmojis: [
          {
            UUID: 'ungrouped1',
            displayName: 'Ungrouped Emoji 1'
          },
          {
            UUID: 'ungrouped2',
            displayName: 'Ungrouped Emoji 2',
            url: 'https://example.com/emoji.png'
          }
        ],
        timestamp: Date.now()
      }

      expect(payload.ungroupedEmojis).toHaveLength(2)
      expect(payload.ungroupedEmojis?.[0].UUID).toBe('ungrouped1')
      expect(payload.ungroupedEmojis?.[1].url).toBeDefined()
    })
  })

  describe('EmojiGroup Interface', () => {
    it('should validate emoji group structure', () => {
      const group: EmojiGroup = {
        UUID: 'test-group-uuid',
        id: 'test-group-id',
        displayName: 'Test Group',
        icon: '🎉',
        order: 1,
        emojis: [
          {
            UUID: 'emoji1',
            displayName: 'Test Emoji',
            url: 'https://example.com/emoji.png',
            usageCount: 3,
            lastUsed: Date.now(),
            groupUUID: 'test-group-uuid'
          }
        ],
        originalId: 'original-test-group'
      }

      expect(group.UUID).toBe('test-group-uuid')
      expect(group.displayName).toBe('Test Group')
      expect(group.emojis).toHaveLength(1)
      expect(group.emojis[0].groupUUID).toBe('test-group-uuid')
    })
  })

  describe('Emoji Interface', () => {
    it('should validate emoji structure with all optional fields', () => {
      const emoji: Emoji = {
        UUID: 'test-emoji-uuid',
        displayName: 'Test Emoji',
        url: 'https://example.com/emoji.png',
        usageCount: 10,
        lastUsed: Date.now(),
        groupUUID: 'parent-group-uuid'
      }

      expect(emoji.UUID).toBe('test-emoji-uuid')
      expect(emoji.displayName).toBe('Test Emoji')
      expect(emoji.usageCount).toBe(10)
      expect(emoji.lastUsed).toBeTypeOf('number')
      expect(emoji.groupUUID).toBe('parent-group-uuid')
    })

    it('should validate emoji structure with minimal required fields', () => {
      const emoji: Emoji = {
        UUID: 'minimal-emoji',
        displayName: 'Minimal Emoji'
      }

      expect(emoji.UUID).toBe('minimal-emoji')
      expect(emoji.displayName).toBe('Minimal Emoji')
      expect(emoji.url).toBeUndefined()
      expect(emoji.usageCount).toBeUndefined()
    })
  })

  describe('Message Type Validation', () => {
    it('should validate that new sync message types are properly typed', () => {
      // Test that the new message types can be used in type-safe way
      const messageTypes: Array<SyncMessage['type']> = [
        'COMMON_EMOJI_UPDATED',
        'EMOJI_ORDER_CHANGED', 
        'GROUP_ICON_UPDATED',
        'UNGROUPED_EMOJIS_CHANGED'
      ]

      expect(messageTypes).toHaveLength(4)
      expect(messageTypes).toContain('COMMON_EMOJI_UPDATED')
      expect(messageTypes).toContain('EMOJI_ORDER_CHANGED')
      expect(messageTypes).toContain('GROUP_ICON_UPDATED')
      expect(messageTypes).toContain('UNGROUPED_EMOJIS_CHANGED')
    })

    it('should validate sync message payload structure', () => {
      const payload: SyncMessagePayload = {
        timestamp: Date.now()
      }

      // Should be able to add any of the optional fields
      payload.commonGroup = {
        UUID: 'test',
        id: 'test',
        displayName: 'Test',
        icon: '🎉',
        order: 0,
        emojis: []
      }

      payload.groupUUID = 'test-group'
      payload.updatedOrder = ['emoji1', 'emoji2']
      payload.iconUrl = 'https://example.com/icon.png'
      payload.ungroupedEmojis = []

      expect(payload.timestamp).toBeTypeOf('number')
      expect(payload.commonGroup).toBeDefined()
      expect(payload.groupUUID).toBe('test-group')
      expect(payload.updatedOrder).toHaveLength(2)
      expect(payload.iconUrl).toMatch(/^https?:\/\//)
      expect(payload.ungroupedEmojis).toBeInstanceOf(Array)
    })
  })
})