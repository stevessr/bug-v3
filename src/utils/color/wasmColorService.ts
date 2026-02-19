/**
 * WASM Color Quantization Service
 * Provides K-Means and Median Cut color quantization via the same Rust WASM module
 * used for perceptual hashing. Falls back to JS implementations when WASM is unavailable.
 */

interface ColorWasmExports {
  memory: WebAssembly.Memory
  malloc: (size: number) => number
  free: (ptr: number) => void
  kmeans_quantize: (
    pixelDataPtr: number,
    width: number,
    height: number,
    k: number,
    maxIterations: number,
    skipAlphaThreshold: number
  ) => number
  median_cut_quantize: (
    pixelDataPtr: number,
    width: number,
    height: number,
    numColors: number,
    skipAlphaThreshold: number
  ) => number
  free_color_result: (resultPtr: number) => void
}

export interface QuantizedColor {
  r: number
  g: number
  b: number
  population: number
}

export interface WasmColorResult {
  colors: QuantizedColor[]
  error: boolean
  errorMessage?: string
}

class WASMColorService {
  private exports: ColorWasmExports | null = null
  private isInitialized = false
  private wasmAvailable = false

  private getWasmPath(filename: string): string {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
      return chrome.runtime.getURL(`wasm/${filename}`)
    }
    return `/wasm/${filename}`
  }

  private hasRequiredExports(maybeExports: unknown): maybeExports is ColorWasmExports {
    const e = maybeExports as Record<string, unknown>
    return (
      typeof e.memory === 'object' &&
      typeof e.malloc === 'function' &&
      typeof e.free === 'function' &&
      typeof e.kmeans_quantize === 'function' &&
      typeof e.median_cut_quantize === 'function' &&
      typeof e.free_color_result === 'function'
    )
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    this.wasmAvailable =
      typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function'
    if (!this.wasmAvailable) return

    try {
      const wasmUrl = this.getWasmPath('perceptual_hash.wasm')
      const response = await fetch(wasmUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch WASM (${response.status})`)
      }

      const bytes = await response.arrayBuffer()
      const { instance } = await WebAssembly.instantiate(bytes, {})

      const maybeExports = instance.exports as unknown
      if (!this.hasRequiredExports(maybeExports)) {
        throw new Error('WASM module missing color quantization exports')
      }

      this.exports = maybeExports
      this.isInitialized = true
      this.wasmAvailable = true
      console.log('[WASMColorService] Initialized')
    } catch (error) {
      console.warn('[WASMColorService] Initialization failed, will use JS fallback:', error)
      this.wasmAvailable = false
      this.isInitialized = false
      this.exports = null
    }
  }

  private getHeapU8(): Uint8Array {
    return new Uint8Array(this.exports!.memory.buffer)
  }

  private getHeapU32(): Uint32Array {
    return new Uint32Array(this.exports!.memory.buffer)
  }

  private parseColorResult(resultPtr: number): WasmColorResult {
    if (resultPtr === 0) {
      return { colors: [], error: true, errorMessage: 'Null result pointer' }
    }

    const heap32 = new Int32Array(this.exports!.memory.buffer)
    const heapU32 = this.getHeapU32()

    // ColorResult layout: colors_ptr (i32), num_colors (i32), error (i32), error_message (i32)
    const baseIdx = resultPtr >> 2
    const colorsPtr = heap32[baseIdx]
    const numColors = heap32[baseIdx + 1]
    const error = heap32[baseIdx + 2]
    const errorMsgPtr = heap32[baseIdx + 3]

    if (error !== 0) {
      let errorMessage = 'Unknown error'
      if (errorMsgPtr !== 0) {
        const heap = this.getHeapU8()
        let end = errorMsgPtr
        while (heap[end] !== 0) end++
        errorMessage = new TextDecoder().decode(heap.slice(errorMsgPtr, end))
      }
      this.exports!.free_color_result(resultPtr)
      return { colors: [], error: true, errorMessage }
    }

    const colors: QuantizedColor[] = []
    if (colorsPtr !== 0 && numColors > 0) {
      const baseColorIdx = colorsPtr >> 2
      for (let i = 0; i < numColors; i++) {
        const offset = baseColorIdx + i * 4
        colors.push({
          r: heapU32[offset],
          g: heapU32[offset + 1],
          b: heapU32[offset + 2],
          population: heapU32[offset + 3]
        })
      }
    }

    this.exports!.free_color_result(resultPtr)
    return { colors, error: false }
  }

  async quantizeKMeans(
    imageData: ImageData,
    k: number = 6,
    maxIterations: number = 20,
    skipAlpha: number = 128
  ): Promise<WasmColorResult> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    if (!this.exports) {
      return { colors: [], error: true, errorMessage: 'WASM not available' }
    }

    const { data, width, height } = imageData
    const dataLen = data.length

    const dataPtr = this.exports.malloc(dataLen)
    if (dataPtr === 0) {
      return { colors: [], error: true, errorMessage: 'Failed to allocate WASM memory' }
    }

    try {
      const heap = this.getHeapU8()
      heap.set(data, dataPtr)

      const resultPtr = this.exports.kmeans_quantize(
        dataPtr,
        width,
        height,
        k,
        maxIterations,
        skipAlpha
      )

      return this.parseColorResult(resultPtr)
    } finally {
      this.exports.free(dataPtr)
    }
  }

  async quantizeMedianCut(
    imageData: ImageData,
    numColors: number = 6,
    skipAlpha: number = 128
  ): Promise<WasmColorResult> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    if (!this.exports) {
      return { colors: [], error: true, errorMessage: 'WASM not available' }
    }

    const { data, width, height } = imageData
    const dataLen = data.length

    const dataPtr = this.exports.malloc(dataLen)
    if (dataPtr === 0) {
      return { colors: [], error: true, errorMessage: 'Failed to allocate WASM memory' }
    }

    try {
      const heap = this.getHeapU8()
      heap.set(data, dataPtr)

      const resultPtr = this.exports.median_cut_quantize(
        dataPtr,
        width,
        height,
        numColors,
        skipAlpha
      )

      return this.parseColorResult(resultPtr)
    } finally {
      this.exports.free(dataPtr)
    }
  }

  get isAvailable(): boolean {
    return this.wasmAvailable && this.isInitialized && this.exports !== null
  }
}

export const wasmColorService = new WASMColorService()
