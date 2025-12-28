/**
 * 流式处理优化器 - 内存友好的大数据处理
 */

interface StreamingConfig {
  batchSize?: number
  chunkSize?: number
  maxConcurrency?: number
  memoryThreshold?: number // MB
}

interface ProgressCallback {
  (progress: { current: number; total: number; phase: string }): void
}

export class StreamingOptimizer {
  private config: Required<StreamingConfig>
  private activeStreams = new Set<ReadableStreamDefaultController>()
  private memoryUsage = 0

  constructor(config: StreamingConfig = {}) {
    this.config = {
      batchSize: config.batchSize ?? 5,
      chunkSize: config.chunkSize ?? 64 * 1024, // 64KB chunks
      maxConcurrency: config.maxConcurrency ?? 3,
      memoryThreshold: config.memoryThreshold ?? 100 // 100MB
    }
  }

  /**
   * 创建内存友好的读取流
   */
  createMemoryFriendlyStream<T>(
    items: T[],
    processor: (item: T, index: number) => Promise<Uint8Array | null>,
    onProgress?: ProgressCallback
  ): ReadableStream<Uint8Array> {
    let processedCount = 0
    let currentBatch = 0

    // Capture context
    const config = this.config
    const activeStreams = this.activeStreams
    let memoryUsage = this.memoryUsage
    const waitForMemoryRelease = this.waitForMemoryRelease.bind(this)

    return new ReadableStream({
      async start(controller) {
        activeStreams.add(controller)

        try {
          const totalBatches = Math.ceil(items.length / config.batchSize)

          for (let i = 0; i < items.length; i += config.batchSize) {
            // Check memory usage
            if (memoryUsage > config.memoryThreshold * 1024 * 1024) {
              await waitForMemoryRelease()
            }

            const batch = items.slice(i, Math.min(i + config.batchSize, items.length))

            // Process batch with concurrency control
            const semaphore = new Semaphore(config.maxConcurrency)
            const batchResults = await Promise.allSettled(
              batch.map(async (item, batchIndex) => {
                await semaphore.acquire()
                try {
                  const actualIndex = i + batchIndex
                  const result = await processor(item, actualIndex)
                  processedCount++

                  onProgress?.({
                    current: processedCount,
                    total: items.length,
                    phase: `Processing batch ${currentBatch + 1}/${totalBatches}`
                  })

                  return result
                } finally {
                  semaphore.release()
                }
              })
            )

            // Enqueue successful results
            for (const result of batchResults) {
              if (result.status === 'fulfilled' && result.value) {
                memoryUsage += result.value.byteLength
                controller.enqueue(result.value)

                // Yield control to prevent blocking
                await new Promise(resolve => setTimeout(resolve, 0))
              }
            }

            currentBatch++

            // Periodic garbage collection hint
            if (currentBatch % 10 === 0 && typeof (globalThis as any).gc === 'function') {
              ;(globalThis as any).gc()
            }
          }
        } catch (error) {
          controller.error(error)
        } finally {
          activeStreams.delete(controller)
          controller.close()
        }
      },

      cancel(_reason) {
        // Controller will be removed when start() completes
      }
    })
  }

  /**
   * 流式图片处理
   */
  async processImagesStreaming(
    imageUrls: string[],
    onProgress?: ProgressCallback,
    signal?: AbortSignal
  ): Promise<ReadableStream<{ name: string; data: Uint8Array }>> {
    const config = this.config
    const getExtension = this.getExtensionFromUrl

    return new ReadableStream({
      async start(controller) {
        let processedCount = 0

        try {
          for (let i = 0; i < imageUrls.length; i += config.batchSize) {
            if (signal?.aborted) {
              throw new Error('Operation aborted')
            }

            const batch = imageUrls.slice(i, Math.min(i + config.batchSize, imageUrls.length))

            const batchPromises = batch.map(async (url, batchIndex) => {
              try {
                const response = await fetch(url, { signal })
                if (!response.ok) return null

                const blob = await response.blob()
                const arrayBuffer = await blob.arrayBuffer()
                const data = new Uint8Array(arrayBuffer)

                processedCount++
                onProgress?.({
                  current: processedCount,
                  total: imageUrls.length,
                  phase: 'Fetching images'
                })

                return {
                  name: `image-${i + batchIndex}.${getExtension(url)}`,
                  data
                }
              } catch (error) {
                console.warn(`Failed to fetch image ${url}:`, error)
                return null
              }
            })

            const results = await Promise.allSettled(batchPromises)

            for (const result of results) {
              if (result.status === 'fulfilled' && result.value) {
                controller.enqueue(result.value)
              }
            }

            // Memory management
            if (processedCount % (config.batchSize * 2) === 0) {
              await new Promise(resolve => setTimeout(resolve, 16)) // ~60fps
            }
          }
        } catch (error) {
          controller.error(error)
        } finally {
          controller.close()
        }
      }
    })
  }

