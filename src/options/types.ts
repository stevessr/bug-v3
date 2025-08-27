import type { OpenRouterMessage } from '../services/openrouter'

export interface ChatMessage extends OpenRouterMessage {
  timestamp: Date
  images?: {
    type: 'image_url'
    image_url: {
      url: string
    }
  }[]
}
