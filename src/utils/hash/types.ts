export interface WASMHashResult {
  hash: string
  error: boolean
  errorMessage?: string
}

export interface SimilarPair {
  index1: number
  index2: number
}

export interface RustWasmExports {
  memory: WebAssembly.Memory
  malloc: (size: number) => number
  free: (ptr: number) => void
  calculate_perceptual_hash: (
    imageDataPtr: number,
    width: number,
    height: number,
    hashSize: number
  ) => number
  calculate_batch_hashes: (
    imagesDataPtr: number,
    dimensionsPtr: number,
    imageOffsetsPtr: number,
    numImages: number,
    hashSize: number
  ) => number
  calculate_hamming_distance: (hash1Ptr: number, hash2Ptr: number) => number
  find_similar_pairs: (
    hashesPtr: number,
    numHashes: number,
    threshold: number,
    outCountPtr: number
  ) => number
  find_similar_pairs_bucketed: (
    hashesPtr: number,
    numHashes: number,
    bucketStartsPtr: number,
    bucketSizesPtr: number,
    numBuckets: number,
    threshold: number,
    outCountPtr: number
  ) => number
  free_hash_result: (resultPtr: number) => void
  free_batch_results: (resultsPtr: number, numResults: number) => void
  free_pairs: (pairsPtr: number) => void
  has_simd_support: () => number
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
