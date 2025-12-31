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
export interface EmscriptenModule {
  cwrap: (ident: string, returnType: string | null, argTypes: string[]) => any
  _malloc: (size: number) => number
  _free: (ptr: number) => void
  HEAPU8: Uint8Array
  HEAP32: Int32Array
  getValue: (ptr: number, type: string) => number
  stringToUTF8: (str: string, ptr: number, maxLength: number) => void
  lengthBytesUTF8: (str: string) => number
}

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

declare global {
  interface Window {
    PerceptualHashModule?: (config: any) => Promise<EmscriptenModule>
  }
}
