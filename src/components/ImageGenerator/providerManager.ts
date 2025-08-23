import type { ImageProvider, GenerateRequest } from './types';

// Simple provider manager implementation for the Vue components
export class ProviderManager {
  private currentProvider: string = 'gemini';
  private providers: Map<string, ImageProvider> = new Map();
  private providerModels: Map<string, string> = new Map();

  constructor() {
    this.loadCurrentProvider();
    // Add some mock providers for demo
    this.initializeMockProviders();
  }

  private initializeMockProviders() {
    const createMockProvider = (name: string, displayName: string): ImageProvider => ({
      name,
      displayName,
      generateImages: async (request: GenerateRequest) => {
        return ['mock-image-url.jpg'];
      },
      setApiKey: (key: string) => {
        localStorage.setItem(`${name}_api_key`, key);
      },
      loadApiKey: () => {
        return localStorage.getItem(`${name}_api_key`) || '';
      }
    });
    
    this.providers.set('gemini', createMockProvider('gemini', 'Google Gemini'));
    this.providers.set('siliconflow', createMockProvider('siliconflow', 'SiliconFlow'));
    this.providers.set('cloudflare', createMockProvider('cloudflare', 'Cloudflare AI'));
    this.providers.set('chutesai', createMockProvider('chutesai', 'ChutesAI'));
  }

  addProvider(provider: ImageProvider) {
    this.providers.set(provider.name, provider);
  }

  getCurrentProviderName(): string {
    return this.currentProvider;
  }

  getCurrentProvider(): ImageProvider {
    const provider = this.providers.get(this.currentProvider);
    if (!provider) {
      throw new Error(`Provider ${this.currentProvider} not found`);
    }
    return provider;
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

  // Model management methods
  setProviderModel(providerName: string, modelId: string) {
    this.providerModels.set(providerName, modelId);
    localStorage.setItem(`${providerName}_selected_model`, modelId);
  }

  getProviderModel(providerName: string): string | undefined {
    return this.providerModels.get(providerName);
  }

  loadProviderModel(providerName: string) {
    const savedModel = localStorage.getItem(`${providerName}_selected_model`);
    if (savedModel) {
      this.providerModels.set(providerName, savedModel);
    }
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