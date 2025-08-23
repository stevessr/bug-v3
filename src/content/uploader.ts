import { logger } from "./buildFlags";
import { insertEmojiIntoEditor } from "./insert";

// Generic function to insert text into editor
function insertIntoEditor(text: string) {
  const textArea = document.querySelector("textarea.d-editor-input") as HTMLTextAreaElement | null;
  const richEle = document.querySelector(".ProseMirror.d-editor-input") as HTMLElement | null;

  if (!textArea && !richEle) {
    console.error("找不到输入框");
    return;
  }

  if (textArea) {
    const start = textArea.selectionStart;
    const end = textArea.selectionEnd;
    const value = textArea.value;

    textArea.value = value.substring(0, start) + text + value.substring(end);
    textArea.setSelectionRange(start + text.length, start + text.length);
    textArea.focus();

    // Trigger input event to notify any listeners
    const event = new Event('input', { bubbles: true });
    textArea.dispatchEvent(event);
  } else if (richEle) {
    // For rich text editor, insert at current cursor position
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      
      // Move cursor after inserted text
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    richEle.focus();
  }
}

interface UploadResponse {
  id: number;
  url: string;
  original_filename: string;
  filesize: number;
  width: number;
  height: number;
  thumbnail_width: number;
  thumbnail_height: number;
  extension: string;
  short_url: string;
  short_path: string;
  retain_hours: null;
  human_filesize: string;
  dominant_color: string;
  thumbnail: null;
}

interface UploadError {
  errors: string[];
  error_type: string;
  extras?: {
    wait_seconds: number;
    time_left: string;
  };
}

interface UploadQueueItem {
  file: File;
  resolve: (value: UploadResponse) => void;
  reject: (error: any) => void;
  retryCount: number;
}

class ImageUploader {
  private queue: UploadQueueItem[] = [];
  private isProcessing = false;
  private maxRetries = 3;

