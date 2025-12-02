/**
 * WebAssembly Perceptual Hash Service
 * High-performance hash calculation using WASM
 */

export interface WASMHashResult {
  hash: string
  error: boolean
  errorMessage?: string
}

// Emscripten Module Interface
interface EmscriptenModule {
  cwrap: (ident: string, returnType: string | null, argTypes: string[]) => any
  _malloc: (size: number) => number
  _free: (ptr: number) => void
  HEAPU8: Uint8Array
  HEAP32: Int32Array
}

declare global {
  interface Window {
    PerceptualHashModule: (config: any) => Promise<EmscriptenModule>
  }
}

class WASMHashService {
  private module: EmscriptenModule | null = null
  private isInitialized = false
  private wasmAvailable = false

  // WASM functions
  private _calculate_perceptual_hash: any = null
  private _calculate_batch_hashes: any = null
  private _calculate_hamming_distance: any = null
  private _free_hash_result: any = null
  private _free_batch_results: any = null

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    // Check if WASM is supported
    this.wasmAvailable = typeof WebAssembly === 'object' && typeof WebAssembly.validate === 'function'

    if (!this.wasmAvailable) {
      console.warn('[WASMHashService] WASM not supported')
      return
    }

    try {
      // Load the Emscripten generated JS file
      await this.loadScript()

      // Initialize the module
      if (typeof window.PerceptualHashModule === 'function') {
        const wasmUrl = chrome.runtime.getURL('dist/wasm/perceptual_hash.wasm')

        this.module = await window.PerceptualHashModule({
          locateFile: (path: string) => {
            if (path.endsWith('.wasm')) {
              return wasmUrl
            }
            return path
          }
        })

        // Bind functions
        this._calculate_perceptual_hash = this.module.cwrap('calculate_perceptual_hash', 'number', ['number', 'number', 'number', 'number'])
        this._calculate_batch_hashes = this.module.cwrap('calculate_batch_hashes', 'number', ['number', 'number', 'number', 'number', 'number'])
        this._calculate_hamming_distance = this.module.cwrap('calculate_hamming_distance', 'number', ['string', 'string'])
        this._free_hash_result = this.module.cwrap('free_hash_result', 'void', ['number'])
        this._free_batch_results = this.module.cwrap('free_batch_results', 'void', ['number', 'number'])

        console.log('[WASMHashService] WASM module initialized successfully')
        this.isInitialized = true
      } else {
        console.error('[WASMHashService] PerceptualHashModule not found')
        this.wasmAvailable = false
      }
    } catch (error) {
      console.error('[WASMHashService] Initialization failed:', error)
      this.wasmAvailable = false
    }
  }

  private loadScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if script is already loaded
      if (window.PerceptualHashModule) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = chrome.runtime.getURL('dist/wasm/perceptual_hash.js')
      script.onload = () => resolve()
      script.onerror = (e) => reject(new Error(`Failed to load WASM script: ${e}`))
      document.head.appendChild(script)
    })
  }

  async calculateHash(imageData: ImageData, hashSize: number = 16): Promise<WASMHashResult> {
    await this.initialize()

    if (!this.wasmAvailable || !this.module) {
      return this.fallbackCalculateHash(imageData, hashSize)
    }

    try {
      const { data, width, height } = imageData
      const dataSize = data.length

      // Allocate memory for image data
      const dataPtr = this.module._malloc(dataSize)
      this.module.HEAPU8.set(data, dataPtr)

      // Call WASM function
      const resultPtr = this._calculate_perceptual_hash(dataPtr, width, height, hashSize)

      // Free input memory
      this.module._free(dataPtr)

      // Read result
      const hashPtr = this.module.HEAP32[resultPtr / 4]
      const error = this.module.HEAP32[resultPtr / 4 + 1]
      const errorMsgPtr = this.module.HEAP32[resultPtr / 4 + 2]

      let result: WASMHashResult

      if (error === 0) {
        // Read string from memory (assuming UTF8/ASCII)
        const hash = this.readString(hashPtr)
        result = { hash, error: false }
      } else {
        const errorMessage = this.readString(errorMsgPtr)
        result = { hash: '', error: true, errorMessage }
      }

      // Free result structure
      this._free_hash_result(resultPtr)

      return result
    } catch (error) {
      console.error('[WASMHashService] Error calculating hash:', error)
      return this.fallbackCalculateHash(imageData, hashSize)
    }
  }

  async calculateBatchHashes(
    imageDataList: ImageData[],
    hashSize: number = 16
  ): Promise<WASMHashResult[]> {
    await this.initialize()

    if (!this.wasmAvailable || !this.module) {
      // Fallback to sequential JS processing
      const results = []
      for (const img of imageDataList) {
        results.push(await this.fallbackCalculateHash(img, hashSize))
      }
      return results
    }

    try {
      const numImages = imageDataList.length

      // Calculate total size and create flattened buffer
      let totalSize = 0
      const offsets = new Int32Array(numImages)
      const dimensions = new Int32Array(numImages * 2)

      for (let i = 0; i < numImages; i++) {
        offsets[i] = totalSize
        totalSize += imageDataList[i].data.length
        dimensions[i * 2] = imageDataList[i].width
        dimensions[i * 2 + 1] = imageDataList[i].height
      }

      // Allocate memory
      const imagesDataPtr = this.module._malloc(totalSize)
      const offsetsPtr = this.module._malloc(numImages * 4)
      const dimensionsPtr = this.module._malloc(numImages * 8)

      // Copy data
      this.module.HEAP32.set(offsets, offsetsPtr / 4)
      this.module.HEAP32.set(dimensions, dimensionsPtr / 4)

      // Copy image data
      for (let i = 0; i < numImages; i++) {
        const offset = offsets[i]
        this.module.HEAPU8.set(imageDataList[i].data, imagesDataPtr + offset)
      }

      // Call batch function
      const resultsPtr = this._calculate_batch_hashes(
        imagesDataPtr,
        dimensionsPtr,
        offsetsPtr,
        numImages,
        hashSize
      )

      // Free input memory
      this.module._free(imagesDataPtr)
      this.module._free(offsetsPtr)
      this.module._free(dimensionsPtr)

      // Read results
      const results: WASMHashResult[] = []

      for (let i = 0; i < numImages; i++) {
        // HashResult struct size is 12 bytes (3 * 4 bytes for 32-bit WASM)
        const resultBase = resultsPtr + (i * 12)
        const hashPtr = this.module.HEAP32[resultBase / 4]
        const error = this.module.HEAP32[resultBase / 4 + 1]
        const errorMsgPtr = this.module.HEAP32[resultBase / 4 + 2]

        if (error === 0) {
          const hash = this.readString(hashPtr)
          results.push({ hash, error: false })
        } else {
          const errorMessage = this.readString(errorMsgPtr)
          results.push({ hash: '', error: true, errorMessage })
        }
      }

      // Free results memory
      this._free_batch_results(resultsPtr, numImages)

      return results
    } catch (error) {
      console.error('[WASMHashService] Batch processing failed:', error)
      // Fallback
      const results = []
      for (const img of imageDataList) {
        results.push(await this.fallbackCalculateHash(img, hashSize))
      }
      return results
    }
  }

  calculateHammingDistance(hash1: string, hash2: string): number {
    if (!this.wasmAvailable || !this.module || !this._calculate_hamming_distance) {
      return this.fallbackHammingDistance(hash1, hash2)
    }

    return this._calculate_hamming_distance(hash1, hash2)
  }

  // Helper to read C string from memory
  private readString(ptr: number): string {
    if (ptr === 0) return ''

    let str = ''
    let i = 0
    while (true) {
      const charCode = this.module!.HEAPU8[ptr + i]
      if (charCode === 0) break
      str += String.fromCharCode(charCode)
      i++
    }
    return str
  }

  // Fallback implementations
  private fallbackCalculateHash(imageData: ImageData, hashSize: number): WASMHashResult {
    try {
      const hash = this.calculateHashFromImageData(imageData, hashSize)
      return { hash, error: false }
    } catch (error) {
      return {
        hash: '',
        error: true,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  private fallbackHammingDistance(hash1: string, hash2: string): number {
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
    this.module = null
  }
}

export const wasmHashService = new WASMHashService()
export type { WASMHashResult }