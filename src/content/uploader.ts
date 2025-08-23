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
  id: string;
  file: File;
  resolve: (value: UploadResponse) => void;
  reject: (error: any) => void;
  retryCount: number;
  status: 'waiting' | 'uploading' | 'failed' | 'success';
  error?: any;
  result?: UploadResponse;
  timestamp: number;
}

class ImageUploader {
  private waitingQueue: UploadQueueItem[] = [];
  private uploadingQueue: UploadQueueItem[] = [];
  private failedQueue: UploadQueueItem[] = [];
  private successQueue: UploadQueueItem[] = [];
  private isProcessing = false;
  private maxRetries = 2; // Second failure stops retry
  private progressDialog: HTMLElement | null = null;

  async uploadImage(file: File): Promise<UploadResponse> {
    return new Promise((resolve, reject) => {
      const item: UploadQueueItem = {
        id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        file,
        resolve,
        reject,
        retryCount: 0,
        status: 'waiting',
        timestamp: Date.now()
      };
      
      this.waitingQueue.push(item);
      this.updateProgressDialog();
      this.processQueue();
    });
  }

  private moveToQueue(item: UploadQueueItem, targetStatus: 'waiting' | 'uploading' | 'failed' | 'success') {
    // Remove from all queues
    this.waitingQueue = this.waitingQueue.filter(i => i.id !== item.id);
    this.uploadingQueue = this.uploadingQueue.filter(i => i.id !== item.id);
    this.failedQueue = this.failedQueue.filter(i => i.id !== item.id);
    this.successQueue = this.successQueue.filter(i => i.id !== item.id);
    
    // Add to target queue
    item.status = targetStatus;
    switch (targetStatus) {
      case 'waiting':
        this.waitingQueue.push(item);
        break;
      case 'uploading':
        this.uploadingQueue.push(item);
        break;
      case 'failed':
        this.failedQueue.push(item);
        break;
      case 'success':
        this.successQueue.push(item);
        break;
    }
    
    this.updateProgressDialog();
  }

  private async processQueue() {
    if (this.isProcessing || this.waitingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.waitingQueue.length > 0) {
      const item = this.waitingQueue.shift()!;
      this.moveToQueue(item, 'uploading');
      
      try {
        const result = await this.performUpload(item.file);
        item.result = result;
        this.moveToQueue(item, 'success');
        item.resolve(result);
        
        // Insert into editor
        const markdown = `![${result.original_filename}](${result.url})`;
        insertIntoEditor(markdown);
        
      } catch (error: any) {
        item.error = error;
        
        if (this.shouldRetry(error, item)) {
          item.retryCount++;
          
          if (error.error_type === 'rate_limit' && error.extras?.wait_seconds) {
            // Wait for rate limit before retry
            await this.sleep(error.extras.wait_seconds * 1000);
          } else {
            // Wait before retry
            await this.sleep(Math.pow(2, item.retryCount) * 1000);
          }
          
          this.moveToQueue(item, 'waiting');
        } else {
          this.moveToQueue(item, 'failed');
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

    // Only retry 429 (rate limit) errors automatically
    return error.error_type === 'rate_limit';
  }
  
  // Method to manually retry failed items
  retryFailedItem(itemId: string) {
    const item = this.failedQueue.find(i => i.id === itemId);
    if (item && item.retryCount < this.maxRetries) {
      item.retryCount++;
      this.moveToQueue(item, 'waiting');
      this.processQueue();
    }
  }

  showProgressDialog() {
    if (this.progressDialog) {
      return; // Already showing
    }
    
    this.progressDialog = this.createProgressDialog();
    document.body.appendChild(this.progressDialog);
  }

  hideProgressDialog() {
    if (this.progressDialog) {
      this.progressDialog.remove();
      this.progressDialog = null;
    }
  }

  private updateProgressDialog() {
    if (!this.progressDialog) {
      return;
    }
    
    const allItems = [
      ...this.waitingQueue,
      ...this.uploadingQueue,
      ...this.failedQueue,
      ...this.successQueue
    ];
    
    this.renderQueueItems(this.progressDialog, allItems);
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
      uploader.showProgressDialog();

      try {
        const promises = Array.from(files).map(async (file) => {
          try {
            const result = await uploader.uploadImage(file);
            return result;
          } catch (error: any) {
            logger.error('[Image Uploader] Upload failed:', error);
            throw error;
          }
        });

        await Promise.allSettled(promises);
        
      } finally {
        setTimeout(() => {
          uploader.hideProgressDialog();
          resolve();
        }, 3000); // Keep dialog open longer to show results
      }
    });

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}

export { uploader };