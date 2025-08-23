export interface GenerateRequest {
  prompt: string;
  aspectRatio: string;
  numberOfImages: number;
  style?: string;
  inputImage?: string; // Base64 encoded image for editing
  editMode?: boolean; // Whether this is an edit operation
}

export interface ImageProvider {
  name: string;
  displayName: string;
  generateImages(request: GenerateRequest): Promise<string[]>;
  setApiKey(key: string): void;
  loadApiKey(): string;
}

export interface ModelConfig {
  id: string;
  name: string;
}

export interface ProviderConfig {
  displayName: string;
  placeholder: string;
  helpText: string;
  helpLink: string;
  models?: ModelConfig[];
  supportsModels?: boolean;
  supportsImageEditing?: boolean;
}

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  gemini: {
    displayName: 'Google Gemini',
    placeholder: '请输入您的 Gemini API Key',
    helpText: '获取API Key请访问',
    helpLink: 'https://aistudio.google.com/app/apikey',
    supportsModels: true,
    models: [
      { id: 'imagen-3.0-generate-001', name: 'Imagen 3.0 Generate' },
      { id: 'gemini-2.0-flash-thinking-exp-01-21', name: 'Gemini 2.0 Flash Thinking' },
      { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash' }
    ],
    supportsImageEditing: true
  },
  siliconflow: {
    displayName: 'SiliconFlow',
    placeholder: '请输入您的 SiliconFlow API Key',
    helpText: '获取API Key请访问',
    helpLink: 'https://cloud.siliconflow.cn/',
    supportsModels: true,
    models: [
      { id: 'black-forest-labs/FLUX.1-schnell', name: 'FLUX.1 Schnell' },
      { id: 'stabilityai/stable-diffusion-xl-base-1.0', name: 'Stable Diffusion XL' }
    ]
  },
  cloudflare: {
    displayName: 'Cloudflare AI',
    placeholder: '请输入您的 Cloudflare API Token',
    helpText: '获取API Token请访问',
    helpLink: 'https://dash.cloudflare.com/profile/api-tokens',
    supportsModels: true,
    models: [
      { id: '@cf/bytedance/stable-diffusion-xl-lightning', name: 'Stable Diffusion XL Lightning' }
    ]
  },
  chutesai: {
    displayName: 'ChutesAI',
    placeholder: '请输入您的 ChutesAI API Key',
    helpText: '获取API Key请访问',
    helpLink: 'https://chutesai.com/',
    supportsModels: true,
    models: [
      { id: 'flux-1.1-pro', name: 'FLUX 1.1 Pro' },
      { id: 'flux-1-pro', name: 'FLUX 1 Pro' },
      { id: 'flux-1-dev', name: 'FLUX 1 Dev' },
      { id: 'flux-1-schnell', name: 'FLUX 1 Schnell' }
    ]
  }
};

export const ASPECT_RATIOS = [
  { value: '1:1', label: '1:1 (正方形)' },
  { value: '9:16', label: '9:16 (竖屏)' },
  { value: '16:9', label: '16:9 (横屏)' },
  { value: '4:3', label: '4:3 (标准)' },
  { value: '3:4', label: '3:4 (竖版标准)' }
];

export const ART_STYLES = [
  { value: '', label: '默认' },
  { value: 'photorealistic', label: '写实摄影' },
  { value: 'oil painting', label: '油画' },
  { value: 'watercolor', label: '水彩画' },
  { value: 'digital art', label: '数字艺术' },
  { value: 'anime', label: '动漫风格' },
  { value: 'sketch', label: '素描' },
  { value: 'abstract', label: '抽象艺术' }
];

export const IMAGE_COUNTS = [
  { value: 1, label: '1张' },
  { value: 2, label: '2张' },
  { value: 3, label: '3张' },
  { value: 4, label: '4张' }
];