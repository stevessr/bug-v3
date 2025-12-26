/**
 * Example usage of the imageCache utility
 * This file demonstrates how to use the new IndexedDB image caching functionality
 */

import { cacheImage, getCachedImage, isImageCached, imageCache } from './imageCache'

/**
 * Example: Cache and retrieve an image
 */
export async function exampleImageCaching(imageUrl: string) {
  try {
    // Check if image is already cached
    const isCached = await isImageCached(imageUrl)
    console.log(`Image already cached: ${isCached}`)

    let blobUrl: string | null

    if (isCached) {
      // Get from cache
      blobUrl = await getCachedImage(imageUrl)
      if (!blobUrl) {
        throw new Error('Failed to retrieve cached image')
      }
      console.log('Retrieved image from cache')
    } else {
      // Cache the image
      blobUrl = await cacheImage(imageUrl)
      console.log('Image cached successfully')
    }

    // Use the blob URL (e.g., set as image source)
    // document.getElementById('myImage').src = blobUrl

    // Get cache statistics
    const stats = await imageCache.getCacheStats()
    console.log('Cache statistics:', stats)

    return blobUrl
  } catch (error) {
    console.error('Error in image caching example:', error)
    throw error
  }
}

/**
 * Example: Cache multiple images with error handling
 */
export async function cacheMultipleImages(imageUrls: string[]) {
  const results: { url: string; success: boolean; blobUrl?: string; error?: string }[] = []

  for (const url of imageUrls) {
    try {
      const blobUrl = await cacheImage(url)
      results.push({ url, success: true, blobUrl })
    } catch (error) {
      results.push({
        url,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return results
}

/**
 * Example: Clean up cache
 */
export async function cleanupCacheExample() {
  try {
    await imageCache.clearCache()
    console.log('Cache cleared successfully')
  } catch (error) {
    console.error('Error clearing cache:', error)
  }
}

/**
 * Example: Environment-specific usage
 */
export async function environmentSpecificExample() {
  // The utility automatically detects the environment
  // and works in browser extension contexts

  const stats = await imageCache.getCacheStats()
  console.log(`Running in: ${stats.context} context`)

  if (stats.context === 'extension') {
    console.log('Chrome extension features available')
  }

  return stats.context
}
