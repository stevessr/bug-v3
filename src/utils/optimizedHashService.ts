/**
 * Optimized Perceptual Hash Service
 * Enhanced with IndexedDB caching, batch processing, and WebAssembly acceleration
 */

import { imageCacheService } from './imageCacheService'

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
    if (!this.module) {
      throw new Error('WASM module not initialized')
    }
    while (true) {
      const charCode = this.module.HEAPU8[ptr + i]
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

const wasmHashService = new WASMHashService()

// WASMHashService class end

export interface HashCalculationOptions {
  useCache?: boolean
  batchSize?: number
  quality?: 'low' | 'medium' | 'high'
  useWASM?: boolean
  onProgress?: (processed: number, total: number) => void
}

export interface BatchHashResult {
  url: string
  hash: string
  cached: boolean
  error?: string
  wasmAccelerated?: boolean
}

/**
 * Union-Find (Disjoint Set) for efficient grouping
 */
class UnionFind {
  private parent: Map<string, string> = new Map()
  private rank: Map<string, number> = new Map()

  find(x: string): string {
    if (!this.parent.has(x)) {
      this.parent.set(x, x)
      this.rank.set(x, 0)
    }
    const parentX = this.parent.get(x)
    if (parentX !== x) {
      if (parentX) {
        this.parent.set(x, this.find(parentX))
      }
    }
    return this.parent.get(x) || x
  }

  union(x: string, y: string): void {
    const rootX = this.find(x)
    const rootY = this.find(y)
    if (rootX === rootY) return

    const rankX = this.rank.get(rootX) || 0
    const rankY = this.rank.get(rootY) || 0

    if (rankX < rankY) {
      this.parent.set(rootX, rootY)
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX)
    } else {
      this.parent.set(rootY, rootX)
      this.rank.set(rootX, rankX + 1)
    }
  }

  getGroups(): Map<string, string[]> {
    const groups = new Map<string, string[]>()
    for (const x of this.parent.keys()) {
      const root = this.find(x)
      if (!groups.has(root)) {
        groups.set(root, [])
      }
      const group = groups.get(root)
      if (group) {
        group.push(x)
      }
    }
    return groups
  }
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
  private wasmAvailable = false

  // Cache for binary representations of hashes
  private binaryHashCache = new Map<string, bigint>()

  // OptimizedHashService class methods continued...

  async initializeWorkers(): Promise<void> {
    if (this.workers.length > 0) return

    // Check WASM availability first
    this.wasmAvailable = wasmHashService.isSupported()

    if (this.wasmAvailable) {
      try {
        await wasmHashService.initialize()
        console.log('[OptimizedHashService] Using optimized hash service (WASM)')
        return
      } catch (error) {
        console.warn(
          '[OptimizedHashService] Hash service initialization failed, falling back to Workers:',
          error
        )
        this.wasmAvailable = false
      }
    }

    // Fallback to Web Workers
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

  async calculateHash(url: string, options: HashCalculationOptions = {}): Promise<string> {
    const { useCache = true, quality = 'medium', useWASM = true } = options

    // 优先检查哈希缓存
    if (useCache) {
      const cachedHash = await imageCacheService.getHash(url)
      if (cachedHash) {
        console.log(`[OptimizedHashService] Using cached hash for ${url}`)
        return cachedHash
      }
    }

    // 优先尝试从本地缓存获取图片
    let imageBlob = await imageCacheService.getImage(url)
    let fromCache = true

    if (!imageBlob) {
      // 只有在缓存中没有时才从网络获取
      console.log(`[OptimizedHashService] Cache miss for ${url}, fetching from network`)
      fromCache = false
      imageBlob = await this.fetchImage(url)
      if (imageBlob) {
        // 缓存获取到的图片以供后续使用
        await imageCacheService.cacheImage(url, imageBlob)
        console.log(`[OptimizedHashService] Cached image for ${url}`)
      }
    } else {
      console.log(`[OptimizedHashService] Using cached image for ${url}`)
    }

    if (!imageBlob) {
      throw new Error(`Failed to load image: ${url}`)
    }

    // Calculate hash using WASM if available and enabled
    if (useWASM && this.wasmAvailable) {
      try {
        const hash = await this.calculateHashWithWASM(imageBlob, quality)

        // Cache the hash
        if (useCache) {
          await imageCacheService.updateHash(url, hash)
        }

        console.log(
          `[OptimizedHashService] Calculated new hash for ${url} (source: ${fromCache ? 'cache' : 'network'})`
        )
        return hash
      } catch (error) {
        console.warn(
          '[OptimizedHashService] WASM calculation failed, falling back to Workers:',
          error
        )
      }
    }

    // Fallback to JavaScript/Worker calculation
    const hash = await this.calculateHashFromBlob(imageBlob, quality)

    // Cache the hash
    if (useCache) {
      await imageCacheService.updateHash(url, hash)
    }

    console.log(
      `[OptimizedHashService] Calculated new hash for ${url} (source: ${fromCache ? 'cache' : 'network'})`
    )
    return hash
  }

  private async calculateHashWithWASM(blob: Blob, quality: string): Promise<string> {
    const size = this.HASH_SIZE[quality as keyof typeof this.HASH_SIZE]

    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = async () => {
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

          // Use WASM for calculation
          const result = await wasmHashService.calculateHash(imageData, size)

          if (result.error || !result.hash) {
            reject(new Error(result.errorMessage || 'WASM hash calculation failed'))
          } else {
            resolve(result.hash)
          }
        } catch (error) {
          reject(error)
        }
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(blob)
    })
  }

  async calculateBatchHashes(
    urls: string[],
    options: HashCalculationOptions = {}
  ): Promise<BatchHashResult[]> {
    const {
      useCache = true,
      batchSize = 10,
      quality = 'medium',
      useWASM = true,
      onProgress
    } = options

    await this.initializeWorkers()

    const results: BatchHashResult[] = []
    const toProcess: string[] = []
    let cacheHits = 0
    let cacheMisses = 0

    console.log(`[OptimizedHashService] Processing batch of ${urls.length} URLs`)

    // 优先检查缓存中的哈希值
    for (const url of urls) {
      if (useCache) {
        const cachedHash = await imageCacheService.getHash(url)
        if (cachedHash) {
          results.push({ url, hash: cachedHash, cached: true })
          cacheHits++
          onProgress?.(results.length, urls.length)
          continue
        }
      }
      toProcess.push(url)
      cacheMisses++
    }

    console.log(`[OptimizedHashService] Cache stats: ${cacheHits} hits, ${cacheMisses} misses`)

    // 批量处理剩余的 URL
    for (let i = 0; i < toProcess.length; i += batchSize) {
      const batch = toProcess.slice(i, i + batchSize)
      console.log(
        `[OptimizedHashService] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(toProcess.length / batchSize)} with ${batch.length} URLs`
      )

      const batchResults = await this.processBatch(batch, quality, useWASM)
      results.push(...batchResults)

      onProgress?.(results.length, urls.length)
    }

    console.log(`[OptimizedHashService] Batch processing complete: ${results.length} total results`)
    return results
  }

  private async processBatch(
    urls: string[],
    quality: string,
    useWASM: boolean
  ): Promise<BatchHashResult[]> {
    const size = this.HASH_SIZE[quality as keyof typeof this.HASH_SIZE]
    const results: BatchHashResult[] = []
    let cacheHits = 0
    let networkFetches = 0

    // 并行获取图片，优先从缓存加载
    const imagePromises = urls.map(async url => {
      let blob = await imageCacheService.getImage(url)
      let fromCache = true

      if (!blob) {
        // 只有在缓存中没有时才从网络获取
        fromCache = false
        networkFetches++
        blob = await this.fetchImage(url)
        if (blob) {
          await imageCacheService.cacheImage(url, blob)
          console.log(`[OptimizedHashService] Cached new image: ${url}`)
        }
      } else {
        cacheHits++
      }

      return { url, blob, fromCache }
    })

    const images = await Promise.all(imagePromises)
    console.log(
      `[OptimizedHashService] Batch image loading: ${cacheHits} from cache, ${networkFetches} from network`
    )

    // 尝试使用 WASM 批量处理
    if (useWASM && this.wasmAvailable && images.length > 1) {
      try {
        const imageDataList: ImageData[] = []

        for (const { url: _url, blob } of images) {
          if (!blob) continue

          const imageData = await this.blobToImageData(blob, size)
          if (imageData) {
            imageDataList.push(imageData)
          }
        }

        if (imageDataList.length > 0) {
          console.log(
            `[OptimizedHashService] Using WASM batch processing for ${imageDataList.length} images`
          )
          const wasmResults = await wasmHashService.calculateBatchHashes(imageDataList, size)

          // 将 WASM 结果映射回 URL
          for (let i = 0; i < images.length; i++) {
            const { url, blob, fromCache } = images[i]
            if (!blob) {
              results.push({ url, hash: '', cached: false, error: 'Failed to fetch image' })
              continue
            }

            const wasmResult = wasmResults[i]
            if (wasmResult && !wasmResult.error) {
              results.push({
                url,
                hash: wasmResult.hash,
                cached: fromCache,
                wasmAccelerated: true
              })

              // 缓存哈希值
              await imageCacheService.updateHash(url, wasmResult.hash)
            } else {
              // 回退到单独处理
              const hash = await this.calculateHashFromBlob(blob, quality)
              results.push({ url, hash, cached: fromCache, wasmAccelerated: false })
              await imageCacheService.updateHash(url, hash)
            }
          }

          return results
        }
      } catch (error) {
        console.warn(
          '[OptimizedHashService] WASM batch processing failed, falling back to individual processing:',
          error
        )
      }
    }

    // 回退到单独处理
    console.log(`[OptimizedHashService] Using individual processing for ${images.length} images`)
    const workerPromises = images.map(async ({ url, blob, fromCache }) => {
      if (!blob) {
        return {
          url,
          hash: '',
          cached: false,
          error: 'Failed to fetch image',
          wasmAccelerated: false
        }
      }

      try {
        const hash = await this.calculateHashFromBlob(blob, quality)

        // 缓存哈希值
        await imageCacheService.updateHash(url, hash)

        return { url, hash, cached: fromCache, wasmAccelerated: false }
      } catch (error) {
        return {
          url,
          hash: '',
          cached: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          wasmAccelerated: false
        }
      }
    })

    return Promise.all(workerPromises)
  }

  private async blobToImageData(blob: Blob, size: number): Promise<ImageData | null> {
    return new Promise(resolve => {
      const img = new Image()
      img.crossOrigin = 'anonymous'

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = size
          canvas.height = size

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(null)
            return
          }

          ctx.drawImage(img, 0, 0, size, size)
          const imageData = ctx.getImageData(0, 0, size, size)
          resolve(imageData)
        } catch (error) {
          resolve(null)
        }
      }

      img.onerror = () => resolve(null)
      img.src = URL.createObjectURL(blob)
    })
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

  /**
   * 检查 URL 列表的缓存状态，用于重复检测前的缓存分析
   */
  async checkCacheStatus(urls: string[]): Promise<{
    total: number
    cachedImages: number
    cachedHashes: number
    needsDownload: number
    details: Array<{
      url: string
      imageCached: boolean
      hashCached: boolean
    }>
  }> {
    const details = []
    let cachedImages = 0
    let cachedHashes = 0

    for (const url of urls) {
      const imageCached = !!(await imageCacheService.getImage(url))
      const hashCached = !!(await imageCacheService.getHash(url))

      if (imageCached) cachedImages++
      if (hashCached) cachedHashes++

      details.push({
        url,
        imageCached,
        hashCached
      })
    }

    const needsDownload = urls.length - cachedImages

    console.log(
      `[OptimizedHashService] Cache status check: ${cachedImages}/${urls.length} images cached, ${cachedHashes}/${urls.length} hashes cached, ${needsDownload} need download`
    )

    return {
      total: urls.length,
      cachedImages,
      cachedHashes,
      needsDownload,
      details
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
        const distance = this.hammingDistance(result.hash, existingHash)

        if (distance <= threshold) {
          const urls = hashMap.get(existingHash)
          if (urls) {
            urls.push(result.url)
          }
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

  // Public method for external access
  hammingDistance(hash1: string, hash2: string): number {
    // Use WASM if available
    if (this.wasmAvailable) {
      return wasmHashService.calculateHammingDistance(hash1, hash2)
    }

    // Use optimized binary popcount method
    return this.hammingDistanceFast(hash1, hash2)
  }

  /**
   * Fast Hamming distance using BigInt XOR and popcount
   * Much faster than character-by-character comparison
   */
  private hammingDistanceFast(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) return Infinity

    // Get or compute binary representations
    const bin1 = this.hexToBigInt(hash1)
    const bin2 = this.hexToBigInt(hash2)

    // XOR and count differing bits
    const xor = bin1 ^ bin2
    return this.popcount64(xor)
  }

  /**
   * Convert hex string to BigInt (cached)
   */
  private hexToBigInt(hex: string): bigint {
    const cached = this.binaryHashCache.get(hex)
    if (cached !== undefined) {
      return cached
    }

    // Convert hex to binary representation
    // Each hex character represents 4 bits
    let result = 0n
    for (let i = 0; i < hex.length; i++) {
      result = (result << 4n) | BigInt(parseInt(hex[i], 16))
    }

    this.binaryHashCache.set(hex, result)
    return result
  }

  /**
   * Count number of 1 bits in a BigInt (popcount)
   * Uses Brian Kernighan's algorithm for sparse bit counts
   */
  private popcount64(n: bigint): number {
    let count = 0
    while (n > 0n) {
      n &= n - 1n // Clear the lowest set bit
      count++
    }
    return count
  }

  /**
   * Batch find duplicates with WASM acceleration
   * Uses native WASM batch comparison for maximum performance
   */
  async findDuplicatesWithWASM<T extends { id: string; hash: string }>(
    items: T[],
    threshold: number = 10
  ): Promise<Map<string, T[]>> {
    if (items.length === 0) return new Map()

    const startTime = performance.now()

    // Filter valid items and extract hashes
    const validItems = items.filter(item => item.hash && item.hash.length > 0)
    const hashes = validItems.map(item => item.hash)

    // Use WASM to find similar pairs
    const pairs = await wasmHashService.findSimilarPairs(hashes, threshold)

    // Build groups using Union-Find
    const uf = new UnionFind()
    for (const pair of pairs) {
      uf.union(validItems[pair.index1].id, validItems[pair.index2].id)
    }

    // Build result groups
    const idToItem = new Map<string, T>()
    for (const item of validItems) {
      idToItem.set(item.id, item)
    }

    const result = new Map<string, T[]>()
    const ufGroups = uf.getGroups()

    for (const [root, ids] of ufGroups) {
      if (ids.length > 1) {
        const groupItems = ids
          .map(id => {
            const item = idToItem.get(id)
            return item || null
          })
          .filter((item): item is T => item !== null)
        if (groupItems.length > 1) {
          result.set(root, groupItems)
        }
      }
    }

    const endTime = performance.now()
    console.log(
      `[OptimizedHashService] findDuplicatesWithWASM: ${items.length} items, ` +
        `${result.size} duplicate groups, ${pairs.length} similar pairs, ` +
        `${(endTime - startTime).toFixed(2)}ms`
    )

    return result
  }

  /**
   * Batch find duplicates with WASM bucketed acceleration
   * Pre-sorts by prefix for optimal bucket-based comparison
   */
  async findDuplicatesWithWASMBucketed<T extends { id: string; hash: string }>(
    items: T[],
    threshold: number = 10
  ): Promise<Map<string, T[]>> {
    if (items.length === 0) return new Map()

    const startTime = performance.now()

    // Filter valid items
    const validItems = items.filter(item => item.hash && item.hash.length >= 2)

    // Sort by hash prefix and build bucket info
    const prefixLength = 2
    const sortedItems = [...validItems].sort((a, b) => {
      const prefixA = a.hash.substring(0, prefixLength)
      const prefixB = b.hash.substring(0, prefixLength)
      return prefixA.localeCompare(prefixB)
    })

    const hashes = sortedItems.map(item => item.hash)

    // Build bucket starts and sizes
    const bucketStarts: number[] = []
    const bucketSizes: number[] = []
    let currentPrefix = ''
    let currentStart = 0

    for (let i = 0; i < sortedItems.length; i++) {
      const prefix = sortedItems[i].hash.substring(0, prefixLength)
      if (prefix !== currentPrefix) {
        if (currentPrefix !== '') {
          bucketSizes.push(i - currentStart)
        }
        bucketStarts.push(i)
        currentPrefix = prefix
        currentStart = i
      }
    }
    // Add last bucket
    if (sortedItems.length > 0) {
      bucketSizes.push(sortedItems.length - currentStart)
    }

    // Use WASM bucketed comparison
    const pairs = await wasmHashService.findSimilarPairsBucketed(
      hashes,
      bucketStarts,
      bucketSizes,
      threshold
    )

    // Build groups using Union-Find
    const uf = new UnionFind()
    for (const pair of pairs) {
      uf.union(sortedItems[pair.index1].id, sortedItems[pair.index2].id)
    }

    // Build result groups
    const idToItem = new Map<string, T>()
    for (const item of sortedItems) {
      idToItem.set(item.id, item)
    }

    const result = new Map<string, T[]>()
    const ufGroups = uf.getGroups()

    for (const [root, ids] of ufGroups) {
      if (ids.length > 1) {
        const groupItems = ids
          .map(id => {
            const item = idToItem.get(id)
            return item || null
          })
          .filter((item): item is T => item !== null)
        if (groupItems.length > 1) {
          result.set(root, groupItems)
        }
      }
    }

    const endTime = performance.now()
    console.log(
      `[OptimizedHashService] findDuplicatesWithWASMBucketed: ${items.length} items, ` +
        `${bucketStarts.length} buckets, ${result.size} duplicate groups, ` +
        `${pairs.length} similar pairs, ${(endTime - startTime).toFixed(2)}ms`
    )

    return result
  }

  /**
   * Batch find duplicates with hash bucketing optimization
   * Significantly reduces O(n²) comparisons by grouping hashes by prefix
   * Falls back to JS implementation if WASM is unavailable
   */
  async findDuplicatesOptimized<T extends { id: string; hash: string }>(
    items: T[],
    threshold: number = 10
  ): Promise<Map<string, T[]>> {
    if (items.length === 0) return new Map()

    // Try WASM first for better performance
    if (this.wasmAvailable) {
      try {
        // Use bucketed WASM for large datasets, simple WASM for smaller ones
        if (items.length > 100) {
          return await this.findDuplicatesWithWASMBucketed(items, threshold)
        } else {
          return await this.findDuplicatesWithWASM(items, threshold)
        }
      } catch (error) {
        console.warn(
          '[OptimizedHashService] WASM duplicate detection failed, falling back to JS:',
          error
        )
      }
    }

    // Fallback to JS implementation
    return this.findDuplicatesOptimizedJS(items, threshold)
  }

  /**
   * JavaScript fallback for duplicate detection
   */
  private findDuplicatesOptimizedJS<T extends { id: string; hash: string }>(
    items: T[],
    threshold: number = 10
  ): Map<string, T[]> {
    if (items.length === 0) return new Map()

    const startTime = performance.now()
    const uf = new UnionFind()

    // Group items by hash prefix for bucketing (first 2 characters = 256 buckets)
    // Items with very different prefixes are unlikely to be similar
    const prefixBuckets = new Map<string, T[]>()
    const prefixLength = 2

    for (const item of items) {
      if (!item.hash || item.hash.length < prefixLength) continue
      const prefix = item.hash.substring(0, prefixLength)
      if (!prefixBuckets.has(prefix)) {
        prefixBuckets.set(prefix, [])
      }
      const bucket = prefixBuckets.get(prefix)
      if (bucket) {
        bucket.push(item)
      }
    }

    // Pre-compute binary representations for all hashes
    for (const item of items) {
      if (item.hash) {
        this.hexToBigInt(item.hash)
      }
    }

    // For each bucket, compare items within the bucket
    // Also compare with neighboring buckets (prefixes that differ by small amounts)
    const bucketKeys = Array.from(prefixBuckets.keys()).sort()
    const processedPairs = new Set<string>()

    for (let bucketIdx = 0; bucketIdx < bucketKeys.length; bucketIdx++) {
      const prefix = bucketKeys[bucketIdx]
      const bucket = prefixBuckets.get(prefix)
      if (!bucket) continue

      // Compare within this bucket
      for (let i = 0; i < bucket.length; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          const item1 = bucket[i]
          const item2 = bucket[j]
          const pairKey =
            item1.id < item2.id ? `${item1.id}:${item2.id}` : `${item2.id}:${item1.id}`

          if (!processedPairs.has(pairKey)) {
            processedPairs.add(pairKey)
            const distance = this.hammingDistanceFast(item1.hash, item2.hash)
            if (distance <= threshold) {
              uf.union(item1.id, item2.id)
            }
          }
        }
      }

      // Compare with nearby buckets (within hamming distance range of prefix)
      // Since threshold is typically 10-15 and prefix is 2 hex chars (8 bits),
      // we need to check buckets whose prefix differs by at most threshold bits
      for (let otherIdx = bucketIdx + 1; otherIdx < bucketKeys.length; otherIdx++) {
        const otherPrefix = bucketKeys[otherIdx]
        const prefixDistance = this.hammingDistanceFast(prefix, otherPrefix)

        // If prefix distance already exceeds threshold, remaining hashes can't match
        // But we need to be careful - the rest of the hash could compensate
        // So we check if prefix distance is within a reasonable range
        if (prefixDistance > threshold) continue

        const otherBucket = prefixBuckets.get(otherPrefix)
        if (!otherBucket) continue
        for (const item1 of bucket) {
          for (const item2 of otherBucket) {
            const pairKey =
              item1.id < item2.id ? `${item1.id}:${item2.id}` : `${item2.id}:${item1.id}`

            if (!processedPairs.has(pairKey)) {
              processedPairs.add(pairKey)
              const distance = this.hammingDistanceFast(item1.hash, item2.hash)
              if (distance <= threshold) {
                uf.union(item1.id, item2.id)
              }
            }
          }
        }
      }
    }

    // Build result groups
    const idToItem = new Map<string, T>()
    for (const item of items) {
      idToItem.set(item.id, item)
    }

    const result = new Map<string, T[]>()
    const ufGroups = uf.getGroups()

    for (const [root, ids] of ufGroups) {
      if (ids.length > 1) {
        const groupItems = ids
          .map(id => {
            const item = idToItem.get(id)
            return item || null
          })
          .filter((item): item is T => item !== null)
        if (groupItems.length > 1) {
          result.set(root, groupItems)
        }
      }
    }

    const endTime = performance.now()
    console.log(
      `[OptimizedHashService] findDuplicatesOptimizedJS: ${items.length} items, ` +
        `${result.size} duplicate groups, ${processedPairs.size} comparisons, ` +
        `${(endTime - startTime).toFixed(2)}ms`
    )

    return result
  }

  /**
   * Clear the binary hash cache (call when done with batch operations)
   */
  clearBinaryHashCache(): void {
    this.binaryHashCache.clear()
  }

  async cleanup(): Promise<void> {
    // Terminate workers
    for (const worker of this.workers) {
      worker.terminate()
    }
    this.workers = []
    this.workerReady = []

    // Cleanup WASM
    await wasmHashService.cleanup()
  }

  getCacheStats() {
    return imageCacheService.getStats()
  }

  isWASMAvailable(): boolean {
    return this.wasmAvailable
  }
}

export const optimizedHashService = new OptimizedHashService()
