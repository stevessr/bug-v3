/**
 * Legacy Hash Service - Migration Layer
 * Provides backward compatibility while migrating to optimized hash service
 */

import { optimizedHashService } from './optimizedHashService'

// Re-export functions for backward compatibility
// These will redirect to the optimized service internally

/**
 * Calculate perceptual hash for an image
 * @deprecated Use optimizedHashService.calculateHash() instead
 */
export async function calculatePerceptualHash(imageUrl: string): Promise<string> {
  try {
    // Ensure workers are initialized
    await optimizedHashService.initializeWorkers()

    return await optimizedHashService.calculateHash(imageUrl, {
      useCache: true,
      quality: 'medium'
    })
  } catch (error) {
    console.error('Error in legacy calculatePerceptualHash:', error)
    throw error
  }
}

/**
 * Calculate Hamming distance between two hash strings
 * @deprecated This function is now internal to optimizedHashService
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) return Infinity

  let distance = 0
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) distance++
  }
  return distance
}

/**
 * Check if two images are similar based on their perceptual hashes
 * @deprecated Use optimizedHashService.findDuplicates() for batch operations
 */
export function areSimilarImages(hash1: string, hash2: string, threshold = 10): boolean {
  const distance = hammingDistance(hash1, hash2)
  return distance <= threshold
}

/**
 * Batch calculate hashes for multiple images
 * @deprecated Use optimizedHashService.calculateBatchHashes() instead
 */
export async function calculateBatchPerceptualHashes(
  urls: string[],
  options: {
    useCache?: boolean
    batchSize?: number
    quality?: 'low' | 'medium' | 'high'
    onProgress?: (processed: number, total: number) => void
  } = {}
): Promise<Array<{ url: string; hash: string; error?: string }>> {
  await optimizedHashService.initializeWorkers()

  const results = await optimizedHashService.calculateBatchHashes(urls, options)

  // Convert to legacy format
  return results.map(result => ({
    url: result.url,
    hash: result.hash,
    error: result.error
  }))
}

/**
 * Find duplicate images in a batch
 * @deprecated Use optimizedHashService.findDuplicates() instead
 */
export async function findDuplicateImages(
  urls: string[],
  threshold: number = 10,
  options: {
    useCache?: boolean
    batchSize?: number
    quality?: 'low' | 'medium' | 'high'
    onProgress?: (processed: number, total: number) => void
  } = {}
): Promise<Array<{ url: string; duplicates: string[] }>> {
  await optimizedHashService.initializeWorkers()

  return await optimizedHashService.findDuplicates(urls, threshold, options)
}

/**
 * Get cache statistics
 * @deprecated Use optimizedHashService.getCacheStats() instead
 */
export function getHashCacheStats() {
  return optimizedHashService.getCacheStats()
}

/**
 * Clear image cache
 * @deprecated Use imageCacheService.clearCache() instead
 */
export async function clearHashCache() {
  const { imageCacheService } = await import('./imageCacheService')
  return await imageCacheService.clearCache()
}