  /**
   * 流式压缩处理
   */
  async compressStream(
    inputStream: ReadableStream<Uint8Array>,
    format: 'gzip' | 'deflate' = 'gzip'
  ): Promise<ReadableStream<Uint8Array>> {
    if (typeof CompressionStream === 'undefined') {
      throw new Error('CompressionStream not supported')
    }

    // Type assertion needed because CompressionStream uses BufferSource which is broader than Uint8Array
    return inputStream.pipeThrough(
      new CompressionStream(format) as ReadableWritablePair<Uint8Array, Uint8Array>
    )
  }

  /**
   * 分块写入文件
   */
  async streamToFile(
    stream: ReadableStream<Uint8Array>,
    filename: string,
    onProgress?: (bytesWritten: number) => void
  ): Promise<void> {
    const chunks: Uint8Array[] = []
    let totalBytes = 0

    const reader = stream.getReader()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        chunks.push(value)
        totalBytes += value.byteLength
        onProgress?.(totalBytes)

        // Prevent excessive memory buildup
        if (chunks.length > 100) {
          const intermediateBlob = new Blob(chunks as BlobPart[])
          chunks.length = 0
          chunks.push(new Uint8Array(await intermediateBlob.arrayBuffer()))
        }
      }
    } finally {
      reader.releaseLock()
    }

    // Create final blob and download
    const finalBlob = new Blob(chunks as BlobPart[])
    const url = URL.createObjectURL(finalBlob)

    try {
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  /**
   * 等待内存释放
   */
  private async waitForMemoryRelease(): Promise<void> {
    return new Promise(resolve => {
      const checkMemory = () => {
        if (this.memoryUsage < this.config.memoryThreshold * 1024 * 1024 * 0.8) {
          resolve()
        } else {
          // Force garbage collection if available
          if (typeof (globalThis as any).gc === 'function') {
            ;(globalThis as any).gc()
          }
          setTimeout(checkMemory, 100)
        }
      }
      checkMemory()
    })
  }

  /**
   * 获取URL扩展名
   */
  private getExtensionFromUrl(url: string): string {
    const match = url.match(/\.([a-zA-Z0-9]{1,5})(?:\?|$)/)
    return match ? match[1] : 'png'
  }

  /**
   * 清理资源
   */
  dispose(): void {
    // Close all active streams
    for (const controller of this.activeStreams) {
      try {
        controller.close()
      } catch {
        // Ignore errors when closing
      }
    }
    this.activeStreams.clear()
    this.memoryUsage = 0
  }
}

/**
 * 信号量 - 控制并发数
 */
class Semaphore {
  private permits: number
  private waitQueue: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return
    }

    return new Promise<void>(resolve => {
      this.waitQueue.push(resolve)
    })
  }

  release(): void {
    if (this.waitQueue.length > 0) {
      const resolve = this.waitQueue.shift()
      if (resolve) {
        resolve()
      }
    } else {
      this.permits++
    }
  }
}

/**
 * 流式处理工具函数
 */
export const streamingUtils = {
  /**
   * 创建转换流
   */
  createTransformStream<T, U>(transformer: (chunk: T) => U | Promise<U>): TransformStream<T, U> {
    return new TransformStream({
      async transform(chunk, controller) {
        try {
          const result = await transformer(chunk)
          controller.enqueue(result)
        } catch (error) {
          controller.error(error)
        }
      }
    })
  },

  /**
   * 批处理流
   */
  createBatchStream<T>(batchSize: number): TransformStream<T, T[]> {
    let batch: T[] = []

    return new TransformStream({
      transform(chunk, controller) {
        batch.push(chunk)
        if (batch.length >= batchSize) {
          controller.enqueue([...batch])
          batch = []
        }
      },

      flush(controller) {
        if (batch.length > 0) {
          controller.enqueue(batch)
        }
      }
    })
  },

  /**
   * 节流流 - 控制处理速率
   */
  createThrottledStream<T>(delayMs: number): TransformStream<T, T> {
    let lastEmit = 0

    return new TransformStream({
      async transform(chunk, controller) {
        const now = Date.now()
        const elapsed = now - lastEmit

        if (elapsed < delayMs) {
          await new Promise(resolve => setTimeout(resolve, delayMs - elapsed))
        }

        controller.enqueue(chunk)
        lastEmit = Date.now()
      }
    })
  }
}

export default StreamingOptimizer
