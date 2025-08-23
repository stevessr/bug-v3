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

export interface ProviderConfig {
  displayName: string;
  models?: string[];
  supportsImageEditing?: boolean;
}

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  gemini: {
    displayName: 'Google Gemini',
    models: ['imagen-3.0-generate-001'],
    supportsImageEditing: true
  },
  siliconflow: {
    displayName: 'SiliconFlow',
    models: ['black-forest-labs/FLUX.1-schnell', 'stabilityai/stable-diffusion-xl-base-1.0']
  },
  cloudflare: {
    displayName: 'Cloudflare AI',
    models: ['@cf/bytedance/stable-diffusion-xl-lightning']
  },
  chutesai: {
    displayName: 'ChutesAI',
    models: ['flux-1.1-pro', 'flux-1-pro', 'flux-1-dev', 'flux-1-schnell']
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