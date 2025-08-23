import { BaseProvider } from './BaseProvider';
import type { GenerateRequest, CloudflareGenerateResponse } from '@/types/imageGenerator';

export class CloudflareProvider extends BaseProvider {
  name = 'cloudflare';
  displayName = 'Cloudflare Workers AI';
  private apiToken: string = '';
  private accountId: string = '';
  private selectedModel: string = '@cf/black-forest-labs/flux-1-schnell';

  setApiKey(key: string): void {
    // For Cloudflare, we expect the key in format: "accountId:apiToken"
    const parts = key.split(':');
    if (parts.length === 2) {
      this.accountId = parts[0];
      this.apiToken = parts[1];
      localStorage.setItem('cloudflare_account_id', this.accountId);
      localStorage.setItem('cloudflare_api_token', this.apiToken);
    } else {
      // Assume it's just the token and account ID is stored separately
      this.apiToken = key;
      localStorage.setItem('cloudflare_api_token', key);
    }
  }

  loadApiKey(): string {
    const savedAccountId = localStorage.getItem('cloudflare_account_id');
    const savedToken = localStorage.getItem('cloudflare_api_token');
    
    if (savedAccountId && savedToken) {
      this.accountId = savedAccountId;
      this.apiToken = savedToken;
      return `${savedAccountId}:${savedToken}`;
    } else if (savedToken) {
      this.apiToken = savedToken;
      return savedToken;
    }
    return '';
  }

  setModel(model: string): void {
    this.selectedModel = model;
    localStorage.setItem('cloudflare_selected_model', model);
  }

  loadSelectedModel(): void {
    const saved = localStorage.getItem('cloudflare_selected_model');
    if (saved) {
      this.selectedModel = saved;
    }
  }

  getSelectedModel(): string {
    return this.selectedModel;
  }

  async generateImages(request: GenerateRequest): Promise<string[]> {
    if (!this.apiToken) {
      throw new Error('请先设置 Cloudflare API Token');
    }

    if (!this.accountId) {
      throw new Error('请先设置 Cloudflare Account ID');
    }

    const apiEndpoint = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${this.selectedModel}`;
    
    let requestBody: any;
    
    if (this.selectedModel === '@cf/black-forest-labs/flux-1-schnell') {
      // Flux model - simpler parameters
      const stylePrompt = request.style ? ` in ${request.style} style` : '';
      const fullPrompt = `${request.prompt}${stylePrompt}, high quality, detailed`;
      
      requestBody = {
        prompt: fullPrompt,
        steps: 4 // Default for flux-schnell
      };
    } else {
      // Stable Diffusion XL Lightning model - more parameters
      const sizeMap: Record<string, { width: number; height: number }> = {
        '1:1': { width: 1024, height: 1024 },
        '16:9': { width: 1344, height: 768 },
        '9:16': { width: 768, height: 1344 },
        '4:3': { width: 1152, height: 896 },
        '3:4': { width: 896, height: 1152 }
      };

      const size = sizeMap[request.aspectRatio] || { width: 1024, height: 1024 };
      const stylePrompt = request.style ? ` in ${request.style} style` : '';
      const fullPrompt = `${request.prompt}${stylePrompt}, high quality, detailed`;

      requestBody = {
        prompt: fullPrompt,
        width: size.width,
        height: size.height,
        num_steps: 20,
        guidance: 7.5
      };
    }

    try {
      const imageUrls: string[] = [];
      
      // Generate multiple images by making multiple requests
      for (let i = 0; i < request.numberOfImages; i++) {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.errors?.[0]?.message || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data: CloudflareGenerateResponse = await response.json();
        
        if (!data.success || !data.result?.image) {
          throw new Error(data.errors?.[0]?.message || '没有生成任何图片，请尝试修改您的描述');
        }

        // Convert base64 to data URL
        const dataUrl = `data:image/png;base64,${data.result.image}`;
        imageUrls.push(dataUrl);
      }

      return imageUrls;
    } catch (error: any) {
      this.handleApiError(error, 'Cloudflare');
    }
  }

  async downloadImage(url: string, filename: string): Promise<void> {
    try {
      // For data URLs, convert to blob directly
      if (url.startsWith('data:')) {
        const response = await fetch(url);
        const blob = await response.blob();
        
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      } else {
        await super.downloadImage(url, filename);
      }
    } catch (error) {
      console.error('Download failed:', error);
      throw new Error('下载失败，请稍后重试');
    }
  }
}
