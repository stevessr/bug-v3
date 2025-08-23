import type { ImageProvider, GenerateRequest } from './types';

// Simple provider manager implementation for the Vue components
export class ProviderManager {
  private currentProvider: string = 'gemini';
  private providers: Map<string, ImageProvider> = new Map();

  constructor() {
    this.loadCurrentProvider();
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