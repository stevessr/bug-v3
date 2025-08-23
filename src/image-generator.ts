interface GeminiGenerateRequest {
  prompt: string;
  aspectRatio: string;
  numberOfImages: number;
  style?: string;
}

interface GeminiGenerateResponse {
  candidates: Array<{
    images: Array<{
      uri: string;
    }>;
  }>;
}

class ImageGenerator {
  private apiKey: string = '';
  private apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImage';

  setApiKey(key: string) {
    this.apiKey = key;
    // Save to localStorage for convenience
    localStorage.setItem('gemini_api_key', key);
  }

  loadApiKey() {
    const saved = localStorage.getItem('gemini_api_key');
    if (saved) {
      this.apiKey = saved;
      return saved;
    }
    return '';
  }

  async generateImages(request: GeminiGenerateRequest): Promise<string[]> {
    if (!this.apiKey) {
      throw new Error('请先设置 API Key');
    }

    const stylePrompt = request.style ? ` in ${request.style} style` : '';
    const fullPrompt = `${request.prompt}${stylePrompt}, aspect ratio ${request.aspectRatio}, high quality, detailed`;

    const requestBody = {
      prompt: {
        text: fullPrompt
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_LOW_AND_ABOVE"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH", 
          threshold: "BLOCK_LOW_AND_ABOVE"
        }
      ],
      generationConfig: {
        number: request.numberOfImages
      }
    };

