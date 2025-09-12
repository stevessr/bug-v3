import type { CanvasImageResponse } from '../types'
import { CONSTANTS } from '../config'
import { logger, retry } from '../utils'

/**
 * 图片处理相关工具函数
 */

// 通过Canvas获取图片Blob
export async function getImageViaCanvas(url: string): Promise<CanvasImageResponse> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          resolve({ success: false, error: new Error('无法获取2D上下文') })
          return
        }

        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        ctx.drawImage(img, 0, 0)

        // 尝试转换为Blob
        canvas.toBlob(blob => {
          if (blob) {
            resolve({ success: true, blob })
          } else {
            // 如果toBlob失败，尝试通过DataURL
            tryDataUrlMethod(canvas, resolve)
          }
        })
      } catch (error) {
        resolve({ success: false, error })
      }
    }

    img.onerror = () => {
      resolve({ success: false, error: new Error('图片加载失败') })
    }

    img.src = url
  })
}

// 通过DataURL方法获取Blob
async function tryDataUrlMethod(
  canvas: HTMLCanvasElement,
  resolve: (value: CanvasImageResponse) => void
): Promise<void> {
  try {
    const dataUrl = canvas.toDataURL()
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    resolve({ success: true, blob })
  } catch (error) {
    resolve({ success: false, error })
  }
}

// 直接通过fetch获取图片
export async function getImageViaFetch(url: string): Promise<CanvasImageResponse> {
  try {
    logger.debug('尝试直接获取图片:', url)

    const response = await fetch(url, {
      method: 'GET',
      ...CONSTANTS.FETCH_CONFIG
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const blob = await response.blob()
    logger.debug('直接获取图片成功:', { size: blob.size, type: blob.type })

    return { success: true, blob }
  } catch (error) {
    logger.warn('直接获取图片失败:', error)
    return { success: false, error }
  }
}

// 获取图片的多种尝试方法
export async function getImageBlob(url: string): Promise<CanvasImageResponse> {
  // 首先尝试Canvas方法
  const canvasResult = await getImageViaCanvas(url)
  if (canvasResult.success) {
    logger.debug('Canvas方法获取图片成功')
    return canvasResult
  }

  logger.warn('Canvas方法失败，尝试直接fetch')

  // 如果Canvas失败，尝试直接fetch
  return await getImageViaFetch(url)
}

// 验证图片blob是否有效
export function validateImageBlob(blob: Blob): boolean {
  if (!blob || blob.size === 0) {
    return false
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  return validTypes.includes(blob.type)
}

// 获取图片尺寸
export function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height
      })
    }
    img.onerror = () => reject(new Error('无法加载图片'))
    img.src = url
  })
}
