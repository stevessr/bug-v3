// Default configuration loader - separated from newStorage to reduce bundle size
import { loadDefaultEmojiGroups, loadPackagedDefaults } from '@/types/defaultEmojiGroups.loader'
import { logger } from '@/config/buildFlags'

// Lazy-loaded default emoji groups
let cachedDefaultGroups: any[] | null = null

export async function getDefaultEmojiGroups(): Promise<any[]> {
  if (cachedDefaultGroups !== null) {
    return cachedDefaultGroups
  }

  try {
    // Try runtime loader for packaged JSON first, fallback to generated module
    const runtime = await loadDefaultEmojiGroups()
    if (runtime && runtime.length) {
      cachedDefaultGroups = runtime
      return runtime
    }
  } catch (e) {
    logger.warn('[DefaultConfig] Failed to load default emoji groups:', e)
  }

  // Fallback to empty array
  cachedDefaultGroups = []
  return []
}

// Lazy-loaded packaged defaults
let cachedPackagedDefaults: any | null = null

export async function getPackagedDefaults(): Promise<any> {
  if (cachedPackagedDefaults !== null) {
    return cachedPackagedDefaults
  }

  try {
    const packaged = await loadPackagedDefaults()
    if (packaged) {
      cachedPackagedDefaults = packaged
      return packaged
    }
  } catch (e) {
    logger.warn('[DefaultConfig] Failed to load packaged defaults:', e)
  }

  // Fallback to empty object
  cachedPackagedDefaults = {}
  return {}
}

// Clear cache (useful for testing or reloading)
export function clearDefaultConfigCache(): void {
  cachedDefaultGroups = null
  cachedPackagedDefaults = null
}
