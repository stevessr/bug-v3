import type { EmojiGroup, emoji } from './types'
import { createDefaultEmojiGroup } from './types'

export function getDefaultEmojis(): EmojiGroup[] {
  const defaultEmojis: emoji[] = [
    { 
      id: 'smile', 
      displayName: '笑脸', 
      realUrl: new URL('https://example.com/smile.png'), 
      displayUrl: new URL('https://example.com/smile.png'), 
      order: 0,
      UUID: 'emoji-1' 
    },
    { 
      id: 'laugh', 
      displayName: '笑哭', 
      realUrl: new URL('https://example.com/laugh.png'), 
      displayUrl: new URL('https://example.com/laugh.png'), 
      order: 1,
      UUID: 'emoji-2' 
    },
    { 
      id: 'heart', 
      displayName: '爱心眼', 
      realUrl: new URL('https://example.com/heart.png'), 
      displayUrl: new URL('https://example.com/heart.png'), 
      order: 2,
      UUID: 'emoji-3' 
    },
    { 
      id: 'cry', 
      displayName: '哭泣', 
      realUrl: new URL('https://example.com/cry.png'), 
      displayUrl: new URL('https://example.com/cry.png'), 
      order: 3,
      UUID: 'emoji-4' 
    },
    { 
      id: 'cool', 
      displayName: '酷', 
      realUrl: new URL('https://example.com/cool.png'), 
      displayUrl: new URL('https://example.com/cool.png'), 
      order: 4,
      UUID: 'emoji-5' 
    },
    { 
      id: 'angry', 
      displayName: '生气', 
      realUrl: new URL('https://example.com/angry.png'), 
      displayUrl: new URL('https://example.com/angry.png'), 
      order: 5,
      UUID: 'emoji-6' 
    },
    { 
      id: 'think', 
      displayName: '思考', 
      realUrl: new URL('https://example.com/think.png'), 
      displayUrl: new URL('https://example.com/think.png'), 
      order: 6,
      UUID: 'emoji-7' 
    },
    { 
      id: 'thumbsup', 
      displayName: '点赞', 
      realUrl: new URL('https://example.com/thumbsup.png'), 
      displayUrl: new URL('https://example.com/thumbsup.png'), 
      order: 7,
      UUID: 'emoji-8' 
    },
    { 
      id: 'thumbsdown', 
      displayName: '踩', 
      realUrl: new URL('https://example.com/thumbsdown.png'), 
      displayUrl: new URL('https://example.com/thumbsdown.png'), 
      order: 8,
      UUID: 'emoji-9' 
    },
    { 
      id: 'love', 
      displayName: '爱心', 
      realUrl: new URL('https://example.com/love.png'), 
      displayUrl: new URL('https://example.com/love.png'), 
      order: 9,
      UUID: 'emoji-10' 
    },
    { 
      id: 'fire', 
      displayName: '火', 
      realUrl: new URL('https://example.com/fire.png'), 
      displayUrl: new URL('https://example.com/fire.png'), 
      order: 10,
      UUID: 'emoji-11' 
    },
    { 
      id: '100', 
      displayName: '100分', 
      realUrl: new URL('https://example.com/100.png'), 
      displayUrl: new URL('https://example.com/100.png'), 
      order: 11,
      UUID: 'emoji-12' 
    }
  ]

  const defaultGroup = createDefaultEmojiGroup()
  defaultGroup.emojis = defaultEmojis
  
  return [defaultGroup]
}