// Shared types for options components and composables
export type ImgBedUploadChannel = 'telegram' | 'cfr2' | 's3'
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