  async uploadImage(file: File): Promise<UploadResponse> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        file,
        resolve,
        reject,
        retryCount: 0
      });
      this.processQueue();
    });
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      try {
        const result = await this.performUpload(item.file);
        item.resolve(result);
      } catch (error: any) {
        if (this.shouldRetry(error, item)) {
          item.retryCount++;
          this.queue.unshift(item); // Put back at front for retry
          
          if (error.extras?.wait_seconds) {
            // Wait for rate limit
            await this.sleep(error.extras.wait_seconds * 1000);
          } else {
            // Wait before retry
            await this.sleep(Math.pow(2, item.retryCount) * 1000);
          }
        } else {
          item.reject(error);
        }
      }
    }

    this.isProcessing = false;
  }

  private shouldRetry(error: any, item: UploadQueueItem): boolean {
    if (item.retryCount >= this.maxRetries) {
      return false;
    }

    // Retry on rate limits and network errors
    return error.error_type === 'rate_limit' || 
           error.name === 'NetworkError' || 
           error.name === 'TypeError';
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async performUpload(file: File): Promise<UploadResponse> {
    // Calculate SHA1 checksum (simplified - using a placeholder)
    const sha1 = await this.calculateSHA1(file);
    
    // Create form data
    const formData = new FormData();
    formData.append('upload_type', 'composer');
    formData.append('relativePath', 'null');
    formData.append('name', file.name);
    formData.append('type', file.type);
    formData.append('sha1_checksum', sha1);
    formData.append('file', file, file.name);

    // Get CSRF token from meta tag or cookie
    const csrfToken = this.getCSRFToken();
    
    const headers: Record<string, string> = {
      'X-Csrf-Token': csrfToken,
    };

    // Add cookies if available
    if (document.cookie) {
      headers['Cookie'] = document.cookie;
    }

    const response = await fetch(`https://linux.do/uploads.json?client_id=f06cb5577ba9410d94b9faf94e48c2d8`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json() as UploadError;
      throw errorData;
    }

    return await response.json() as UploadResponse;
  }

  private getCSRFToken(): string {
    // Try to get CSRF token from meta tag
    const metaToken = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement;
    if (metaToken) {
      return metaToken.content;
    }

    // Try to get from cookie
    const match = document.cookie.match(/csrf_token=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[1]);
    }

    // Fallback - try to extract from any form
    const hiddenInput = document.querySelector('input[name="authenticity_token"]') as HTMLInputElement;
    if (hiddenInput) {
      return hiddenInput.value;
    }

    logger.warn('[Image Uploader] No CSRF token found');
    return '';
  }

  private async calculateSHA1(file: File): Promise<string> {
    // Simplified SHA1 calculation - in a real implementation, you'd use crypto.subtle
    // For now, return a placeholder based on file properties
    const text = `${file.name}-${file.size}-${file.lastModified}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    
    if (crypto.subtle) {
      try {
        const hashBuffer = await crypto.subtle.digest('SHA-1', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch (e) {
        logger.warn('[Image Uploader] Could not calculate SHA1, using fallback');
      }
    }
    
    // Fallback simple hash
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(40, '0');
  }
}

const uploader = new ImageUploader();

export async function showImageUploadDialog(): Promise<void> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.style.display = 'none';

    input.addEventListener('change', async (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (!files || files.length === 0) {
        resolve();
        return;
      }

      // Show upload progress
      const progressDialog = createProgressDialog(files.length);
      document.body.appendChild(progressDialog);

      try {
        const promises = Array.from(files).map(async (file, index) => {
          try {
            updateProgress(progressDialog, index, 'uploading', file.name);
            const result = await uploader.uploadImage(file);
            updateProgress(progressDialog, index, 'success', file.name);
            
            // Insert into editor
            const markdown = `![${result.original_filename}](${result.url})`;
            insertIntoEditor(markdown);
            
            return result;
          } catch (error: any) {
            updateProgress(progressDialog, index, 'error', file.name, error);
            logger.error('[Image Uploader] Upload failed:', error);
            throw error;
          }
        });

        await Promise.allSettled(promises);
        
      } finally {
        setTimeout(() => {
          progressDialog.remove();
          resolve();
        }, 2000);
      }
    });

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}

function createProgressDialog(fileCount: number): HTMLElement {
  const dialog = document.createElement('div');
  dialog.className = 'image-upload-progress';
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 20px;
    min-width: 300px;
    max-width: 500px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const title = document.createElement('h3');
  title.textContent = `上传图片 (${fileCount} 个文件)`;
  title.style.cssText = 'margin: 0 0 15px 0; font-size: 16px; color: #333;';
  
  const list = document.createElement('div');
  list.className = 'upload-list';
  
  for (let i = 0; i < fileCount; i++) {
    const item = document.createElement('div');
    item.className = `upload-item upload-item-${i}`;
    item.style.cssText = `
      display: flex;
      align-items: center;
      margin-bottom: 8px;
      padding: 8px;
      border-radius: 4px;
      background: #f8f9fa;
    `;
    
    const status = document.createElement('span');
    status.className = 'status';
    status.style.cssText = 'margin-right: 10px; font-size: 16px;';
    status.textContent = '⏳';
    
    const filename = document.createElement('span');
    filename.className = 'filename';
    filename.style.cssText = 'flex: 1; color: #666;';
    filename.textContent = '准备上传...';
    
    item.appendChild(status);
    item.appendChild(filename);
    list.appendChild(item);
  }
  
  dialog.appendChild(title);
  dialog.appendChild(list);
  
  return dialog;
}

function updateProgress(dialog: HTMLElement, index: number, status: 'uploading' | 'success' | 'error', filename: string, error?: any) {
  const item = dialog.querySelector(`.upload-item-${index}`) as HTMLElement;
  if (!item) return;
  
  const statusEl = item.querySelector('.status') as HTMLElement;
  const filenameEl = item.querySelector('.filename') as HTMLElement;
  
  switch (status) {
    case 'uploading':
      statusEl.textContent = '📤';
      filenameEl.textContent = filename;
      item.style.background = '#e3f2fd';
      break;
    case 'success':
      statusEl.textContent = '✅';
      filenameEl.textContent = `${filename} - 上传成功`;
      item.style.background = '#e8f5e8';
      break;
    case 'error':
      statusEl.textContent = '❌';
      const errorMsg = error?.errors?.[0] || error?.message || '上传失败';
      filenameEl.textContent = `${filename} - ${errorMsg}`;
      item.style.background = '#ffebee';
      break;
  }
}

export { uploader };