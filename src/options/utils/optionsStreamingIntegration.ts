/**
 * 流式处理集成 - 将流式优化集成到 options 中
 */

import { StreamingOptimizer, streamingUtils } from './streamingOptimizer'
import type { EmojiGroup } from '../../types/emoji'

export class OptionsStreamingIntegration {
  private optimizer: StreamingOptimizer

  constructor() {
    this.optimizer = new StreamingOptimizer({
      batchSize: 3, // 每批处理 3 个表情，平衡速度和内存
      chunkSize: 32 * 1024, // 32KB chunks
      maxConcurrency: 2, // 限制并发请求数
      memoryThreshold: 50 // 50MB 内存阈值
    })
  }

  /**
   * 流式批量更新表情尺寸
   */
  async batchUpdateEmojiSizes(
    group: EmojiGroup,
    onProgress?: (progress: {
      current: number
      total: number
      name?: string
      preview?: string
    }) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const emojis = group.emojis || []
    if (emojis.length === 0) return

    const results: Array<{ index: number; width?: number; height?: number }> = []

    // 进度跟踪优化，避免回弹
    let processedCount = 0
    let lastReportedProgress = 0

    // 创建流式图片尺寸处理器
    const processorStream = this.optimizer.createMemoryFriendlyStream(
      emojis,
      async (emoji, index) => {
        if (signal?.aborted) throw new Error('aborted')

        try {
          const url = emoji.url || emoji.displayUrl
          if (!url) {
            processedCount++
            return null
          }

          // 只在真正开始处理时调用预览回调
          onProgress?.({
            current: processedCount + 1,
            total: emojis.length,
            name: emoji.name,
            preview: url
          })

          const dimensions = await this.loadImageDimensions(url, signal)
          if (dimensions) {
            results[index] = { index, ...dimensions }
          }

          processedCount++
          return new Uint8Array([index]) // 简单的进度标记
        } catch (error) {
          console.warn(`Failed to process emoji ${index}:`, error)
          processedCount++
          return null
        }
      },
      progress => {
        // 确保进度只能递增，不会回退
        const currentProgress = Math.max(lastReportedProgress, progress.current)
        if (currentProgress > lastReportedProgress) {
          lastReportedProgress = currentProgress
          onProgress?.({
            current: currentProgress,
            total: progress.total
          })
        }
      }
    )

    // 处理流
    const reader = processorStream.getReader()
    try {
      while (true) {
        const { done } = await reader.read()
        if (done) break
      }
    } finally {
      reader.releaseLock()
    }

    // 将收集的结果更新到 group.emojis 中
    for (const result of results) {
      if (result && result.index >= 0 && result.index < emojis.length) {
        const emoji = emojis[result.index]
        if (result.width !== undefined && result.height !== undefined) {
          emoji.width = result.width
          emoji.height = result.height
        }
      }
    }
  }

