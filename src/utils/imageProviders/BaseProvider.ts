import type { ImageProvider, GenerateRequest } from '@/types/imageGenerator';

export abstract class BaseProvider implements ImageProvider {
  abstract name: string;
  abstract displayName: string;
  protected apiKey: string = '';

  abstract generateImages(request: GenerateRequest): Promise<string[]>;

  setApiKey(key: string): void {
    this.apiKey = key;
    localStorage.setItem(`${this.name}_api_key`, key);
  }

  loadApiKey(): string {
    const saved = localStorage.getItem(`${this.name}_api_key`);
    if (saved) {
      this.apiKey = saved;
      return saved;
    }
    return '';
  }

  async downloadImage(url: string, filename: string): Promise<void> {
    try {
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
    } catch (error) {
      console.error('Download failed:', error);
      throw new Error('下载失败，请稍后重试');
    }
  }

  copyToClipboard(url: string): Promise<void> {
    return navigator.clipboard.writeText(url).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
  }

  protected handleApiError(error: any, providerName: string): never {
    console.error(`${providerName} image generation failed:`, error);
    
    if (error.message.includes('401') || error.message.includes('API_KEY_INVALID')) {
      throw new Error('API Key 无效，请检查您的密钥');
    } else if (error.message.includes('429') || error.message.includes('QUOTA_EXCEEDED')) {
      throw new Error('API 请求过于频繁或配额已用完，请稍后重试');
    } else if (error.message.includes('403') || error.message.includes('PERMISSION_DENIED')) {
      throw new Error('权限被拒绝，请检查 API Key 权限设置');
    }
    
    throw error;
  }
}
