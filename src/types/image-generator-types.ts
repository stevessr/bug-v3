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