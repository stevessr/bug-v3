/**
 * Optimized Perceptual Hash Service
 * Enhanced with IndexedDB caching and batch processing
 */

import { imageCacheService } from './imageCacheService'

export interface HashCalculationOptions {
  useCache?: boolean
  batchSize?: number
  quality?: 'low' | 'medium' | 'high'
  onProgress?: (processed: number, total: number) => void
}

export interface BatchHashResult {
  url: string
  hash: string
  cached: boolean
  error?: string
}

export class OptimizedHashService {
  private readonly HASH_SIZE = {
    low: 8,
    medium: 16,
    high: 32
  }

  private readonly WORKER_COUNT = navigator.hardwareConcurrency || 4
  private workers: Worker[] = []
  private workerReady: boolean[] = []

  async initializeWorkers(): Promise<void> {
    if (this.workers.length > 0) return

    const workerCode = `
      self.onmessage = function(e) {
        const { imageData, size, url } = e.data

        try {
          const hash = calculateHashFromImageData(imageData, size)
          self.postMessage({ success: true, url, hash })
        } catch (error) {
          self.postMessage({ success: false, url, error: error.message })
        }
      }

      function calculateHashFromImageData(imageData, size) {
        const data = imageData.data
        const width = imageData.width
        const height = imageData.height

        // Convert to grayscale and resize if needed
        const grayData = new Uint8Array(size * size)
        const xStep = width / size
        const yStep = height / size

        for (let y = 0; y < size; y++) {
          for (let x = 0; x < size; x++) {
            const srcX = Math.floor(x * xStep)
            const srcY = Math.floor(y * yStep)
            const srcIndex = (srcY * width + srcX) * 4

            const r = data[srcIndex]
            const g = data[srcIndex + 1]
            const b = data[srcIndex + 2]
            grayData[y * size + x] = (r + g + b) / 3
          }
        }

        // Calculate average
        let sum = 0
        for (let i = 0; i < grayData.length; i++) {
          sum += grayData[i]
        }
        const average = sum / grayData.length

        // Generate hash
        let hash = ''
        for (let i = 0; i < grayData.length; i++) {
          hash += grayData[i] > average ? '1' : '0'
        }

        // Convert to hex
        let hexHash = ''
        for (let i = 0; i < hash.length; i += 4) {
          const chunk = hash.slice(i, i + 4)
          hexHash += parseInt(chunk, 2).toString(16)
        }

        return hexHash
      }
    `

    const blob = new Blob([workerCode], { type: 'application/javascript' })
    const workerUrl = URL.createObjectURL(blob)

    for (let i = 0; i < this.WORKER_COUNT; i++) {
      const worker = new Worker(workerUrl)
      this.workers.push(worker)
      this.workerReady.push(true)
    }
  }

  async calculateHash(
    url: string,
    options: HashCalculationOptions = {}
  ): Promise<string> {
    const { useCache = true, quality = 'medium' } = options

    // Check cache first
    if (useCache) {
      const cachedHash = await imageCacheService.getHash(url)
      if (cachedHash) {
        return cachedHash
      }
    }

    // Try to get cached image
    let imageBlob = await imageCacheService.getImage(url)

    if (!imageBlob) {
      // Fetch and cache the image
      imageBlob = await this.fetchImage(url)
      if (imageBlob) {
        await imageCacheService.cacheImage(url, imageBlob)
      }
    }

    if (!imageBlob) {
      throw new Error(`Failed to load image: ${url}`)
    }

    // Calculate hash
    const hash = await this.calculateHashFromBlob(imageBlob, quality)

    // Cache the hash
    if (useCache) {
      await imageCacheService.updateHash(url, hash)
    }

    return hash
  }

  async calculateBatchHashes(
    urls: string[],
    options: HashCalculationOptions = {}
  ): Promise<BatchHashResult[]> {
    const {
      useCache = true,
      batchSize = 10,
      quality = 'medium',
      onProgress
    } = options

    await this.initializeWorkers()

    const results: BatchHashResult[] = []
    const toProcess: string[] = []

    // Check cache first
    for (const url of urls) {
      if (useCache) {
        const cachedHash = await imageCacheService.getHash(url)
        if (cachedHash) {
          results.push({ url, hash: cachedHash, cached: true })
          onProgress?.(results.length, urls.length)
          continue
        }
      }
      toProcess.push(url)
    }

    // Process remaining URLs in batches
    for (let i = 0; i < toProcess.length; i += batchSize) {
      const batch = toProcess.slice(i, i + batchSize)
      const batchResults = await this.processBatch(batch, quality)
      results.push(...batchResults)

      onProgress?.(results.length, urls.length)
    }

    return results
  }

