import type { ImageProvider, GenerateRequest } from './types';

// Simple provider manager implementation for the Vue components
export class ProviderManager {
  private currentProvider: string = 'gemini';
  private providers: Map<string, ImageProvider> = new Map();

  constructor() {
    this.loadCurrentProvider();
    // Add some mock providers for demo
    this.initializeMockProviders();
  }

  private initializeMockProviders() {
    const mockProvider: ImageProvider = {
      name: 'gemini',
      displayName: 'Google Gemini',
      generateImages: async (request: GenerateRequest) => {
        return ['mock-image-url.jpg'];
      },
      setApiKey: (key: string) => {
        localStorage.setItem('gemini_api_key', key);
      },
      loadApiKey: () => {
        return localStorage.getItem('gemini_api_key') || '';
      }
    };
    
    this.providers.set('gemini', mockProvider);
    this.providers.set('siliconflow', { ...mockProvider, name: 'siliconflow', displayName: 'SiliconFlow' });
    this.providers.set('cloudflare', { ...mockProvider, name: 'cloudflare', displayName: 'Cloudflare AI' });
    this.providers.set('chutesai', { ...mockProvider, name: 'chutesai', displayName: 'ChutesAI' });
  }

  addProvider(provider: ImageProvider) {
    this.providers.set(provider.name, provider);
  }

  getCurrentProviderName(): string {
    return this.currentProvider;
  }

  getCurrentProvider(): ImageProvider | undefined {
    return this.providers.get(this.currentProvider);
  }

  setCurrentProvider(name: string) {
    if (this.providers.has(name)) {
      this.currentProvider = name;
      this.saveCurrentProvider();
    }
  }

  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  supportsImageEditing(): boolean {
    return this.currentProvider === 'gemini';
  }

  private saveCurrentProvider() {
    localStorage.setItem('selected_provider', this.currentProvider);
  }

  private loadCurrentProvider() {
    const saved = localStorage.getItem('selected_provider');
    if (saved) {
      this.currentProvider = saved;
    }
  }
}

// Create a global instance
export const providerManager = new ProviderManager();