    try {
      const response = await fetch(`${this.apiEndpoint}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: GeminiGenerateResponse = await response.json();
      
      if (!data.candidates || data.candidates.length === 0) {
        throw new Error('没有生成任何图片，请尝试修改您的描述');
      }

      const imageUrls: string[] = [];
      for (const candidate of data.candidates) {
        if (candidate.images) {
          for (const image of candidate.images) {
            imageUrls.push(image.uri);
          }
        }
      }

      if (imageUrls.length === 0) {
        throw new Error('生成的图片无法获取，请稍后重试');
      }

      return imageUrls;
    } catch (error: any) {
      console.error('Image generation failed:', error);
      if (error.message.includes('API_KEY_INVALID')) {
        throw new Error('API Key 无效，请检查您的密钥');
      } else if (error.message.includes('QUOTA_EXCEEDED')) {
        throw new Error('API 配额已用完，请稍后重试或检查计费设置');
      } else if (error.message.includes('PERMISSION_DENIED')) {
        throw new Error('权限被拒绝，请检查 API Key 权限设置');
      }
      throw error;
    }
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
}

// Initialize the application
const generator = new ImageGenerator();

document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
  const promptInput = document.getElementById('prompt') as HTMLTextAreaElement;
  const imageCountSelect = document.getElementById('imageCount') as HTMLSelectElement;
  const aspectRatioSelect = document.getElementById('aspectRatio') as HTMLSelectElement;
  const styleSelect = document.getElementById('style') as HTMLSelectElement;
  const generateBtn = document.getElementById('generateBtn') as HTMLButtonElement;
  const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;
  const loading = document.getElementById('loading') as HTMLElement;
  const error = document.getElementById('error') as HTMLElement;
  const results = document.getElementById('results') as HTMLElement;
  const imageGrid = document.getElementById('imageGrid') as HTMLElement;

  // Load saved API key
  const savedApiKey = generator.loadApiKey();
  if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
  }

  // Save API key when user types
  apiKeyInput.addEventListener('input', (e) => {
    const key = (e.target as HTMLInputElement).value.trim();
    if (key) {
      generator.setApiKey(key);
    }
  });

  generateBtn.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showError('请先输入 API Key');
      return;
    }

    if (!prompt) {
      showError('请输入图片描述');
      return;
    }

    // Update API key
    generator.setApiKey(apiKey);

    const request: GeminiGenerateRequest = {
      prompt,
      aspectRatio: aspectRatioSelect.value,
      numberOfImages: parseInt(imageCountSelect.value),
      style: styleSelect.value || undefined,
    };

    try {
      showLoading(true);
      hideError();
      hideResults();

      const imageUrls = await generator.generateImages(request);
      displayResults(imageUrls, prompt);
    } catch (err: any) {
      showError(err.message);
    } finally {
      showLoading(false);
    }
  });

  clearBtn.addEventListener('click', () => {
    hideResults();
    hideError();
    imageGrid.innerHTML = '';
  });

  function showLoading(show: boolean) {
    if (show) {
      loading.classList.add('show');
      generateBtn.disabled = true;
    } else {
      loading.classList.remove('show');
      generateBtn.disabled = false;
    }
  }

  function showError(message: string) {
    error.textContent = message;
    error.style.display = 'block';
  }

  function hideError() {
    error.style.display = 'none';
  }

  function hideResults() {
    results.classList.remove('show');
  }

  function displayResults(imageUrls: string[], prompt: string) {
    imageGrid.innerHTML = '';
    
    imageUrls.forEach((url, index) => {
      const item = document.createElement('div');
      item.className = 'image-item';
      
      const img = document.createElement('img');
      img.src = url;
      img.alt = `Generated image ${index + 1}`;
      img.onerror = () => {
        img.style.display = 'none';
        const errorText = document.createElement('div');
        errorText.textContent = '图片加载失败';
        errorText.style.padding = '50px 20px';
        errorText.style.textAlign = 'center';
        errorText.style.color = '#999';
        item.appendChild(errorText);
      };
      
      const actions = document.createElement('div');
      actions.className = 'image-actions';
      
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'btn btn-primary';
      downloadBtn.style.marginRight = '10px';
      downloadBtn.style.fontSize = '14px';
      downloadBtn.style.padding = '8px 16px';
      downloadBtn.textContent = '📥 下载';
      downloadBtn.onclick = async () => {
        try {
          const filename = `ai-generated-${Date.now()}-${index + 1}.png`;
          await generator.downloadImage(url, filename);
        } catch (err: any) {
          showError(err.message);
        }
      };
      
      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn btn-secondary';
      copyBtn.style.fontSize = '14px';
      copyBtn.style.padding = '8px 16px';
      copyBtn.textContent = '📋 复制链接';
      copyBtn.onclick = async () => {
        try {
          await generator.copyToClipboard(url);
          copyBtn.textContent = '✅ 已复制';
          setTimeout(() => {
            copyBtn.textContent = '📋 复制链接';
          }, 2000);
        } catch (err) {
          showError('复制失败');
        }
      };
      
      actions.appendChild(downloadBtn);
      actions.appendChild(copyBtn);
      
      item.appendChild(img);
      item.appendChild(actions);
      imageGrid.appendChild(item);
    });
    
    results.classList.add('show');
  }

  // Add sample prompts for user convenience
  const samplePrompts = [
    "一只可爱的橘猫坐在樱花树下，阳光透过花瓣洒在地面上",
    "未来城市的霓虹夜景，飞行汽车穿梭在摩天大楼之间", 
    "一座古老的图书馆，书架高耸入云，魔法书本在空中飞舞",
    "宁静的湖泊，倒映着雪山和晚霞，一只白鹤在湖面飞翔",
    "机器人在花园里浇花，周围开满五彩缤纷的花朵"
  ];

  // Add quick prompt buttons
  const promptSuggestions = document.createElement('div');
  promptSuggestions.style.marginTop = '10px';
  promptSuggestions.innerHTML = '<small style="color: #666;">快速示例：</small>';
  
  samplePrompts.forEach(prompt => {
    const btn = document.createElement('button');
    btn.style.cssText = `
      margin: 5px 5px 0 0;
      padding: 4px 8px;
      background: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      color: #6c757d;
    `;
    btn.textContent = prompt.substring(0, 20) + '...';
    btn.onclick = () => {
      promptInput.value = prompt;
    };
    promptSuggestions.appendChild(btn);
  });
  
  promptInput.parentElement?.appendChild(promptSuggestions);
});