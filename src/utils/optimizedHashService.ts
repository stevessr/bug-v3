/**
 * Optimized Perceptual Hash Service
 * Enhanced with IndexedDB caching, batch processing, and WebAssembly acceleration
 */

// Re-export everything from the new location
export {
  type WASMHashResult,
  type SimilarPair,
  type HashCalculationOptions,
  type BatchHashResult
} from './hash/types'

export { optimizedHashService, OptimizedHashService } from './hash/optimizedHashService'
