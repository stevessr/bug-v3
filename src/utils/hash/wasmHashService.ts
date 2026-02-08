import { type WASMHashResult, type SimilarPair, type RustWasmExports } from './types'

class WASMHashService {
  private exports: RustWasmExports | null = null
  private isInitialized = false
  private wasmAvailable = false
  private readonly textEncoder = new TextEncoder()
  private readonly textDecoder = new TextDecoder()

  private getWasmPath(filename: string): string {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL(`wasm/${filename}`)
    }
    return `/wasm/${filename}`
  }

  private detectWasmSupport(): boolean {
    return typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function'
  }

  private hasRequiredExports(
    maybeExports: Partial<RustWasmExports>
  ): maybeExports is RustWasmExports {
    return (
      typeof maybeExports.memory === 'object' &&
      typeof maybeExports.malloc === 'function' &&
      typeof maybeExports.free === 'function' &&
      typeof maybeExports.calculate_perceptual_hash === 'function' &&
      typeof maybeExports.calculate_batch_hashes === 'function' &&
      typeof maybeExports.calculate_hamming_distance === 'function' &&
      typeof maybeExports.find_similar_pairs === 'function' &&
      typeof maybeExports.find_similar_pairs_bucketed === 'function' &&
      typeof maybeExports.free_hash_result === 'function' &&
      typeof maybeExports.free_batch_results === 'function' &&
      typeof maybeExports.free_pairs === 'function' &&
      typeof maybeExports.has_simd_support === 'function'
    )
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    this.wasmAvailable = this.detectWasmSupport()
    if (!this.wasmAvailable) {
      console.warn('[WASMHashService] WASM not supported')
      return
    }

    try {
      const wasmUrl = this.getWasmPath('perceptual_hash.wasm')
      const response = await fetch(wasmUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM (${response.status} ${response.statusText})`)
      }

      const bytes = await response.arrayBuffer()
      const { instance } = await WebAssembly.instantiate(bytes, {})

      const maybeExports = instance.exports as unknown as Partial<RustWasmExports>
      if (!this.hasRequiredExports(maybeExports)) {
        throw new Error('WASM exports are incomplete or incompatible')
      }

      this.exports = maybeExports
      this.isInitialized = true
      this.wasmAvailable = true

      const simdSupported = this.exports.has_simd_support() === 1
      console.log(
        `[WASMHashService] Rust WASM module initialized (SIMD: ${simdSupported ? 'enabled' : 'disabled'})`
      )
    } catch (error) {
      console.error('[WASMHashService] Initialization failed:', error)
      this.wasmAvailable = false
      this.isInitialized = false
      this.exports = null
    }
  }

  private getHeapU8(): Uint8Array {
    if (!this.exports) {
      throw new Error('WASM module not initialized')
    }
    return new Uint8Array(this.exports.memory.buffer)
  }

  private getHeapI32(): Int32Array {
    if (!this.exports) {
      throw new Error('WASM module not initialized')
    }
    return new Int32Array(this.exports.memory.buffer)
  }

  private alloc(size: number): number {
    if (!this.exports) {
      throw new Error('WASM module not initialized')
    }
    const ptr = this.exports.malloc(size)
    if (!ptr) {
      throw new Error(`WASM allocation failed (${size} bytes)`)
    }
    return ptr
  }

  private free(ptr: number | null | undefined): void {
    if (!this.exports || !ptr) return
    this.exports.free(ptr)
  }

  private allocCString(value: string): number {
    const bytes = this.textEncoder.encode(value)
    const ptr = this.alloc(bytes.length + 1)
    const heap = this.getHeapU8()
    heap.set(bytes, ptr)
    heap[ptr + bytes.length] = 0
    return ptr
  }

  private readCString(ptr: number): string {
    if (!ptr) return ''

    const heap = this.getHeapU8()
    let end = ptr
    while (end < heap.length && heap[end] !== 0) {
      end++
    }

    return this.textDecoder.decode(heap.subarray(ptr, end))
  }

  async calculateHash(imageData: ImageData, hashSize: number = 16): Promise<WASMHashResult> {
    await this.initialize()

    if (!this.wasmAvailable || !this.exports) {
      return this.fallbackCalculateHash(imageData, hashSize)
    }

    let dataPtr = 0
    let resultPtr = 0

    try {
      const { data, width, height } = imageData
      dataPtr = this.alloc(data.length)
      this.getHeapU8().set(data, dataPtr)

      resultPtr = this.exports.calculate_perceptual_hash(dataPtr, width, height, hashSize)
      if (!resultPtr) {
        throw new Error('calculate_perceptual_hash returned null pointer')
      }

      const heapI32 = this.getHeapI32()
      const base = resultPtr >>> 2
      const hashPtr = heapI32[base]
      const error = heapI32[base + 1]
      const errorMsgPtr = heapI32[base + 2]

      if (error === 0) {
        return { hash: this.readCString(hashPtr), error: false }
      }

      return {
        hash: '',
        error: true,
        errorMessage: this.readCString(errorMsgPtr) || 'Rust WASM hash calculation failed'
      }
    } catch (error) {
      console.error('[WASMHashService] Error calculating hash:', error)
      return this.fallbackCalculateHash(imageData, hashSize)
    } finally {
      this.free(dataPtr)
      if (resultPtr && this.exports) {
        this.exports.free_hash_result(resultPtr)
      }
    }
  }

  async calculateBatchHashes(
    imageDataList: ImageData[],
    hashSize: number = 16
  ): Promise<WASMHashResult[]> {
    await this.initialize()

    if (!this.wasmAvailable || !this.exports) {
      const fallbackResults: WASMHashResult[] = []
      for (const img of imageDataList) {
        fallbackResults.push(this.fallbackCalculateHash(img, hashSize))
      }
      return fallbackResults
    }

    let imagesDataPtr = 0
    let dimensionsPtr = 0
    let offsetsPtr = 0
    let resultsPtr = 0

    try {
      const numImages = imageDataList.length
      if (numImages === 0) return []

      let totalSize = 0
      const offsets = new Int32Array(numImages)
      const dimensions = new Int32Array(numImages * 2)

      for (let i = 0; i < numImages; i++) {
        offsets[i] = totalSize
        totalSize += imageDataList[i].data.length
        dimensions[i * 2] = imageDataList[i].width
        dimensions[i * 2 + 1] = imageDataList[i].height
      }

      imagesDataPtr = this.alloc(totalSize)
      dimensionsPtr = this.alloc(numImages * 8)
      offsetsPtr = this.alloc(numImages * 4)

      this.getHeapI32().set(dimensions, dimensionsPtr >>> 2)
      this.getHeapI32().set(offsets, offsetsPtr >>> 2)

      for (let i = 0; i < numImages; i++) {
        const offset = offsets[i]
        this.getHeapU8().set(imageDataList[i].data, imagesDataPtr + offset)
      }

      resultsPtr = this.exports.calculate_batch_hashes(
        imagesDataPtr,
        dimensionsPtr,
        offsetsPtr,
        numImages,
        hashSize
      )

      if (!resultsPtr) {
        throw new Error('calculate_batch_hashes returned null pointer')
      }

      const results: WASMHashResult[] = []
      const heapI32 = this.getHeapI32()

      for (let i = 0; i < numImages; i++) {
        const base = (resultsPtr >>> 2) + i * 3
        const hashPtr = heapI32[base]
        const error = heapI32[base + 1]
        const errorMsgPtr = heapI32[base + 2]

        if (error === 0) {
          results.push({ hash: this.readCString(hashPtr), error: false })
        } else {
          results.push({
            hash: '',
            error: true,
            errorMessage: this.readCString(errorMsgPtr) || 'Rust WASM batch hash calculation failed'
          })
        }
      }

      return results
    } catch (error) {
      console.error('[WASMHashService] Batch processing failed:', error)
      const fallbackResults: WASMHashResult[] = []
      for (const img of imageDataList) {
        fallbackResults.push(this.fallbackCalculateHash(img, hashSize))
      }
      return fallbackResults
    } finally {
      this.free(imagesDataPtr)
      this.free(dimensionsPtr)
      this.free(offsetsPtr)
      if (resultsPtr && this.exports) {
        this.exports.free_batch_results(resultsPtr, imageDataList.length)
      }
    }
  }

  calculateHammingDistance(hash1: string, hash2: string): number {
    if (!this.wasmAvailable || !this.exports) {
      return this.fallbackHammingDistance(hash1, hash2)
    }

    let hash1Ptr = 0
    let hash2Ptr = 0

    try {
      hash1Ptr = this.allocCString(hash1)
      hash2Ptr = this.allocCString(hash2)
      return this.exports.calculate_hamming_distance(hash1Ptr, hash2Ptr)
    } catch (error) {
      console.error('[WASMHashService] Hamming distance failed:', error)
      return this.fallbackHammingDistance(hash1, hash2)
    } finally {
      this.free(hash1Ptr)
      this.free(hash2Ptr)
    }
  }

  async findSimilarPairs(hashes: string[], threshold: number): Promise<SimilarPair[]> {
    await this.initialize()

    if (!this.wasmAvailable || !this.exports) {
      return this.fallbackFindSimilarPairs(hashes, threshold)
    }

    if (hashes.length <= 1) {
      return []
    }

    let hashPtrsArray = 0
    let outCountPtr = 0
    let pairsPtr = 0
    const stringPtrs: number[] = []

    try {
      const startTime = performance.now()
      const numHashes = hashes.length

      hashPtrsArray = this.alloc(numHashes * 4)

      for (let i = 0; i < numHashes; i++) {
        const strPtr = this.allocCString(hashes[i])
        stringPtrs.push(strPtr)
        this.getHeapI32()[(hashPtrsArray >>> 2) + i] = strPtr
      }

      outCountPtr = this.alloc(4)
      this.getHeapI32()[outCountPtr >>> 2] = 0

      pairsPtr = this.exports.find_similar_pairs(hashPtrsArray, numHashes, threshold, outCountPtr)
      const pairCount = Math.max(0, this.getHeapI32()[outCountPtr >>> 2])

      const pairs: SimilarPair[] = []
      if (pairsPtr && pairCount > 0) {
        const heapI32 = this.getHeapI32()
        const base = pairsPtr >>> 2
        for (let i = 0; i < pairCount; i++) {
          pairs.push({
            index1: heapI32[base + i * 2],
            index2: heapI32[base + i * 2 + 1]
          })
        }
      }

      const endTime = performance.now()
      console.log(
        `[WASMHashService] findSimilarPairs: ${numHashes} hashes, ${pairs.length} pairs, ${(endTime - startTime).toFixed(2)}ms`
      )

      return pairs
    } catch (error) {
      console.error('[WASMHashService] findSimilarPairs failed:', error)
      return this.fallbackFindSimilarPairs(hashes, threshold)
    } finally {
      for (const strPtr of stringPtrs) {
        this.free(strPtr)
      }
      this.free(hashPtrsArray)
      this.free(outCountPtr)
      if (pairsPtr && this.exports) {
        this.exports.free_pairs(pairsPtr)
      }
    }
  }

  async findSimilarPairsBucketed(
    hashes: string[],
    bucketStarts: number[],
    bucketSizes: number[],
    threshold: number
  ): Promise<SimilarPair[]> {
    await this.initialize()

    if (!this.wasmAvailable || !this.exports) {
      return this.fallbackFindSimilarPairs(hashes, threshold)
    }

    if (hashes.length <= 1 || bucketStarts.length === 0) {
      return []
    }

    let hashPtrsArray = 0
    let bucketStartsPtr = 0
    let bucketSizesPtr = 0
    let outCountPtr = 0
    let pairsPtr = 0
    const stringPtrs: number[] = []

    try {
      const startTime = performance.now()
      const numHashes = hashes.length
      const numBuckets = bucketStarts.length

      hashPtrsArray = this.alloc(numHashes * 4)
      for (let i = 0; i < numHashes; i++) {
        const strPtr = this.allocCString(hashes[i])
        stringPtrs.push(strPtr)
        this.getHeapI32()[(hashPtrsArray >>> 2) + i] = strPtr
      }

      bucketStartsPtr = this.alloc(numBuckets * 4)
      bucketSizesPtr = this.alloc(numBuckets * 4)
      outCountPtr = this.alloc(4)

      this.getHeapI32().set(new Int32Array(bucketStarts), bucketStartsPtr >>> 2)
      this.getHeapI32().set(new Int32Array(bucketSizes), bucketSizesPtr >>> 2)
      this.getHeapI32()[outCountPtr >>> 2] = 0

      pairsPtr = this.exports.find_similar_pairs_bucketed(
        hashPtrsArray,
        numHashes,
        bucketStartsPtr,
        bucketSizesPtr,
        numBuckets,
        threshold,
        outCountPtr
      )

      const pairCount = Math.max(0, this.getHeapI32()[outCountPtr >>> 2])
      const pairs: SimilarPair[] = []

      if (pairsPtr && pairCount > 0) {
        const heapI32 = this.getHeapI32()
        const base = pairsPtr >>> 2
        for (let i = 0; i < pairCount; i++) {
          pairs.push({
            index1: heapI32[base + i * 2],
            index2: heapI32[base + i * 2 + 1]
          })
        }
      }

      const endTime = performance.now()
      console.log(
        `[WASMHashService] findSimilarPairsBucketed: ${numHashes} hashes, ${numBuckets} buckets, ${pairs.length} pairs, ${(endTime - startTime).toFixed(2)}ms`
      )

      return pairs
    } catch (error) {
      console.error('[WASMHashService] findSimilarPairsBucketed failed:', error)
      return this.fallbackFindSimilarPairs(hashes, threshold)
    } finally {
      for (const strPtr of stringPtrs) {
        this.free(strPtr)
      }
      this.free(hashPtrsArray)
      this.free(bucketStartsPtr)
      this.free(bucketSizesPtr)
      this.free(outCountPtr)
      if (pairsPtr && this.exports) {
        this.exports.free_pairs(pairsPtr)
      }
    }
  }

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
    if (hash1.length !== hash2.length) return -1

    let distance = 0
    for (let i = 0; i < hash1.length; i++) {
      const v1 = parseInt(hash1[i], 16)
      const v2 = parseInt(hash2[i], 16)
      let xor = v1 ^ v2
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

    const sum = grayData.reduce((acc, val) => acc + val, 0)
    const average = sum / grayData.length

    let hash = ''
    for (let i = 0; i < grayData.length; i++) {
      hash += grayData[i] > average ? '1' : '0'
    }

    let hexHash = ''
    for (let i = 0; i < hash.length; i += 4) {
      const chunk = hash.slice(i, i + 4)
      hexHash += parseInt(chunk, 2).toString(16)
    }

    return hexHash
  }

  isSupported(): boolean {
    return this.detectWasmSupport()
  }

  isReady(): boolean {
    return this.wasmAvailable && this.isInitialized && this.exports !== null
  }

  hasSIMDSupport(): boolean {
    if (!this.wasmAvailable || !this.exports) {
      return false
    }
    return this.exports.has_simd_support() === 1
  }

  async cleanup(): Promise<void> {
    this.isInitialized = false
    this.wasmAvailable = false
    this.exports = null
  }
}

export const wasmHashService = new WASMHashService()
