export interface GenerateRequest {
  prompt: string
  aspectRatio: string
  numberOfImages: number
  style?: string
  inputImage?: string // Base64 encoded image for editing
  editMode?: boolean // Whether this is an edit operation
}

export interface GeminiGenerateResponse {
  candidates: Array<{
    images: Array<{
      uri: string
    }>
  }>
}

export interface SiliconFlowGenerateResponse {
  data: Array<{
    url: string
  }>
}

export interface CloudflareGenerateResponse {
  result?: {
    image?: string // Base64 encoded image
  }
  success: boolean
  errors?: Array<{
    message: string
  }>
}

export interface ChutesAIGenerateResponse {
  success: boolean
  data?: {
    url: string
  }
  error?: string
}

export interface ImageProvider {
  name: string
  displayName: string
  generateImages(request: GenerateRequest): Promise<string[]>
  setApiKey(key: string): void
  loadApiKey(): string
}

export interface ProviderConfig {
  name: string
  displayName: string
  placeholder: string
  helpText: string
  helpLink: string
  supportsModels?: boolean
  supportsImageEditing?: boolean
  models?: ModelConfig[]
}

export interface ModelConfig {
  id: string
  name: string
  description?: string
}

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  gemini: {
    name: 'gemini',
    displayName: 'Google Gemini',
    placeholder: '请输入您的 Gemini API Key',
    helpText: '获取 API Key',
    helpLink: 'https://ai.google.dev/gemini-api/docs/api-key',
    supportsImageEditing: true
  },
  siliconflow: {
    name: 'siliconflow',
    displayName: 'SiliconFlow',
    placeholder: '请输入您的 SiliconFlow API Key',
    helpText: '获取 API Key',
    helpLink: 'https://cloud.siliconflow.cn'
  },
  cloudflare: {
    name: 'cloudflare',
    displayName: 'Cloudflare Workers AI',
    placeholder: '请输入 Account ID:API Token (例如: abc123:def456)',
    helpText: '获取凭据',
    helpLink: 'https://dash.cloudflare.com/profile/api-tokens',
    supportsModels: true,
    models: [
      {
        id: '@cf/black-forest-labs/flux-1-schnell',
        name: 'Flux 1 Schnell (快速)'
      },
      {
        id: '@cf/bytedance/stable-diffusion-xl-lightning',
        name: 'Stable Diffusion XL Lightning'
      }
    ]
  },
  chutesai: {
    name: 'chutesai',
    displayName: 'Chutes AI',
    placeholder: '请输入您的 Chutes AI API Token',
    helpText: '获取 API Token',
    helpLink: 'https://chutes.ai',
    supportsModels: true,
    models: [
      {
        id: 'neta-lumina',
        name: 'Neta Lumina'
      },
      {
        id: 'chroma',
        name: 'Chroma'
      },
      {
        id: 'JuggernautXL',
        name: 'JuggernautXL'
      }
    ]
  }
}

export const ASPECT_RATIOS = [
  { value: '1:1', label: '正方形 (1:1)' },
  { value: '16:9', label: '宽屏 (16:9)' },
  { value: '9:16', label: '竖屏 (9:16)' },
  { value: '4:3', label: '标准 (4:3)' },
  { value: '3:4', label: '肖像 (3:4)' }
]

export const ART_STYLES = [
  { value: '', label: '默认' },
  { value: 'realistic', label: '写实风格' },
  { value: 'anime', label: '动漫风格' },
  { value: 'cartoon', label: '卡通风格' },
  { value: 'oil-painting', label: '油画风格' },
  { value: 'watercolor', label: '水彩风格' },
  { value: 'sketch', label: '素描风格' },
  { value: 'digital-art', label: '数字艺术' },
  { value: 'pixel-art', label: '像素艺术' }
]

export const IMAGE_COUNTS = [
  { value: 1, label: '1 张' },
  { value: 2, label: '2 张' },
  { value: 4, label: '4 张' }
]