  /**
   * 流式导出表情组
   */
  async exportGroupStreaming(
    group: EmojiGroup,
    onProgress?: (progress: {
      current: number
      total: number
      phase: string
      preview?: string
    }) => void,

    signal?: AbortSignal
  ): Promise<void> {
    const emojis = group.emojis || []
    if (emojis.length === 0) return

    try {
      // Phase 1: 创建图片处理流
      onProgress?.({ current: 0, total: emojis.length, phase: 'Preparing export stream' })

      const imageStream = await this.optimizer.processImagesStreaming(
        emojis.map(e => e.url || e.displayUrl || '').filter(Boolean),
        progress => {
          onProgress?.({
            current: progress.current,
            total: progress.total,
            phase: progress.phase
          })
        },
        signal
      )

      // Phase 2: 创建 TAR 流
      onProgress?.({ current: 0, total: emojis.length, phase: 'Creating archive stream' })

      const tarStream = imageStream.pipeThrough(
        streamingUtils.createTransformStream(
          async (imageData: { name: string; data: Uint8Array }) => {
            // 创建 TAR 头部和数据
            const header = this.createTarHeader(imageData.name, imageData.data.byteLength)
            const padding = this.createTarPadding(imageData.data.byteLength)

            // 合并头部、数据和填充
            const combined = new Uint8Array(header.length + imageData.data.length + padding.length)
            combined.set(header, 0)
            combined.set(imageData.data, header.length)
            combined.set(padding, header.length + imageData.data.length)

            return combined
          }
        )
      )

      // Phase 3: 压缩流
      onProgress?.({ current: 0, total: emojis.length, phase: 'Compressing archive' })

      const compressedStream = await this.optimizer.compressStream(tarStream, 'gzip')

      // Phase 4: 下载文件
      onProgress?.({ current: 0, total: emojis.length, phase: 'Downloading file' })

      await this.optimizer.streamToFile(
        compressedStream,
        `emoji-group-${group.id}-${group.name || 'group'}.tar.gz`,
        bytesWritten => {
          onProgress?.({
            current: bytesWritten,
            total: bytesWritten, // 无法预知总大小
            phase: `Downloaded ${(bytesWritten / 1024 / 1024).toFixed(1)}MB`
          })
        }
      )

      onProgress?.({ current: emojis.length, total: emojis.length, phase: 'Export completed' })
    } catch (error) {
      if (signal?.aborted) {
        throw new Error('Export cancelled by user')
      }
      throw error
    }
  }

  /**
   * 加载图片尺寸
   */
  private async loadImageDimensions(
    url: string,
    signal?: AbortSignal
  ): Promise<{ width: number; height: number } | null> {
    return new Promise(resolve => {
      if (signal?.aborted) {
        resolve(null)
        return
      }

      const img = new Image()
      img.crossOrigin = 'anonymous'

      const cleanup = () => {
        img.onload = null
        img.onerror = null
      }

      img.onload = () => {
        cleanup()
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        })
      }

      img.onerror = () => {
        cleanup()
        resolve(null)
      }

      // 超时处理
      const timeout = setTimeout(() => {
        cleanup()
        resolve(null)
      }, 5000)

      img.onload = () => {
        clearTimeout(timeout)
        cleanup()
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        })
      }

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeout)
          cleanup()
          resolve(null)
        })
      }

      img.src = url
    })
  }

  /**
   * 创建 TAR 文件头部
   */
  private createTarHeader(filename: string, size: number): Uint8Array {
    const header = new Uint8Array(512)
    const encoder = new TextEncoder()

    // 文件名 (0-99)
    const nameBytes = encoder.encode(filename)
    header.set(nameBytes.slice(0, Math.min(100, nameBytes.length)), 0)

    // 文件模式 (100-107)
    const mode = '0000644\0'
    header.set(encoder.encode(mode), 100)

    // UID/GID (108-123)
    header.set(encoder.encode('0000000\0'), 108) // uid
    header.set(encoder.encode('0000000\0'), 116) // gid

    // 文件大小 (124-135)
    const sizeOctal = size.toString(8).padStart(11, '0') + '\0'
    header.set(encoder.encode(sizeOctal), 124)

    // 修改时间 (136-147)
    const mtime =
      Math.floor(Date.now() / 1000)
        .toString(8)
        .padStart(11, '0') + '\0'
    header.set(encoder.encode(mtime), 136)

    // 校验和占位符 (148-155)
    header.set(encoder.encode('        '), 148)

    // 文件类型 (156)
    header[156] = 0x30 // '0' for regular file

    // 魔术字符串 (257-262)
    header.set(encoder.encode('ustar'), 257)
    header.set(encoder.encode('00'), 263)

    // 计算校验和
    let checksum = 0
    for (let i = 0; i < 512; i++) {
      checksum += header[i]
    }

    const checksumStr = checksum.toString(8).padStart(6, '0') + '\0 '
    header.set(encoder.encode(checksumStr), 148)

    return header
  }

  /**
   * 创建 TAR 填充
   */
  private createTarPadding(fileSize: number): Uint8Array {
    const remainder = fileSize % 512
    return remainder === 0 ? new Uint8Array(0) : new Uint8Array(512 - remainder)
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.optimizer.dispose()
  }
}

export default OptionsStreamingIntegration
