/**
 * WebAssembly Perceptual Hash Service
 * High-performance hash calculation using WASM
 * Note: This is a placeholder implementation that falls back to JavaScript
 * Actual WASM compilation requires Emscripten toolchain setup
 */

export interface WASMHashResult {
  hash: string
  error: boolean
  errorMessage?: string
}

class WASMHashService {
  private isInitialized = false
  private wasmAvailable = false

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    // Check if WASM is supported
    this.wasmAvailable = typeof WebAssembly === 'object' && WebAssembly.validate

    if (this.wasmAvailable) {
      console.log('[WASMHashService] WASM support detected, but module not compiled')
      console.log('[WASMHashService] Falling back to JavaScript implementation')
    } else {
      console.log('[WASMHashService] WASM not supported, using JavaScript implementation')
    }

    this.isInitialized = true
  }

  async calculateHash(imageData: ImageData, hashSize: number = 16): Promise<WASMHashResult> {
    await this.initialize()

    try {
      // Fallback to JavaScript implementation
      const hash = this.calculateHashFromImageData(imageData, hashSize)
      return {
        hash,
        error: false
      }
    } catch (error) {
      return {
        hash: '',
        error: true,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  async calculateBatchHashes(
    imageDataList: ImageData[],
    hashSize: number = 16
  ): Promise<WASMHashResult[]> {
    await this.initialize()

    const results: WASMHashResult[] = []

    for (const imageData of imageDataList) {
      const result = await this.calculateHash(imageData, hashSize)
      results.push(result)
    }

    return results
  }

  calculateHammingDistance(hash1: string, hash2: string): number {
    if (!hash1 || !hash2) return -1

    const len1 = hash1.length
    const len2 = hash2.length

    if (len1 !== len2) return -1

    let distance = 0
    for (let i = 0; i < len1; i++) {
      if (hash1[i] !== hash2[i]) {
        distance++
      }
    }

    return distance
  }

  private calculateHashFromImageData(imageData: ImageData, hashSize: number): string {
    const { data, width, height } = imageData

    // Convert to grayscale and resize if needed
    const grayData = new Uint8Array(hashSize * hashSize)
    const xStep = width / hashSize
    const yStep = height / hashSize

    for (let y = 0; y < hashSize; y++) {
      for (let x = 0; x < hashSize; x++) {
        const srcX = Math.floor(x * xStep)
        const srcY = Math.floor(y * yStep)
        const srcIndex = (srcY * width + srcX) * 4

        const r = data[srcIndex]
        const g = data[srcIndex + 1]
        const b = data[srcIndex + 2]
        grayData[y * hashSize + x] = (r + g + b) / 3
      }
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

  isSupported(): boolean {
    return this.wasmAvailable
  }

  async cleanup(): Promise<void> {
    this.isInitialized = false
  }
}

export const wasmHashService = new WASMHashService()
export type { WASMHashResult }