  private async processBatch(urls: string[], quality: string): Promise<BatchHashResult[]> {
    const size = this.HASH_SIZE[quality as keyof typeof this.HASH_SIZE]
    const results: BatchHashResult[] = []

    // Fetch images in parallel
    const imagePromises = urls.map(async (url) => {
      let blob = await imageCacheService.getImage(url)

      if (!blob) {
        blob = await this.fetchImage(url)
        if (blob) {
          await imageCacheService.cacheImage(url, blob)
        }
      }

      return { url, blob }
    })

    const images = await Promise.all(imagePromises)

    // Process images with workers
    const workerPromises = images.map(async ({ url, blob }) => {
      if (!blob) {
        return { url, hash: '', cached: false, error: 'Failed to fetch image' }
      }

      try {
        const hash = await this.calculateHashFromBlob(blob, quality)

        // Cache the hash
        await imageCacheService.updateHash(url, hash)

        return { url, hash, cached: false }
      } catch (error) {
        return {
          url,
          hash: '',
          cached: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    })

    return Promise.all(workerPromises)
  }

  private async calculateHashFromBlob(blob: Blob, quality: string): Promise<string> {
    const size = this.HASH_SIZE[quality as keyof typeof this.HASH_SIZE]

    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = size
          canvas.height = size

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Failed to get canvas context'))
            return
          }

          // Draw and resize image
          ctx.drawImage(img, 0, 0, size, size)
          const imageData = ctx.getImageData(0, 0, size, size)

          const hash = this.calculateHashFromImageData(imageData, size)
          resolve(hash)
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(blob)
    })
  }

  private calculateHashFromImageData(imageData: ImageData, size: number): string {
    const data = imageData.data

    // Convert to grayscale
    const grayData = new Uint8Array(size * size)
    for (let i = 0; i < size * size; i++) {
      const pixelIndex = i * 4
      const r = data[pixelIndex]
      const g = data[pixelIndex + 1]
      const b = data[pixelIndex + 2]
      grayData[i] = (r + g + b) / 3
    }

    // Calculate average
    const sum = grayData.reduce((acc, val) => acc + val, 0)
    const average = sum / grayData.length

    // Generate hash
    let hash = ''
    for (let i = 0; i < grayData.length; i++) {
      hash += grayData[i] > average ? '1' : '0'
    }

    // Convert to hex
    let hexHash = ''
    for (let i = 0; i < hash.length; i += 4) {
      const chunk = hash.slice(i, i + 4)
      hexHash += parseInt(chunk, 2).toString(16)
    }

    return hexHash
  }

  private async fetchImage(url: string): Promise<Blob | null> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.blob()
    } catch (error) {
      console.error('Failed to fetch image:', url, error)
      return null
    }
  }

  async findDuplicates(
    urls: string[],
    threshold: number = 10,
    options: HashCalculationOptions = {}
  ): Promise<Array<{ url: string; duplicates: string[] }>> {
    const hashResults = await this.calculateBatchHashes(urls, options)

    // Group by hash similarity
    const hashMap = new Map<string, string[]>()

    for (const result of hashResults) {
      if (result.error) continue

      const existingHashes = Array.from(hashMap.keys())
      let foundSimilar = false

      for (const existingHash of existingHashes) {
        if (this.hammingDistance(result.hash, existingHash) <= threshold) {
          hashMap.get(existingHash)!.push(result.url)
          foundSimilar = true
          break
        }
      }

      if (!foundSimilar) {
        hashMap.set(result.hash, [result.url])
      }
    }

    // Convert to duplicates format
    const duplicates = Array.from(hashMap.values())
      .filter(group => group.length > 1)
      .map(group => ({
        url: group[0],
        duplicates: group.slice(1)
      }))

    return duplicates
  }

  private hammingDistance(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) return Infinity

    let distance = 0
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) distance++
    }
    return distance
  }

  async cleanup(): Promise<void> {
    // Terminate workers
    for (const worker of this.workers) {
      worker.terminate()
    }
    this.workers = []
    this.workerReady = []
  }

  getCacheStats() {
    return imageCacheService.getStats()
  }
}

export const optimizedHashService = new OptimizedHashService()