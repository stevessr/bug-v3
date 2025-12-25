/**
 * WebAssembly Perceptual Hash Service
 * High-performance hash calculation and duplicate detection using WASM
 * Optimized with popcount bit operations and batch processing
 */

export interface WASMHashResult {
  hash: string
  error: boolean
  errorMessage?: string
}

export interface SimilarPair {
  index1: number
  index2: number
}

// Emscripten Module Interface
interface EmscriptenModule {
  cwrap: (ident: string, returnType: string | null, argTypes: string[]) => any
  _malloc: (size: number) => number
  _free: (ptr: number) => void
  HEAPU8: Uint8Array
  HEAP32: Int32Array
  getValue: (ptr: number, type: string) => number
  stringToUTF8: (str: string, ptr: number, maxLength: number) => void
  lengthBytesUTF8: (str: string) => number
}

declare global {
  interface Window {
    PerceptualHashModule?: (config: any) => Promise<EmscriptenModule>
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
  private _find_similar_pairs: any = null
  private _find_similar_pairs_bucketed: any = null
  private _free_hash_result: any = null
  private _free_batch_results: any = null
  private _free_pairs: any = null
  private _has_simd_support: any = null

  private getWasmPath(filename: string): string {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL(`wasm/${filename}`)
    }
    // Fallback for standard web environment (e.g. localhost)
    // Files in public/wasm/ are served at /wasm/
    return `/wasm/${filename}`
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    // Check if WASM is supported
    this.wasmAvailable =
      typeof WebAssembly === 'object' && typeof WebAssembly.validate === 'function'

    if (!this.wasmAvailable) {
      console.warn('[WASMHashService] WASM not supported')
      return
    }

    try {
      // Load the Emscripten generated JS file
      await this.loadScript()

      // Initialize the module
      if (typeof window.PerceptualHashModule === 'function') {
        const wasmUrl = this.getWasmPath('perceptual_hash.wasm')

        this.module = await window.PerceptualHashModule({
          locateFile: (path: string) => {
            if (path.endsWith('.wasm')) {
              return wasmUrl
            }
            return path
          }
        })

        // Bind functions
        this._calculate_perceptual_hash = this.module.cwrap('calculate_perceptual_hash', 'number', [
          'number',
          'number',
          'number',
          'number'
        ])
        this._calculate_batch_hashes = this.module.cwrap('calculate_batch_hashes', 'number', [
          'number',
          'number',
          'number',
          'number',
          'number'
        ])
        this._calculate_hamming_distance = this.module.cwrap(
          'calculate_hamming_distance',
          'number',
          ['string', 'string']
        )
        this._find_similar_pairs = this.module.cwrap('find_similar_pairs', 'number', [
          'number', // hashes pointer array
          'number', // num_hashes
          'number', // threshold
          'number' // out_count pointer
        ])
        this._find_similar_pairs_bucketed = this.module.cwrap(
          'find_similar_pairs_bucketed',
          'number',
          [
            'number', // hashes
            'number', // num_hashes
            'number', // bucket_starts
            'number', // bucket_sizes
            'number', // num_buckets
            'number', // threshold
            'number' // out_count
          ]
        )
        this._free_hash_result = this.module.cwrap('free_hash_result', 'void', ['number'])
        this._free_batch_results = this.module.cwrap('free_batch_results', 'void', [
          'number',
          'number'
        ])
        this._free_pairs = this.module.cwrap('free_pairs', 'void', ['number'])
        this._has_simd_support = this.module.cwrap('has_simd_support', 'number', [])

        const simdSupported = this._has_simd_support()
        console.log(
          `[WASMHashService] WASM module initialized successfully (SIMD: ${simdSupported ? 'enabled' : 'disabled'})`
        )
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
      script.src = this.getWasmPath('perceptual_hash.js')
      script.onload = () => resolve()
      script.onerror = e => reject(new Error(`Failed to load WASM script: ${e}`))
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
        const resultBase = resultsPtr + i * 12
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

  /**
   * Find all similar pairs using WASM acceleration
   * Returns array of index pairs where hamming distance <= threshold
   */
  async findSimilarPairs(hashes: string[], threshold: number): Promise<SimilarPair[]> {
    await this.initialize()

    if (!this.wasmAvailable || !this.module || !this._find_similar_pairs) {
      return this.fallbackFindSimilarPairs(hashes, threshold)
    }

    if (hashes.length <= 1) {
      return []
    }

    try {
      const startTime = performance.now()

      // Allocate array of string pointers
      const numHashes = hashes.length
      const hashPtrsArray = this.module._malloc(numHashes * 4) // 4 bytes per pointer

      // Allocate and copy each hash string
      const stringPtrs: number[] = []
      for (let i = 0; i < numHashes; i++) {
        const hash = hashes[i]
        const len = hash.length + 1 // Include null terminator
        const strPtr = this.module._malloc(len)
        stringPtrs.push(strPtr)

        // Copy string bytes
        for (let j = 0; j < hash.length; j++) {
          this.module.HEAPU8[strPtr + j] = hash.charCodeAt(j)
        }
        this.module.HEAPU8[strPtr + hash.length] = 0 // Null terminator

        // Store pointer in array
        this.module.HEAP32[hashPtrsArray / 4 + i] = strPtr
      }

      // Allocate output count
      const outCountPtr = this.module._malloc(4)

      // Call WASM function
      const pairsPtr = this._find_similar_pairs(hashPtrsArray, numHashes, threshold, outCountPtr)

      // Read result count
      const pairCount = this.module.HEAP32[outCountPtr / 4]

      // Read pairs
      const pairs: SimilarPair[] = []
      if (pairsPtr && pairCount > 0) {
        for (let i = 0; i < pairCount; i++) {
          const index1 = this.module.HEAP32[pairsPtr / 4 + i * 2]
          const index2 = this.module.HEAP32[pairsPtr / 4 + i * 2 + 1]
          pairs.push({ index1, index2 })
        }
      }

      // Free memory
      for (const ptr of stringPtrs) {
        this.module._free(ptr)
      }
      this.module._free(hashPtrsArray)
      this.module._free(outCountPtr)
      if (pairsPtr) {
        this._free_pairs(pairsPtr)
      }

      const endTime = performance.now()
      console.log(
        `[WASMHashService] findSimilarPairs: ${numHashes} hashes, ${pairs.length} pairs, ${(endTime - startTime).toFixed(2)}ms`
      )

      return pairs
    } catch (error) {
      console.error('[WASMHashService] findSimilarPairs failed:', error)
      return this.fallbackFindSimilarPairs(hashes, threshold)
    }
  }

  /**
   * Find similar pairs with bucket optimization
   * Hashes should be pre-sorted by prefix for best performance
   */
  async findSimilarPairsBucketed(
    hashes: string[],
    bucketStarts: number[],
    bucketSizes: number[],
    threshold: number
  ): Promise<SimilarPair[]> {
    await this.initialize()

    if (!this.wasmAvailable || !this.module || !this._find_similar_pairs_bucketed) {
      return this.fallbackFindSimilarPairs(hashes, threshold)
    }

    if (hashes.length <= 1 || bucketStarts.length === 0) {
      return []
    }

    try {
      const startTime = performance.now()

      const numHashes = hashes.length
      const numBuckets = bucketStarts.length

      // Allocate array of string pointers
      const hashPtrsArray = this.module._malloc(numHashes * 4)

      // Allocate and copy each hash string
      const stringPtrs: number[] = []
      for (let i = 0; i < numHashes; i++) {
        const hash = hashes[i]
        const len = hash.length + 1
        const strPtr = this.module._malloc(len)
        stringPtrs.push(strPtr)

        for (let j = 0; j < hash.length; j++) {
          this.module.HEAPU8[strPtr + j] = hash.charCodeAt(j)
        }
        this.module.HEAPU8[strPtr + hash.length] = 0

        this.module.HEAP32[hashPtrsArray / 4 + i] = strPtr
      }

      // Allocate bucket arrays
      const bucketStartsPtr = this.module._malloc(numBuckets * 4)
      const bucketSizesPtr = this.module._malloc(numBuckets * 4)

      const startsArray = new Int32Array(bucketStarts)
      const sizesArray = new Int32Array(bucketSizes)

      this.module.HEAP32.set(startsArray, bucketStartsPtr / 4)
      this.module.HEAP32.set(sizesArray, bucketSizesPtr / 4)

      // Allocate output count
      const outCountPtr = this.module._malloc(4)

      // Call WASM function
      const pairsPtr = this._find_similar_pairs_bucketed(
        hashPtrsArray,
        numHashes,
        bucketStartsPtr,
        bucketSizesPtr,
        numBuckets,
        threshold,
        outCountPtr
      )

      // Read result count
      const pairCount = this.module.HEAP32[outCountPtr / 4]

      // Read pairs
      const pairs: SimilarPair[] = []
      if (pairsPtr && pairCount > 0) {
        for (let i = 0; i < pairCount; i++) {
          const index1 = this.module.HEAP32[pairsPtr / 4 + i * 2]
          const index2 = this.module.HEAP32[pairsPtr / 4 + i * 2 + 1]
          pairs.push({ index1, index2 })
        }
      }

      // Free memory
      for (const ptr of stringPtrs) {
        this.module._free(ptr)
      }
      this.module._free(hashPtrsArray)
      this.module._free(bucketStartsPtr)
      this.module._free(bucketSizesPtr)
      this.module._free(outCountPtr)
      if (pairsPtr) {
        this._free_pairs(pairsPtr)
      }

      const endTime = performance.now()
      console.log(
        `[WASMHashService] findSimilarPairsBucketed: ${numHashes} hashes, ${numBuckets} buckets, ${pairs.length} pairs, ${(endTime - startTime).toFixed(2)}ms`
      )

      return pairs
    } catch (error) {
      console.error('[WASMHashService] findSimilarPairsBucketed failed:', error)
      return this.fallbackFindSimilarPairs(hashes, threshold)
    }
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

    // Optimized bit counting for hex strings
    let distance = 0
    for (let i = 0; i < len1; i++) {
      const v1 = parseInt(hash1[i], 16)
      const v2 = parseInt(hash2[i], 16)
      let xor = v1 ^ v2
      // Count bits in 4-bit value
      while (xor) {
        distance += xor & 1
        xor >>= 1
      }
    }

    return distance
  }

  private fallbackFindSimilarPairs(hashes: string[], threshold: number): SimilarPair[] {
    const pairs: SimilarPair[] = []
    for (let i = 0; i < hashes.length; i++) {
      for (let j = i + 1; j < hashes.length; j++) {
        const distance = this.fallbackHammingDistance(hashes[i], hashes[j])
        if (distance >= 0 && distance <= threshold) {
          pairs.push({ index1: i, index2: j })
        }
      }
    }
    return pairs
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

  hasSIMDSupport(): boolean {
    if (!this.wasmAvailable || !this._has_simd_support) {
      return false
    }
    return this._has_simd_support() === 1
  }

  async cleanup(): Promise<void> {
    this.isInitialized = false
    this.module = null
  }
}

export const wasmHashService = new WASMHashService()
